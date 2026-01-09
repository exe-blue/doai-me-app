"""
DoAi.Me Cloud Gateway - The Brain
Vultr FastAPI Server (WSS Protocol v1.0)

Mission: 단순함이 전부다.
- /ws/node: 노드 연결 관리 (HELLO/HEARTBEAT/COMMAND/RESULT)
- /api/command: 프론트엔드 → 노드 명령 전달
- /api/queue: 비동기 명령 큐

Protocol v1.0:
- HELLO → HELLO_ACK (연결 + 인증)
- HEARTBEAT → HEARTBEAT_ACK + 명령 Push (Pull-based Push)
- COMMAND → RESULT (명령 실행)

"복잡한 생각은 버려라." - Orion
"""

import asyncio
import binascii
import json
import logging
import os
import uuid
import hmac
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import pathlib

# Supabase
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logging.warning("supabase-py not installed. DB operations will be mocked.")


# ============================================================
# 로깅 설정
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# ============================================================
# Configuration
# ============================================================

class Config:
    """서버 설정"""
    HEARTBEAT_TIMEOUT = 90          # 90초 동안 HEARTBEAT 없으면 연결 해제
    HEARTBEAT_INTERVAL = 30         # 노드가 30초마다 HEARTBEAT 전송
    MAX_TASKS_PER_NODE = 5          # 노드당 최대 동시 태스크
    COMMAND_TIMEOUT = 300           # 명령 응답 대기 시간 (기본)
    HELLO_TIMEOUT = 10              # HELLO 대기 시간
    PROTOCOL_VERSION = "1.0"
    
    # Environment
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    VERIFY_SIGNATURE = os.getenv("VERIFY_SIGNATURE", "true").lower() == "true"
    CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")


# ============================================================
# Supabase Client
# ============================================================

supabase: Optional[Client] = None

def get_supabase() -> Optional[Client]:
    """Supabase 클라이언트 (Lazy Init)"""
    global supabase
    if supabase is None and SUPABASE_AVAILABLE and Config.SUPABASE_URL:
        try:
            supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)
            logger.info("✅ Supabase 클라이언트 초기화 완료")
        except Exception as e:
            logger.error(f"❌ Supabase 초기화 실패: {e}")
    return supabase


# ============================================================
# Connection Pool (메모리 기반 + DB 동기화)
# ============================================================

class NodeConnection:
    """노드 연결 정보"""
    def __init__(self, node_id: str, websocket: WebSocket, session_id: str):
        self.node_id = node_id
        self.websocket = websocket
        self.session_id = session_id
        self.node_uuid: Optional[str] = None  # DB UUID
        self.connected_at = datetime.now(timezone.utc)
        self.last_heartbeat = datetime.now(timezone.utc)
        self.device_count = 0
        self.status = "READY"
        self.active_tasks = 0
        self.hostname = ""
        self.ip_address = ""
        self.capabilities: List[str] = []
        self.resources: Dict = {}
        self.runner_version = ""
        self.secret_key: Optional[str] = None


class ConnectionPool:
    """노드 연결 풀 관리"""
    
    def __init__(self):
        self._nodes: Dict[str, NodeConnection] = {}
        self._lock = asyncio.Lock()
    
    async def add(self, node_id: str, websocket: WebSocket, session_id: str) -> NodeConnection:
        """노드 연결 추가"""
        async with self._lock:
            # 기존 연결이 있으면 끊기
            if node_id in self._nodes:
                old = self._nodes[node_id]
                try:
                    await old.websocket.close()
                except Exception:
                    pass
                logger.warning(f"[{node_id}] 기존 연결 대체")
            
            conn = NodeConnection(node_id, websocket, session_id)
            self._nodes[node_id] = conn
            logger.info(f"[{node_id}] 연결됨 (총 {len(self._nodes)}개 노드)")
            return conn
    
    async def remove(self, node_id: str):
        """노드 연결 제거"""
        async with self._lock:
            if node_id in self._nodes:
                del self._nodes[node_id]
                logger.info(f"[{node_id}] 연결 해제 (총 {len(self._nodes)}개 노드)")
        
        # DB 연결 해제 표시
        await db_disconnect_node(node_id)
        
        # 대시보드에 노드 연결 해제 알림 (전역 함수 호출)
        # 참고: 이 메서드가 호출될 때 broadcast_to_dashboards가 아직 정의되지 않았을 수 있음
        try:
            await broadcast_to_dashboards({
                "type": "NODE_DISCONNECTED",
                "node_id": node_id
            })
        except NameError:
            pass
    
    async def get(self, node_id: str) -> Optional[NodeConnection]:
        """노드 연결 조회"""
        async with self._lock:
            return self._nodes.get(node_id)
    
    async def update_heartbeat(self, node_id: str, device_count: int = 0, status: str = "READY"):
        """하트비트 업데이트"""
        async with self._lock:
            if node_id in self._nodes:
                self._nodes[node_id].last_heartbeat = datetime.now(timezone.utc)
                self._nodes[node_id].device_count = device_count
                self._nodes[node_id].status = status
    
    async def update_status(self, node_id: str, status: str, active_tasks: int = 0):
        """상태 업데이트"""
        async with self._lock:
            if node_id in self._nodes:
                self._nodes[node_id].status = status
                self._nodes[node_id].active_tasks = active_tasks
    
    async def send_to_node(self, node_id: str, message: dict) -> bool:
        """특정 노드에 메시지 전송"""
        async with self._lock:
            conn = self._nodes.get(node_id)
        
        if not conn:
            return False
        
        try:
            await conn.websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"[{node_id}] 전송 실패: {e}")
            return False
    
    async def broadcast(self, message: dict):
        """모든 노드에 브로드캐스트"""
        async with self._lock:
            node_ids = list(self._nodes.keys())
        
        for node_id in node_ids:
            await self.send_to_node(node_id, message)
    
    def list_nodes(self) -> list:
        """연결된 노드 목록"""
        return [
            {
                "node_id": conn.node_id,
                "node_uuid": conn.node_uuid,
                "session_id": conn.session_id,
                "connected_at": conn.connected_at.isoformat(),
                "last_heartbeat": conn.last_heartbeat.isoformat(),
                "device_count": conn.device_count,
                "status": conn.status,
                "active_tasks": conn.active_tasks,
                "hostname": conn.hostname,
                "capabilities": conn.capabilities,
                "runner_version": conn.runner_version
            }
            for conn in self._nodes.values()
        ]
    
    def get_ready_nodes(self) -> List[NodeConnection]:
        """READY 상태의 노드들 반환"""
        return [
            conn for conn in self._nodes.values()
            if conn.status == "READY" and conn.active_tasks < Config.MAX_TASKS_PER_NODE
        ]


