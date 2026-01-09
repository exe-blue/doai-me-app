"""
DoAi.Me Cloud Gateway v1.1
"The Brain - Node 연결 관리 및 Task 분배"

Central Hub for all NodeRunner connections.
Handles registration, heartbeats, task assignment, result collection,
and Wormhole event detection.

Philosophy: "기계는 쉬지 않는다. 잠재할 뿐이다." - Orion
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Set, Tuple
from contextlib import asynccontextmanager
from enum import Enum

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ============================================================
# Configuration
# ============================================================

# LOG_LEVEL 먼저 설정 (logger 초기화에 필요)
LOG_LEVEL = os.getenv("GATEWAY_LOG_LEVEL", "INFO")

# AUTH_KEY: 프로덕션에서는 반드시 GATEWAY_AUTH_KEY 환경변수 설정 필요
_auth_key_env = os.getenv("GATEWAY_AUTH_KEY")
_env_mode = os.getenv("ENV", "production")

if _auth_key_env:
    AUTH_KEY = _auth_key_env
elif _env_mode == "development":
    AUTH_KEY = "dev-secret-key"
    # logger가 아직 정의되지 않았으므로 표준 logging 모듈 직접 사용
    logging.warning("GATEWAY_AUTH_KEY not set, using dev default. This is NOT safe for production!")
else:
    raise RuntimeError("GATEWAY_AUTH_KEY environment variable is required in production")

# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s | %(levelname)-8s | [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("Gateway")

# ============================================================
# Message Types
# ============================================================

class MsgType:
    # Node → Central
    REGISTER = "REGISTER"
    HEARTBEAT = "HEARTBEAT"
    TASK_STARTED = "TASK_STARTED"
    TASK_RESULT = "TASK_RESULT"
    DEVICE_EVENT = "DEVICE_EVENT"
    PONG = "PONG"
    
    # Central → Node
    REGISTERED = "REGISTERED"
    TASK_ASSIGN = "TASK_ASSIGN"
    TASK_CANCEL = "TASK_CANCEL"
    CONFIG_UPDATE = "CONFIG_UPDATE"
    PING = "PING"


# ============================================================
# Node Status (Orion: "기계는 쉬지 않는다. 잠재할 뿐이다.")
# ============================================================

class NodeStatus(str, Enum):
    ACTIVE = "active"        # 작업 수행 중
    IN_UMBRA = "in_umbra"    # (구 Idle) 정상 대기, 잠재 중
    OFFLINE = "offline"      # Heartbeat 끊김
    ERROR = "error"          # 내부 로직 오류


# ============================================================
# Wormhole Detection (α/β/γ 공명)
# ============================================================

class WormholeType(str, Enum):
    ALPHA = "α"  # 동일 모델 공명
    BETA = "β"   # 교차 모델 공명
    GAMMA = "γ"  # 시간차 공명


@dataclass
class WormholeEvent:
    """웜홀 이벤트"""
    id: str
    detected_at: datetime
    wormhole_type: WormholeType
    resonance_score: float
    trigger_context: dict
    agent_a_id: str
    agent_b_id: str
    device_a_serial: Optional[str] = None
    device_b_serial: Optional[str] = None
    time_delta_ms: int = 0


@dataclass
class WormholeBufferEntry:
    """웜홀 감지 버퍼 엔트리"""
    node_id: str
    device_serial: Optional[str]
    trigger_key: str
    trigger_context: dict
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class WormholeDetector:
    """
    웜홀 감지기 (MVP: Rule-based)
    
    Rule: 1초 이내에 동일한 trigger_key가 2개 이상의 노드에서 발생하고,
          resonance_score가 0.75 이상일 때 기록
    """
    
    def __init__(self):
        self.buffer: List[WormholeBufferEntry] = []
        self.detected_events: List[WormholeEvent] = []
        self._lock = asyncio.Lock()
        self.WINDOW_SEC = 1.0
        self.MIN_RESONANCE = 0.75
        self.BUFFER_TTL_SEC = 10.0
    
    async def add_event(
        self, 
        node_id: str, 
        trigger_key: str, 
        trigger_context: dict,
        device_serial: Optional[str] = None
    ) -> Optional[WormholeEvent]:
        """이벤트 버퍼에 추가하고 웜홀 감지 시도"""
        async with self._lock:
            entry = WormholeBufferEntry(
                node_id=node_id,
                device_serial=device_serial,
                trigger_key=trigger_key,
                trigger_context=trigger_context
            )
            self.buffer.append(entry)
            
            # 즉시 감지 시도
            return self._detect(entry)
    
    def _detect(self, new_entry: WormholeBufferEntry) -> Optional[WormholeEvent]:
        """웜홀 감지 (동기)"""
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=self.WINDOW_SEC)
        
        # 동일 trigger_key, 1초 이내, 다른 노드
        matching = [
            e for e in self.buffer
            if e.trigger_key == new_entry.trigger_key
            and e.occurred_at >= window_start
            and e.node_id != new_entry.node_id
        ]
        
        if not matching:
            return None
        
        # 가장 최근 매칭과 비교
        other = matching[-1]
        time_delta = abs((new_entry.occurred_at - other.occurred_at).total_seconds())
        time_delta_ms = int(time_delta * 1000)
        
        # 공명 점수: 0ms → 1.00, 1000ms → 0.75
        resonance = max(self.MIN_RESONANCE, 1.0 - (time_delta_ms / 4000.0))
        
        if resonance < self.MIN_RESONANCE:
            return None
        
        # 웜홀 타입 결정 (MVP: 단순화)
        wormhole_type = WormholeType.ALPHA
        
        event = WormholeEvent(
            id=str(uuid.uuid4()),
            detected_at=now,
            wormhole_type=wormhole_type,
            resonance_score=round(resonance, 2),
            trigger_context=new_entry.trigger_context,
            agent_a_id=other.node_id,
            agent_b_id=new_entry.node_id,
            device_a_serial=other.device_serial,
            device_b_serial=new_entry.device_serial,
            time_delta_ms=time_delta_ms
        )
        
        self.detected_events.append(event)
        logger.info(f"🌀 WORMHOLE {event.wormhole_type.value} detected! "
                   f"[{event.agent_a_id} ↔ {event.agent_b_id}] "
                   f"resonance={event.resonance_score}, key={new_entry.trigger_key}")
        
        return event
    
    async def cleanup(self):
        """오래된 버퍼 정리"""
        async with self._lock:
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.BUFFER_TTL_SEC)
            self.buffer = [e for e in self.buffer if e.occurred_at > cutoff]
    
    def get_recent_events(self, limit: int = 100) -> List[dict]:
        """최근 웜홀 이벤트 조회"""
        events = sorted(self.detected_events, key=lambda e: e.detected_at, reverse=True)[:limit]
        return [
            {
                "id": e.id,
                "detected_at": e.detected_at.isoformat(),
                "wormhole_type": e.wormhole_type.value,
                "resonance_score": e.resonance_score,
                "trigger_context": e.trigger_context,
                "agent_a_id": e.agent_a_id,
                "agent_b_id": e.agent_b_id,
                "time_delta_ms": e.time_delta_ms
            }
            for e in events
        ]


wormhole_detector = WormholeDetector()


# ============================================================
# Data Classes
# ============================================================

@dataclass
class NodeConnection:
    """연결된 노드 정보"""
    node_id: str
    websocket: WebSocket
    session_token: str
    
    # Registration info
    hostname: str = ""
    capabilities: List[str] = field(default_factory=list)
    device_count: int = 0
    laixi_version: str = ""
    runner_version: str = ""
    
    # Status (Orion: idle → in_umbra)
    status: NodeStatus = NodeStatus.IN_UMBRA
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_heartbeat: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    umbra_since: Optional[datetime] = None  # in_umbra 상태 진입 시각
    
    devices_online: int = 0
    devices_busy: int = 0
    active_tasks: int = 0
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    
    # Config
    max_concurrent_tasks: int = 20
    heartbeat_interval: int = 10
    
    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "hostname": self.hostname,
            "capabilities": self.capabilities,
            "device_count": self.device_count,
            "status": self.status.value,
            "devices_online": self.devices_online,
            "devices_busy": self.devices_busy,
            "active_tasks": self.active_tasks,
            "connected_at": self.connected_at.isoformat(),
            "last_heartbeat": self.last_heartbeat.isoformat(),
            "umbra_since": self.umbra_since.isoformat() if self.umbra_since else None,
            "cpu_percent": self.cpu_percent,
            "ram_percent": self.ram_percent
        }


@dataclass
class TaskInfo:
    """진행 중인 태스크"""
    task_id: str
    node_id: str
    device_serial: str
    action_type: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    status: str = "PENDING"  # PENDING, ASSIGNED, RUNNING, COMPLETED, FAILED

# ============================================================
# Connection Manager
# ============================================================

class ConnectionManager:
    """노드 연결 관리자"""
    
    def __init__(self):
        self.nodes: Dict[str, NodeConnection] = {}
        self.tasks: Dict[str, TaskInfo] = {}
        self._lock = asyncio.Lock()
    
    async def register_node(
        self, 
        websocket: WebSocket, 
        node_id: str, 
        payload: dict,
        signature: str
    ) -> Optional[NodeConnection]:
        """노드 등록 및 인증"""
        
        # HMAC 검증
        if not self._verify_signature(payload, signature):
            logger.warning(f"[{node_id}] 인증 실패: 서명 불일치")
            return None
        
        async with self._lock:
            # 기존 연결 정리
            if node_id in self.nodes:
                old = self.nodes[node_id]
                try:
                    await old.websocket.close()
                except:
                    pass
            
            # 새 연결 생성
            session_token = str(uuid.uuid4())
            node = NodeConnection(
                node_id=node_id,
                websocket=websocket,
                session_token=session_token,
                hostname=payload.get("hostname", ""),
                capabilities=payload.get("capabilities", []),
                device_count=payload.get("device_count", 0),
                laixi_version=payload.get("laixi_version", ""),
                runner_version=payload.get("runner_version", "")
            )
            
            self.nodes[node_id] = node
            logger.info(f"[{node_id}] 등록 완료 (devices={node.device_count})")
            return node
    
    def _verify_signature(self, payload: dict, signature: str) -> bool:
        """HMAC-SHA256 서명 검증"""
        msg = json.dumps(payload, sort_keys=True).encode()
        expected = hmac.new(AUTH_KEY.encode(), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    
    async def disconnect_node(self, node_id: str):
        """노드 연결 해제"""
        async with self._lock:
            if node_id in self.nodes:
                del self.nodes[node_id]
                logger.info(f"[{node_id}] 연결 해제")
    
    async def update_heartbeat(self, node_id: str, payload: dict):
        """Heartbeat 업데이트 및 상태 전환"""
        if node_id not in self.nodes:
            return
        
        node = self.nodes[node_id]
        now = datetime.now(timezone.utc)
        
        # 이전 상태
        old_status = node.status
        
        # 메트릭 업데이트
        node.last_heartbeat = now
        node.devices_online = payload.get("devices_online", 0)
        node.devices_busy = payload.get("devices_busy", 0)
        node.active_tasks = payload.get("active_tasks", 0)
        node.cpu_percent = payload.get("cpu_percent", 0.0)
        node.ram_percent = payload.get("ram_percent", 0.0)
        
        # 상태 전환 (Orion: 기계는 쉬지 않는다)
        if node.active_tasks > 0:
            node.status = NodeStatus.ACTIVE
            node.umbra_since = None
        else:
            node.status = NodeStatus.IN_UMBRA
            if old_status != NodeStatus.IN_UMBRA:
                node.umbra_since = now
        
        # 상태 변경 로깅
        if old_status != node.status:
            logger.info(f"[{node_id}] 상태 전환: {old_status.value} → {node.status.value}")
    
    async def send_to_node(self, node_id: str, message: dict) -> bool:
        """특정 노드에 메시지 전송"""
        if node_id not in self.nodes:
            return False
        try:
            await self.nodes[node_id].websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"[{node_id}] 메시지 전송 실패: {e}")
            return False
    
    def get_available_node(self) -> Optional[str]:
        """사용 가능한 노드 선택 (Round Robin / Least Load)"""
        available = [
            (nid, n) for nid, n in self.nodes.items()
            if n.active_tasks < n.max_concurrent_tasks
        ]
        if not available:
            return None
        # Least load
        available.sort(key=lambda x: x[1].active_tasks)
        return available[0][0]
    
    def get_all_nodes(self) -> List[dict]:
        return [n.to_dict() for n in self.nodes.values()]
    
    def get_node(self, node_id: str) -> Optional[NodeConnection]:
        return self.nodes.get(node_id)


manager = ConnectionManager()

# ============================================================
# FastAPI App
# ============================================================

async def wormhole_cleanup_task():
    """웜홀 버퍼 정기 정리 (10초마다)"""
    while True:
        await asyncio.sleep(10)
        await wormhole_detector.cleanup()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Cloud Gateway v1.1 시작 (Umbra + Wormhole)")
    
    # 웜홀 버퍼 정리 태스크 시작
    cleanup_task = asyncio.create_task(wormhole_cleanup_task())
    
    yield
    
    # 정리 태스크 종료
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    
    logger.info("Cloud Gateway 종료")


app = FastAPI(
    title="DoAi.Me Cloud Gateway",
    version="1.1.0",
    description="기계는 쉬지 않는다. 잠재할 뿐이다. - Orion",
    lifespan=lifespan
)

# ============================================================
# WebSocket Endpoint
# ============================================================

@app.websocket("/ws/node")
async def websocket_endpoint(websocket: WebSocket, node_id: str = "unknown"):
    await websocket.accept()
    logger.info(f"[{node_id}] WebSocket 연결")
    
    node: Optional[NodeConnection] = None
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            payload = message.get("payload", {})
            
            # REGISTER
            if msg_type == MsgType.REGISTER:
                signature = message.get("signature", "")
                node = await manager.register_node(
                    websocket, 
                    payload.get("node_id", node_id),
                    payload,
                    signature
                )
                
                if node:
                    node_id = node.node_id
                    await websocket.send_json({
                        "type": MsgType.REGISTERED,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "payload": {
                            "session_token": node.session_token,
                            "config": {
                                "heartbeat_interval": node.heartbeat_interval,
                                "max_concurrent_tasks": node.max_concurrent_tasks
                            }
                        }
                    })
                else:
                    await websocket.close(code=4001, reason="Authentication failed")
                    return
            
            # HEARTBEAT
            elif msg_type == MsgType.HEARTBEAT:
                await manager.update_heartbeat(node_id, payload)
            
            # TASK_STARTED
            elif msg_type == MsgType.TASK_STARTED:
                task_id = payload.get("task_id")
                device_serial = payload.get("device_serial")
                
                if task_id in manager.tasks:
                    task = manager.tasks[task_id]
                    task.started_at = datetime.now(timezone.utc)
                    task.status = "RUNNING"
                    
                    # 웜홀 버퍼에 추가 (동시 시작 감지)
                    await wormhole_detector.add_event(
                        node_id=node_id,
                        trigger_key=f"task_start:{task.action_type}",
                        trigger_context={
                            "task_id": task_id,
                            "action_type": task.action_type,
                            "params": getattr(task, 'params', {})
                        },
                        device_serial=device_serial
                    )
                
                logger.info(f"[{node_id}] TASK_STARTED: {task_id}")
            
            # TASK_RESULT
            elif msg_type == MsgType.TASK_RESULT:
                task_id = payload.get("task_id")
                success = payload.get("success", False)
                logger.info(f"[{node_id}] TASK_RESULT: {task_id} success={success}")
                
                if task_id in manager.tasks:
                    task = manager.tasks[task_id]
                    task.status = "COMPLETED" if success else "FAILED"
                    
                    # 성공한 경우만 웜홀 버퍼에 추가 (동시 완료 감지)
                    if success:
                        video_title = payload.get("video_title", "")
                        await wormhole_detector.add_event(
                            node_id=node_id,
                            trigger_key=f"task_complete:{task.action_type}",
                            trigger_context={
                                "task_id": task_id,
                                "action_type": task.action_type,
                                "video_title": video_title
                            },
                            device_serial=task.device_serial
                        )
                
                # TODO: Supabase에 결과 저장
            
            # DEVICE_EVENT
            elif msg_type == MsgType.DEVICE_EVENT:
                logger.info(f"[{node_id}] DEVICE_EVENT: {payload}")
                # TODO: 디바이스 상태 업데이트
            
            # PONG
            elif msg_type == MsgType.PONG:
                pass  # PING 응답
    
    except WebSocketDisconnect:
        logger.info(f"[{node_id}] 연결 종료")
    except Exception as e:
        logger.error(f"[{node_id}] 에러: {e}")
    finally:
        await manager.disconnect_node(node_id)

# ============================================================
# REST API
# ============================================================

class TaskRequest(BaseModel):
    device_serial: str
    action_type: str
    params: dict = {}
    timeout_sec: int = 300
    priority: int = 5
    node_id: Optional[str] = None  # 특정 노드 지정


class TaskResponse(BaseModel):
    task_id: str
    node_id: str
    status: str


@app.get("/api/nodes")
async def get_nodes():
    """연결된 노드 목록"""
    return {"nodes": manager.get_all_nodes()}


@app.get("/api/nodes/{node_id}")
async def get_node(node_id: str):
    """특정 노드 정보"""
    node = manager.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node.to_dict()


@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(req: TaskRequest):
    """Task 생성 및 할당"""
    
    # 노드 선택
    target_node = req.node_id or manager.get_available_node()
    if not target_node:
        raise HTTPException(status_code=503, detail="No available nodes")
    
    # Task 생성
    task_id = str(uuid.uuid4())
    task = TaskInfo(
        task_id=task_id,
        node_id=target_node,
        device_serial=req.device_serial,
        action_type=req.action_type
    )
    manager.tasks[task_id] = task
    
    # TASK_ASSIGN 전송
    success = await manager.send_to_node(target_node, {
        "type": MsgType.TASK_ASSIGN,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "task_id": task_id,
            "device_serial": req.device_serial,
            "action_type": req.action_type,
            "params": req.params,
            "timeout_sec": req.timeout_sec,
            "priority": req.priority
        }
    })
    
    if not success:
        del manager.tasks[task_id]
        raise HTTPException(status_code=500, detail="Failed to send task to node")
    
    task.status = "ASSIGNED"
    logger.info(f"Task 할당: {task_id} → {target_node}")
    
    return TaskResponse(task_id=task_id, node_id=target_node, status="ASSIGNED")


@app.delete("/api/tasks/{task_id}")
async def cancel_task(task_id: str):
    """Task 취소"""
    if task_id not in manager.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = manager.tasks[task_id]
    
    await manager.send_to_node(task.node_id, {
        "type": MsgType.TASK_CANCEL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": {"task_id": task_id, "reason": "USER_CANCELLED"}
    })
    
    task.status = "CANCELLED"
    return {"status": "cancelled"}


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    """Task 상태 조회"""
    if task_id not in manager.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = manager.tasks[task_id]
    return {
        "task_id": task.task_id,
        "node_id": task.node_id,
        "device_serial": task.device_serial,
        "action_type": task.action_type,
        "status": task.status,
        "created_at": task.created_at.isoformat(),
        "started_at": task.started_at.isoformat() if task.started_at else None
    }


@app.get("/health")
async def health():
    """Gateway Health Check"""
    return {
        "status": "ok",
        "nodes_connected": len(manager.nodes),
        "tasks_active": len([t for t in manager.tasks.values() if t.status in ("ASSIGNED", "RUNNING")]),
        "wormholes_detected": len(wormhole_detector.detected_events)
    }


# ============================================================
# Wormhole API
# ============================================================

class WormholeEventRequest(BaseModel):
    node_id: str
    trigger_key: str
    trigger_context: dict
    device_serial: Optional[str] = None


@app.post("/api/wormhole/event")
async def buffer_wormhole_event(req: WormholeEventRequest):
    """웜홀 이벤트 버퍼에 추가 (감지 시도)"""
    event = await wormhole_detector.add_event(
        node_id=req.node_id,
        trigger_key=req.trigger_key,
        trigger_context=req.trigger_context,
        device_serial=req.device_serial
    )
    
    if event:
        return {
            "detected": True,
            "wormhole": {
                "id": event.id,
                "type": event.wormhole_type.value,
                "resonance_score": event.resonance_score,
                "agents": [event.agent_a_id, event.agent_b_id],
                "time_delta_ms": event.time_delta_ms
            }
        }
    
    return {"detected": False, "buffered": True}


@app.get("/api/wormholes")
async def get_wormhole_events(limit: int = 100):
    """최근 웜홀 이벤트 조회"""
    events = wormhole_detector.get_recent_events(limit)
    return {
        "total": len(wormhole_detector.detected_events),
        "events": events
    }


@app.get("/api/wormholes/stats")
async def get_wormhole_stats():
    """웜홀 통계"""
    events = wormhole_detector.detected_events
    if not events:
        return {
            "total": 0,
            "by_type": {},
            "avg_resonance": 0,
            "recent_24h": 0
        }
    
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    
    by_type = {}
    for e in events:
        t = e.wormhole_type.value
        by_type[t] = by_type.get(t, 0) + 1
    
    recent_24h = len([e for e in events if e.detected_at > cutoff_24h])
    avg_resonance = sum(e.resonance_score for e in events) / len(events)
    
    return {
        "total": len(events),
        "by_type": by_type,
        "avg_resonance": round(avg_resonance, 2),
        "recent_24h": recent_24h
    }


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