# Connection Pool 싱글톤
pool = ConnectionPool()

# Pending 명령 응답 대기
pending_commands: Dict[str, asyncio.Future] = {}


# ============================================================
# Database Operations (Supabase RPC)
# ============================================================

async def db_get_node_secret(node_id: str) -> Optional[str]:
    """노드의 시크릿 키 조회 (DB)"""
    sb = get_supabase()
    if not sb:
        # Fallback: 환경변수 공통 키
        return os.getenv("NODE_SHARED_SECRET")
    
    try:
        result = sb.rpc("get_node_secret", {"p_node_id": node_id}).execute()
        if result.data:
            return result.data
        return None
    except Exception as e:
        logger.error(f"[{node_id}] DB secret 조회 실패: {e}")
        return os.getenv("NODE_SHARED_SECRET")


async def db_register_node_connection(
    node_id: str,
    session_id: str,
    hostname: str = None,
    ip_address: str = None,
    runner_version: str = None,
    capabilities: List[str] = None
) -> dict:
    """노드 연결 등록 (DB)"""
    sb = get_supabase()
    if not sb:
        return {"success": True, "node_uuid": None, "is_new": False}
    
    try:
        result = sb.rpc("register_node_connection", {
            "p_node_id": node_id,
            "p_ws_session_id": session_id,
            "p_hostname": hostname,
            "p_ip_address": ip_address,
            "p_runner_version": runner_version,
            "p_capabilities": capabilities or []
        }).execute()
        
        if result.data:
            return result.data
        return {"success": False, "error": "No response from DB"}
    except Exception as e:
        logger.error(f"[{node_id}] DB 연결 등록 실패: {e}")
        return {"success": False, "error": str(e)}


async def db_disconnect_node(node_id: str):
    """노드 연결 해제 (DB)"""
    sb = get_supabase()
    if not sb:
        return
    
    try:
        sb.rpc("disconnect_node", {"p_node_id": node_id}).execute()
    except Exception as e:
        logger.error(f"[{node_id}] DB 연결 해제 실패: {e}")


async def db_process_heartbeat(
    node_id: str,
    status: str,
    resources: dict,
    device_snapshot: list,
    active_tasks: int = 0,
    session_id: str = None
) -> dict:
    """HEARTBEAT 처리 + Pull-based Push (DB)"""
    sb = get_supabase()
    if not sb:
        return {"success": True, "pending_commands": []}
    
    try:
        result = sb.rpc("process_heartbeat", {
            "p_node_id": node_id,
            "p_status": status,
            "p_resources": resources,
            "p_device_snapshot": device_snapshot,
            "p_active_tasks": active_tasks,
            "p_ws_session_id": session_id
        }).execute()
        
        if result.data:
            return result.data
        return {"success": False, "pending_commands": []}
    except Exception as e:
        logger.error(f"[{node_id}] DB heartbeat 처리 실패: {e}")
        return {"success": False, "error": str(e), "pending_commands": []}


async def db_start_command(command_id: str) -> bool:
    """명령 시작 표시 (DB)"""
    sb = get_supabase()
    if not sb:
        return True
    
    try:
        result = sb.rpc("start_command", {"p_command_id": command_id}).execute()
        return result.data is True
    except Exception as e:
        logger.error(f"[{command_id}] DB 명령 시작 표시 실패: {e}")
        return False


async def db_complete_command(
    command_id: str,
    status: str,
    result: dict = None,
    error: str = None
) -> bool:
    """명령 완료 처리 (DB)"""
    sb = get_supabase()
    if not sb:
        return True
    
    try:
        sb.rpc("complete_command", {
            "p_command_id": command_id,
            "p_status": status,
            "p_result": result,
            "p_error": error
        }).execute()
        return True
    except Exception as e:
        logger.error(f"[{command_id}] DB 명령 완료 처리 실패: {e}")
        return False


async def db_enqueue_command(
    command_type: str,
    params: dict,
    target_node_id: str = None,
    target_spec: dict = None,
    priority: str = "NORMAL",
    scheduled_at: str = None,
    source_request_id: str = None,
    created_by: str = "api"
) -> Optional[str]:
    """명령 큐에 추가 (DB)"""
    sb = get_supabase()
    if not sb:
        return str(uuid.uuid4())
    
    try:
        result = sb.rpc("enqueue_command", {
            "p_command_type": command_type,
            "p_params": params,
            "p_target_node_id": target_node_id,
            "p_target_spec": target_spec or {"type": "ALL_DEVICES"},
            "p_priority": priority,
            "p_scheduled_at": scheduled_at,
            "p_source_request_id": source_request_id,
            "p_created_by": created_by
        }).execute()
        
        return result.data
    except Exception as e:
        logger.error(f"DB 명령 추가 실패: {e}")
        return None


# ============================================================
# Security: HMAC-SHA256 서명
# ============================================================

def generate_signature(payload: dict, secret_key: str) -> str:
    """HMAC-SHA256 서명 생성"""
    # 키 정렬하여 JSON 직렬화
    payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    
    # Base64 디코딩 - 실패 시 UTF-8 인코딩으로 폴백
    try:
        key_bytes = base64.b64decode(secret_key)
    except (binascii.Error, ValueError):
        key_bytes = secret_key.encode('utf-8')
    
    # HMAC-SHA256
    signature = hmac.new(
        key_bytes,
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature


def verify_signature(payload: dict, signature: str, secret_key: str) -> bool:
    """서명 검증"""
    expected = generate_signature(payload, secret_key)
    return hmac.compare_digest(expected, signature)


# ============================================================
# Message Builders (Protocol v1.0)
# ============================================================

def build_message(msg_type: str, payload: dict) -> dict:
    """프로토콜 v1.0 메시지 빌드"""
    return {
        "version": Config.PROTOCOL_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "message_id": str(uuid.uuid4()),
        "type": msg_type,
        "payload": payload
    }


def build_hello_ack(session_id: str, server_time: str = None) -> dict:
    """HELLO_ACK 메시지 빌드"""
    return {
        "type": "HELLO_ACK",
        "version": Config.PROTOCOL_VERSION,
        "timestamp": server_time or (datetime.now(timezone.utc).isoformat() + "Z"),
        "message_id": str(uuid.uuid4()),
        "payload": {
            "session_id": session_id,
            "heartbeat_interval": Config.HEARTBEAT_INTERVAL,
            "max_tasks": Config.MAX_TASKS_PER_NODE
        }
    }


def build_heartbeat_ack(server_time: str = None, pending_commands: list = None) -> dict:
    """HEARTBEAT_ACK 메시지 빌드 (Pull-based Push 포함)"""
    return {
        "type": "HEARTBEAT_ACK",
        "version": Config.PROTOCOL_VERSION,
        "timestamp": server_time or (datetime.now(timezone.utc).isoformat() + "Z"),
        "message_id": str(uuid.uuid4()),
        "payload": {
            "status": "OK",
            "commands": pending_commands or []
        }
    }


def build_ack(ack_message_id: str, status: str, reason: str = None) -> dict:
    """ACK 메시지 빌드"""
    payload = {
        "ack_message_id": ack_message_id,
        "status": status
    }
    if reason:
        payload["reason"] = reason
    return build_message("ACK", payload)


def build_error(error_code: str, error_message: str, related_id: str = None) -> dict:
    """ERROR 메시지 빌드"""
    payload = {
        "error_code": error_code,
        "error_message": error_message
    }
    if related_id:
        payload["related_message_id"] = related_id
    return build_message("ERROR", payload)


def build_command(
    command_id: str,
    command_type: str,
    target: dict,
    params: dict,
    priority: str = "NORMAL",
    timeout: int = 300
) -> dict:
    """COMMAND 메시지 빌드"""
    return build_message("COMMAND", {
        "command_id": command_id,
        "command_type": command_type,
        "priority": priority,
        "target": target,
        "params": params,
        "timeout_seconds": timeout,
        "retry_count": 1
    })


# ============================================================
# FastAPI App
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 라이프사이클"""
    logger.info("🧠 Cloud Gateway 시작")
    logger.info("🌌 \"복잡한 생각은 버려라.\" - Orion")
    logger.info(f"📡 Protocol Version: {Config.PROTOCOL_VERSION}")
    logger.info(f"🔐 Signature Verification: {Config.VERIFY_SIGNATURE}")
    
    # Supabase 연결 확인
    sb = get_supabase()
    if sb:
        logger.info("✅ Supabase 연결됨")
    else:
        logger.warning("⚠️ Supabase 연결 없음 (Mock 모드)")
    
    # Background task: 비활성 노드 정리
    cleanup_task = asyncio.create_task(cleanup_stale_connections())
    
    yield
    
    # Cleanup
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    logger.info("🧠 Cloud Gateway 종료")


async def cleanup_stale_connections():
    """비활성 연결 정리 (Background Task)"""
    while True:
        try:
            await asyncio.sleep(60)  # 1분마다 체크
            
            now = datetime.now(timezone.utc)
            timeout = timedelta(seconds=Config.HEARTBEAT_TIMEOUT)
            
            # 스냅샷을 통해 순회 중 딕셔너리 변경 에러 방지
            nodes_snapshot = list(pool._nodes.values())
            stale_nodes = []
            
            for node in nodes_snapshot:
                if now - node.last_heartbeat > timeout:
                    stale_nodes.append((node.node_id, node))
            
            for node_id, conn in stale_nodes:
                logger.warning(f"[{node_id}] HEARTBEAT 타임아웃 - 연결 해제")
                try:
                    await conn.websocket.close(code=4008, reason="Heartbeat timeout")
                except Exception:
                    pass
                await pool.remove(node_id)
        
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup task error: {e}")


app = FastAPI(
    title="DoAi.Me Cloud Gateway",
    description="The Brain - Vultr-Centric WSS Hub (Protocol v1.0)",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS if Config.CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 (Control Room 등)
STATIC_DIR = pathlib.Path(__file__).parent / "public"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root():
    """루트 → Control Room 리다이렉트"""
    control_room = STATIC_DIR / "control-room.html"
    if control_room.exists():
        return FileResponse(str(control_room))
    return {"message": "DoAi.Me Cloud Gateway", "docs": "/docs"}


# ============================================================
# WebSocket: 노드 연결 (Protocol v1.0)
# ============================================================

@app.websocket("/ws/node")
async def websocket_node(websocket: WebSocket):
    """
    노드 WebSocket 연결 (Protocol v1.0)
    
    Protocol Flow:
    1. Client → Server: HELLO (node_id + signature + payload)
    2. Server → Client: HELLO_ACK (session_id + config)
    3. Client → Server: HEARTBEAT (30초 간격)
    4. Server → Client: HEARTBEAT_ACK + pending commands (Pull-based Push)
    5. Server → Client: COMMAND (명령 전달)
    6. Client → Server: RESULT (명령 결과)
    """
    await websocket.accept()
    node_id = None
    session_id = str(uuid.uuid4())[:8]
    
    try:
        # ═══════════════════════════════════════════════════════════════════
        # Phase 1: HELLO Handshake
        # ═══════════════════════════════════════════════════════════════════
        try:
            hello = await asyncio.wait_for(
                websocket.receive_json(),
                timeout=Config.HELLO_TIMEOUT
            )
        except asyncio.TimeoutError:
            await websocket.send_json(build_error("AUTH_FAILED", "HELLO timeout"))
            await websocket.close(code=4001, reason="HELLO timeout")
            return
        
        # 메시지 타입 검증
        if hello.get("type") != "HELLO":
            await websocket.send_json(build_error("INVALID_MESSAGE", "Expected HELLO"))
            await websocket.close(code=4002, reason="Expected HELLO")
            return
        
        node_id = hello.get("node_id")
        signature = hello.get("signature")
        payload = hello.get("payload", {})
        message_id = hello.get("message_id", "")
        
        if not node_id:
            await websocket.send_json(build_error("INVALID_MESSAGE", "Missing node_id"))
            await websocket.close(code=4003, reason="Missing node_id")
            return
        
        # ═══ HMAC-SHA256 서명 검증 ═══
        if Config.VERIFY_SIGNATURE:
            secret = await db_get_node_secret(node_id)
            
            if not secret:
                # 새 노드: 서명 없이 연결 허용 (DB에서 키 생성)
                logger.info(f"[{node_id}] 새 노드 - 시크릿 키 생성 예정")
            elif signature:
                if not verify_signature(payload, signature, secret):
                    logger.warning(f"[{node_id}] 서명 검증 실패")
                    await websocket.send_json(build_error("AUTH_FAILED", "Invalid signature", message_id))
                    await websocket.close(code=4004, reason="AUTH_FAILED")
                    return
            else:
                logger.warning(f"[{node_id}] 서명 누락 (VERIFY_SIGNATURE=true)")
                await websocket.send_json(build_error("AUTH_FAILED", "Signature required", message_id))
                await websocket.close(code=4005, reason="Signature required")
                return
        
        # ═══ 연결 풀에 추가 ═══
        conn = await pool.add(node_id, websocket, session_id)
        conn.hostname = payload.get("hostname", "")
        conn.ip_address = payload.get("ip_address", "")
        conn.capabilities = payload.get("capabilities", [])
        conn.device_count = payload.get("device_count", 0)
        conn.runner_version = payload.get("runner_version", "")
        
        # ═══ DB에 연결 등록 ═══
        db_result = await db_register_node_connection(
            node_id=node_id,
            session_id=session_id,
            hostname=conn.hostname,
            ip_address=conn.ip_address,
            runner_version=conn.runner_version,
            capabilities=conn.capabilities
        )
        
        if db_result.get("success"):
            conn.node_uuid = db_result.get("node_uuid")
            if db_result.get("is_new"):
                logger.info(f"[{node_id}] 새 노드 등록됨 (uuid={conn.node_uuid})")
        
        # ═══ HELLO_ACK 응답 ═══
        await websocket.send_json(build_hello_ack(session_id))
        
        logger.info(f"[{node_id}] HELLO 완료 (session={session_id}, devices={conn.device_count})")
        
        # 대시보드에 노드 연결 알림
        await broadcast_to_dashboards({
            "type": "NODE_CONNECTED",
            "node_id": node_id,
            "session_id": session_id,
            "device_count": conn.device_count,
            "hostname": conn.hostname
        })
        
        # ═══════════════════════════════════════════════════════════════════
        # Phase 2: Message Loop
        # ═══════════════════════════════════════════════════════════════════
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")
            msg_id = message.get("message_id", "")
            msg_payload = message.get("payload", {})
            
            # ═══ HEARTBEAT 처리 ═══
            if msg_type == "HEARTBEAT":
                await handle_heartbeat(node_id, conn, websocket, message)
            
            # ═══ RESULT 처리 ═══
            elif msg_type == "RESULT":
                await handle_result(node_id, message)
            
            # ═══ ACK 처리 ═══
            elif msg_type == "ACK":
                # 명령 ACK 처리 (명령 시작 확인)
                ack_msg_id = msg_payload.get("ack_message_id")
                ack_status = msg_payload.get("status")
                logger.debug(f"[{node_id}] ACK: {ack_msg_id} → {ack_status}")
            
            # ═══ EVENT 처리 ═══
            elif msg_type == "EVENT":
                event_type = msg_payload.get("event")
                logger.info(f"[{node_id}] EVENT: {event_type}")
            
            # ═══ 알 수 없는 메시지 ═══
            else:
                logger.warning(f"[{node_id}] 알 수 없는 메시지 타입: {msg_type}")
                await websocket.send_json(build_error(
                    "UNKNOWN_MESSAGE",
                    f"Unknown message type: {msg_type}",
                    msg_id
                ))
    
    except WebSocketDisconnect:
        logger.info(f"[{node_id or 'unknown'}] 연결 끊김")
    except Exception as e:
        logger.error(f"[{node_id or 'unknown'}] 에러: {e}", exc_info=True)
    finally:
        if node_id:
            await pool.remove(node_id)


async def handle_heartbeat(
    node_id: str,
    conn: NodeConnection,
    websocket: WebSocket,
    message: dict
):
    """HEARTBEAT 메시지 처리"""
    msg_payload = message.get("payload", {})
    
    # Protocol v1.0 필드
    status = msg_payload.get("status", "READY")
    device_snapshot = msg_payload.get("device_snapshot", [])
    active_tasks = msg_payload.get("active_tasks", 0)
    resources = msg_payload.get("resources", {})
    queue_depth = msg_payload.get("queue_depth", 0)
    
    # 확장 필드 (기존 NodeRunner 호환)
    metrics = message.get("metrics", {})
    devices = message.get("devices", [])
    device_count = len(device_snapshot) or len(devices) or metrics.get("device_count", 0)
    
    # 메모리 상태 업데이트
    await pool.update_heartbeat(node_id, device_count, status)
    await pool.update_status(node_id, status, active_tasks)
    conn.resources = resources
    
    # ═══ DB 처리 (HEARTBEAT + Pull-based Push) ═══
    db_result = await db_process_heartbeat(
        node_id=node_id,
        status=status,
        resources=resources,
        device_snapshot=device_snapshot or devices,
        active_tasks=active_tasks,
        session_id=conn.session_id
    )
    
    # 대기 명령 추출
    pending_commands = []
    if db_result.get("success"):
        db_commands = db_result.get("pending_commands", [])
        
        # DB 명령을 Protocol v1.0 COMMAND 형식으로 변환
        for cmd in (db_commands or []):
            pending_commands.append({
                "command_id": cmd.get("id"),
                "command_type": cmd.get("command_type"),
                "priority": cmd.get("priority", "NORMAL"),
                "target": cmd.get("target_spec", {"type": "ALL_DEVICES"}),
                "params": cmd.get("params", {}),
                "timeout_seconds": cmd.get("timeout_seconds", 300)
            })
    
    # ═══ OOB 메트릭 전달 ═══
    await forward_metrics_to_oob(node_id, {
        "device_count": device_count,
        "status": status,
        "active_tasks": active_tasks,
        "laixi_connected": metrics.get("laixi_connected", True),
        "unauthorized_count": metrics.get("unauthorized_count", 0),
        "uptime_sec": metrics.get("uptime_sec", 0),
        "laixi_restarts": metrics.get("laixi_restarts", 0),
        "resources": resources
    })
    
    # ═══ HEARTBEAT_ACK 응답 (+ 대기 명령) ═══
    await websocket.send_json(build_heartbeat_ack(
        pending_commands=pending_commands if status == "READY" else []
    ))
    
    if pending_commands:
        logger.info(f"[{node_id}] HEARTBEAT_ACK + {len(pending_commands)}개 명령 Push")
    
    # 대시보드에 노드 상태 업데이트 브로드캐스트
    await broadcast_to_dashboards({
        "type": "NODE_UPDATE",
        "node_id": node_id,
        "status": status,
        "device_count": device_count,
        "active_tasks": active_tasks,
        "last_heartbeat": datetime.now(timezone.utc).isoformat() + "Z"
    })


async def handle_result(node_id: str, message: dict):
    """RESULT 메시지 처리"""
    msg_payload = message.get("payload", {})
    command_id = msg_payload.get("command_id")
    result_status = msg_payload.get("status", "UNKNOWN")
    summary = msg_payload.get("summary", {})
    device_results = msg_payload.get("device_results", [])
    error_message = msg_payload.get("error_message")
    
    # 로깅
    logger.info(
        f"[{node_id}] RESULT: {command_id} → {result_status} "
        f"({summary.get('success_count', 0)}/{summary.get('total_devices', 0)} devices)"
    )
    
    # ═══ Pending Future 해결 (동기 API용) ═══
    if command_id and command_id in pending_commands:
        pending_commands[command_id].set_result(msg_payload)
    
    # ═══ DB 명령 완료 처리 ═══
    if command_id:
        # status 매핑: RESULT status → DB status
        db_status = "COMPLETED" if result_status in ["SUCCESS", "PARTIAL_SUCCESS"] else "FAILED"
        
        await db_complete_command(
            command_id=command_id,
            status=db_status,
            result={
                "summary": summary,
                "device_results": device_results
            },
            error=error_message
        )
    
    # 대시보드에 결과 브로드캐스트
    await broadcast_to_dashboards({
        "type": "COMMAND_RESULT",
        "node_id": node_id,
        "command_id": command_id,
        "status": result_status,
        "summary": summary,
        "error": error_message
    })


async def forward_metrics_to_oob(node_id: str, metrics: dict):
    """OOB 시스템에 메트릭 전달"""
    try:
        import aiohttp
        oob_api_url = os.getenv("OOB_API_URL")
        
        if not oob_api_url:
            return
        
        async with aiohttp.ClientSession() as session:
            payload = {"node_id": node_id, **metrics}
            async with session.post(
                oob_api_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status != 200:
                    logger.debug(f"[{node_id}] OOB metrics forward: {resp.status}")
    except ImportError:
        pass
    except Exception as e:
        logger.debug(f"[{node_id}] OOB forward error: {e}")


# ============================================================
# REST API: 동기 명령 전송
# ============================================================

class CommandRequest(BaseModel):
    """명령 요청"""
    node_id: str
    action: str
    device_id: str = "all"
    params: Dict[str, Any] = Field(default_factory=dict)
    priority: str = "NORMAL"
    timeout: int = 300


class CommandResponse(BaseModel):
    """명령 응답"""
    success: bool
    command_id: str
    result: Optional[dict] = None
    error: Optional[str] = None


@app.post("/api/command", response_model=CommandResponse)
async def send_command(request: CommandRequest):
    """
    노드에 명령 전송 (동기 - 응답 대기)
    
    프론트엔드 → Gateway → Node → Laixi → Gateway → 프론트엔드
    """
    conn = await pool.get(request.node_id)
    if not conn:
        raise HTTPException(
            status_code=404,
            detail=f"Node not found or not connected: {request.node_id}"
        )
    
    command_id = str(uuid.uuid4())
    
    # Protocol v1.0 COMMAND 메시지 빌드
    target = {"type": "ALL_DEVICES"}
    if request.device_id != "all":
        target = {
            "type": "SPECIFIC_DEVICES",
            "device_slots": [int(request.device_id)] if request.device_id.isdigit() else []
        }
    
    command = build_command(
        command_id=command_id,
        command_type=request.action,
        target=target,
        params=request.params,
        priority=request.priority,
        timeout=request.timeout
    )
    
    # Future 생성 (응답 대기용)
    future = asyncio.get_event_loop().create_future()
    pending_commands[command_id] = future
    
    try:
        success = await pool.send_to_node(request.node_id, command)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to send command")
        
        # 응답 대기
        try:
            result = await asyncio.wait_for(future, timeout=float(request.timeout))
            return CommandResponse(
                success=result.get("status") in ["SUCCESS", "PARTIAL_SUCCESS"],
                command_id=command_id,
                result=result,
                error=result.get("error_message")
            )
        except asyncio.TimeoutError:
            return CommandResponse(
                success=False,
                command_id=command_id,
                error=f"Command timeout ({request.timeout}s)"
            )
    finally:
        pending_commands.pop(command_id, None)


# ============================================================
# REST API: 비동기 명령 큐
# ============================================================

class QueueCommandRequest(BaseModel):
    """큐에 추가할 명령"""
    command_type: str
    target_node_id: Optional[str] = None
    target_spec: Dict[str, Any] = Field(default_factory=lambda: {"type": "ALL_DEVICES"})
    params: Dict[str, Any] = Field(default_factory=dict)
    priority: str = "NORMAL"
    scheduled_at: Optional[str] = None


class QueueCommandResponse(BaseModel):
    """큐 추가 응답"""
    queued: bool
    command_id: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/queue/command", response_model=QueueCommandResponse)
async def queue_command(request: QueueCommandRequest):
    """
    명령을 큐에 추가 (비동기 - Pull-based Push로 전달)
    
    프론트엔드 → Gateway → DB Queue → HEARTBEAT → Node
    """
    # target_node_id가 있으면 연결 확인
    node_uuid = None
    if request.target_node_id:
        conn = await pool.get(request.target_node_id)
        if conn and conn.node_uuid:
            node_uuid = conn.node_uuid
    
    command_id = await db_enqueue_command(
        command_type=request.command_type,
        params=request.params,
        target_node_id=node_uuid,
        target_spec=request.target_spec,
        priority=request.priority,
        scheduled_at=request.scheduled_at,
        created_by="api"
    )
    
    if command_id:
        logger.info(f"[QUEUE] 명령 추가: {request.command_type} (id={command_id}, priority={request.priority})")
        return QueueCommandResponse(queued=True, command_id=command_id)
    else:
        return QueueCommandResponse(queued=False, error="Failed to enqueue command")


# ============================================================
# REST API: 노드 상태
# ============================================================

@app.get("/api/nodes")
async def list_nodes():
    """연결된 노드 목록"""
    nodes = pool.list_nodes()
    return {
        "nodes": nodes,
        "total": len(nodes),
        "ready": len([n for n in nodes if n["status"] == "READY"]),
        "busy": len([n for n in nodes if n["status"] == "BUSY"])
    }


@app.get("/api/nodes/{node_id}")
async def get_node(node_id: str):
    """특정 노드 상태"""
    conn = await pool.get(node_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Node not found")
    
    return {
        "node_id": conn.node_id,
        "node_uuid": conn.node_uuid,
        "session_id": conn.session_id,
        "connected_at": conn.connected_at.isoformat(),
        "last_heartbeat": conn.last_heartbeat.isoformat(),
        "device_count": conn.device_count,
        "status": conn.status,
        "active_tasks": conn.active_tasks,
        "hostname": conn.hostname,
        "ip_address": conn.ip_address,
        "capabilities": conn.capabilities,
        "resources": conn.resources,
        "runner_version": conn.runner_version
    }


@app.post("/api/nodes/{node_id}/command")
async def send_command_to_node(node_id: str, request: dict):
    """특정 노드에 직접 명령 전송"""
    conn = await pool.get(node_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Node not found")
    
    command_id = str(uuid.uuid4())
    command = build_command(
        command_id=command_id,
        command_type=request.get("action", "PING"),
        target=request.get("target", {"type": "ALL_DEVICES"}),
        params=request.get("params", {}),
        priority=request.get("priority", "NORMAL"),
        timeout=request.get("timeout", 60)
    )
    
    success = await pool.send_to_node(node_id, command)
    
    return {
        "sent": success,
        "command_id": command_id,
        "node_id": node_id
    }


# ============================================================
# REST API: 브로드캐스트 (Control Room용)
# ============================================================

class BroadcastRequest(BaseModel):
    """브로드캐스트 요청 (Control Room)"""
    video_url: str
    duration_seconds: int = 60
    target_node_count: int = 0  # 0 = 모든 노드
    target_node_ids: List[str] = Field(default_factory=list)  # 특정 노드 지정
    priority: str = "HIGH"


class BroadcastResponse(BaseModel):
    """브로드캐스트 응답"""
    success: bool
    broadcast_id: str
    target_nodes: int
    sent_nodes: int
    errors: List[str] = Field(default_factory=list)


@app.post("/api/broadcast", response_model=BroadcastResponse)
async def broadcast_command(request: BroadcastRequest):
    """
    모든/지정 노드에 비디오 시청 명령 브로드캐스트
    
    Control Room → Gateway → 모든 연결된 노드
    """
    broadcast_id = str(uuid.uuid4())[:8]
    errors = []
    sent_count = 0
    
    logger.info(f"[BROADCAST:{broadcast_id}] 시작: {request.video_url}")
    
    # 대상 노드 결정
    if request.target_node_ids:
        # 특정 노드 지정
        target_nodes = request.target_node_ids
    else:
        # 연결된 모든 READY 노드
        ready_nodes = pool.get_ready_nodes()
        target_nodes = [n.node_id for n in ready_nodes]
        
        # 노드 수 제한
        if request.target_node_count > 0:
            target_nodes = target_nodes[:request.target_node_count]
    
    if not target_nodes:
        return BroadcastResponse(
            success=False,
            broadcast_id=broadcast_id,
            target_nodes=0,
            sent_nodes=0,
            errors=["No connected nodes available"]
        )
    
    # COMMAND 메시지 생성
    command_id = str(uuid.uuid4())
    command = build_command(
        command_id=command_id,
        command_type="WATCH_VIDEO",
        target={"type": "ALL_DEVICES"},
        params={
            "video_url": request.video_url,
            "min_watch_seconds": request.duration_seconds,
            "broadcast_id": broadcast_id
        },
        priority=request.priority,
        timeout=request.duration_seconds + 60
    )
    
    # 각 노드에 전송
    for node_id in target_nodes:
        success = await pool.send_to_node(node_id, command)
        if success:
            sent_count += 1
            logger.info(f"[BROADCAST:{broadcast_id}] → {node_id} 전송 완료")
        else:
            errors.append(f"Failed to send to {node_id}")
            logger.warning(f"[BROADCAST:{broadcast_id}] → {node_id} 전송 실패")
    
    # 대시보드에 이벤트 브로드캐스트
    await broadcast_to_dashboards({
        "type": "BROADCAST_STARTED",
        "broadcast_id": broadcast_id,
        "video_url": request.video_url,
        "target_nodes": len(target_nodes),
        "sent_nodes": sent_count
    })
    
    logger.info(f"[BROADCAST:{broadcast_id}] 완료: {sent_count}/{len(target_nodes)} 노드")
    
    return BroadcastResponse(
        success=sent_count > 0,
        broadcast_id=broadcast_id,
        target_nodes=len(target_nodes),
        sent_nodes=sent_count,
        errors=errors
    )


# ============================================================
# WebSocket: 대시보드 실시간 피드
# ============================================================

# 대시보드 연결 풀
dashboard_connections: List[WebSocket] = []


async def broadcast_to_dashboards(message: dict):
    """대시보드들에 메시지 브로드캐스트"""
    disconnected = []
    for ws in dashboard_connections:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    
    for ws in disconnected:
        dashboard_connections.remove(ws)


@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """
    대시보드 WebSocket 연결
    
    실시간으로 노드 상태, 명령 결과 등을 수신
    """
    await websocket.accept()
    dashboard_connections.append(websocket)
    
    logger.info(f"[DASHBOARD] 연결됨 (총 {len(dashboard_connections)}개)")
    
    try:
        # 초기 상태 전송
        nodes = pool.list_nodes()
        await websocket.send_json({
            "type": "INIT",
            "nodes": nodes,
            "total_nodes": len(nodes),
            "ready_nodes": len([n for n in nodes if n["status"] == "READY"])
        })
        
        # 연결 유지 (클라이언트 메시지 대기)
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "PING":
                    await websocket.send_json({"type": "PONG"})
                
                elif msg_type == "GET_STATUS":
                    nodes = pool.list_nodes()
                    await websocket.send_json({
                        "type": "STATUS",
                        "nodes": nodes,
                        "total_nodes": len(nodes),
                        "ready_nodes": len([n for n in nodes if n["status"] == "READY"])
                    })
                
            except json.JSONDecodeError:
                pass
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[DASHBOARD] 에러: {e}")
    finally:
        if websocket in dashboard_connections:
            dashboard_connections.remove(websocket)
        logger.info(f"[DASHBOARD] 연결 해제 (총 {len(dashboard_connections)}개)")


# ============================================================
# REST API: 시스템 상태
# ============================================================

@app.get("/health")
async def health():
    """헬스체크"""
    nodes = pool.list_nodes()
    sb = get_supabase()
    
    return {
        "status": "ok",
        "protocol_version": Config.PROTOCOL_VERSION,
        "nodes_connected": len(nodes),
        "nodes_ready": len([n for n in nodes if n["status"] == "READY"]),
        "supabase_connected": sb is not None,
        "signature_verification": Config.VERIFY_SIGNATURE
    }


@app.get("/api/status")
async def system_status():
    """시스템 전체 상태"""
    sb = get_supabase()
    
    # DB에서 통계 조회
    db_stats = {}
    if sb:
        try:
            result = sb.from_("system_status_overview").select("*").single().execute()
            if result.data:
                db_stats = result.data
        except Exception as e:
            logger.error(f"DB status 조회 실패: {e}")
    
    nodes = pool.list_nodes()
    
    return {
        "gateway": {
            "protocol_version": Config.PROTOCOL_VERSION,
            "uptime": "N/A",
            "memory_nodes": len(nodes)
        },
        "nodes": {
            "connected": len(nodes),
            "ready": len([n for n in nodes if n["status"] == "READY"]),
            "busy": len([n for n in nodes if n["status"] == "BUSY"])
        },
        "database": db_stats
    }


# ============================================================
# 메인
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
