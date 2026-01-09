"""
DoAi.Me NodeRunner - The Muscle
Local T5810 Agent (WSS Protocol v1.0)

Mission: 단순함이 핵심이다
- Cloud Gateway에 WebSocket 연결 (HELLO + HMAC-SHA256)
- HEARTBEAT → 명령 Pull (Pull-based Push)
- COMMAND → Laixi → RESULT
- Self-Healing (Laixi 재시작)

Protocol v1.0:
1. HELLO (node_id + signature) → HELLO_ACK
2. HEARTBEAT (30초) → HEARTBEAT_ACK + pending commands
3. COMMAND 실행 → RESULT

"복잡한 생각은 버려라." - Orion
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import platform
import hmac
import hashlib
import base64
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

try:
    import websockets
    from websockets.exceptions import ConnectionClosed
except ImportError:
    print("websockets 패키지가 필요합니다: pip install websockets")
    sys.exit(1)

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


# ============================================================
# Configuration
# ============================================================

class Config:
    """NodeRunner 설정"""
    # Gateway
    GATEWAY_URL = os.getenv("GATEWAY_URL", "wss://api.doai.me/ws/node")
    NODE_ID = os.getenv("NODE_ID", "node_01")
    SECRET_KEY = os.getenv("NODE_SECRET_KEY", "")  # Base64 인코딩 키
    
    # Laixi
    LAIXI_WS_URL = os.getenv("LAIXI_WS_URL", "ws://127.0.0.1:22221/")
    LAIXI_EXE_PATH = os.getenv("LAIXI_EXE_PATH", r"C:\Program Files\touping\touping.exe")
    
    # Protocol
    PROTOCOL_VERSION = "1.0"
    HEARTBEAT_INTERVAL = 30  # 초
    COMMAND_TIMEOUT = 300    # 초
    HELLO_TIMEOUT = 10       # 초
    
    # Reconnection
    RECONNECT_MIN_DELAY = 1   # 초
    RECONNECT_MAX_DELAY = 60  # 초
    
    # Self-Healing
    MAX_LAIXI_FAILURES = 5
    
    # Concurrency
    MAX_ACTIVE_TASKS = 10  # BUSY 상태 판단 임계값


# ============================================================
# 로깅 설정
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# SECRET_KEY 필수 검증 (--no-sign 옵션이 없는 경우에만)
if "--no-sign" not in sys.argv:
    if not Config.SECRET_KEY:
        logger.error("NODE_SECRET_KEY is required. Please set the environment variable.")
        sys.exit(1)
    
    # SECRET_KEY Base64 형식 검증
    try:
        base64.b64decode(Config.SECRET_KEY)
    except Exception as e:
        logger.error(f"NODE_SECRET_KEY must be valid Base64 format: {e}")
        sys.exit(1)
else:
    logger.info("🔓 --no-sign 모드: SECRET_KEY 검증 건너뜀")


# ============================================================
# Security: HMAC-SHA256 서명
# ============================================================

def generate_signature(payload: dict, secret_key: str) -> str:
    """HMAC-SHA256 서명 생성"""
    # 키 정렬하여 JSON 직렬화 (서버와 동일 방식)
    payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    
    # Base64 디코딩 시도 - 실패 시 UTF-8 인코딩
    try:
        key_bytes = base64.b64decode(secret_key)
    except Exception:
        key_bytes = secret_key.encode('utf-8')
    
    # HMAC-SHA256
    signature = hmac.new(
        key_bytes,
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature


# ============================================================
# System Resources
# ============================================================

def get_system_resources() -> dict:
    """시스템 리소스 정보 수집"""
    if not PSUTIL_AVAILABLE:
        return {}
    
    try:
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_free_gb": round(psutil.disk_usage('/').free / (1024**3), 1),
            "network_ok": True
        }
    except Exception as e:
        logger.warning(f"리소스 수집 실패: {e}")
        return {}


def get_hostname() -> str:
    """호스트명 조회"""
    return platform.node()


def get_ip_address() -> str:
    """IP 주소 조회"""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "0.0.0.0"


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


def build_hello(node_id: str, secret_key: str = None) -> dict:
    """HELLO 메시지 빌드 (서명 포함)"""
    payload = {
        "hostname": get_hostname(),
        "ip_address": get_ip_address(),
        "runner_version": "2.0.0",
        "capabilities": ["youtube", "tiktok", "adb", "tap", "swipe"],
        "device_count": 0  # 나중에 업데이트
    }
    
    message = {
        "version": Config.PROTOCOL_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "message_id": str(uuid.uuid4()),
        "type": "HELLO",
        "node_id": node_id,
        "payload": payload
    }
    
    # HMAC-SHA256 서명 추가
    if secret_key:
        message["signature"] = generate_signature(payload, secret_key)
    
    return message


def build_heartbeat(
    status: str,
    device_snapshot: list,
    resources: dict,
    active_tasks: int = 0,
    queue_depth: int = 0
) -> dict:
    """HEARTBEAT 메시지 빌드"""
    return build_message("HEARTBEAT", {
        "status": status,
        "device_snapshot": device_snapshot,
        "resources": resources,
        "active_tasks": active_tasks,
        "queue_depth": queue_depth
    })


def build_result(
    command_id: str,
    status: str,
    summary: dict,
    device_results: list = None,
    error_message: str = None
) -> dict:
    """RESULT 메시지 빌드"""
    payload = {
        "command_id": command_id,
        "status": status,
        "summary": summary,
        "device_results": device_results or []
    }
    if error_message:
        payload["error_message"] = error_message
    
    return build_message("RESULT", payload)


def build_ack(ack_message_id: str, status: str, reason: str = None) -> dict:
    """ACK 메시지 빌드"""
    payload = {
        "ack_message_id": ack_message_id,
        "status": status
    }
    if reason:
        payload["reason"] = reason
    return build_message("ACK", payload)


# ============================================================
# Laixi Client
# ============================================================

class LaixiClient:
    """로컬 Laixi와 WebSocket 통신"""
    
    def __init__(self, ws_url: str = None):
        self.ws_url = ws_url or Config.LAIXI_WS_URL
        self._ws = None
        self._connected = False
        self._lock = asyncio.Lock()
        self._devices: List[dict] = []
    
    async def connect(self) -> bool:
        """Laixi 연결"""
        if self._connected:
            return True
        
        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(self.ws_url),
                timeout=5.0
            )
            self._connected = True
            
            # 디바이스 목록 동기화
            await self._sync_devices()
            logger.info(f"✅ Laixi 연결됨 ({len(self._devices)}대 디바이스)")
            return True
            
        except Exception as e:
            logger.error(f"❌ Laixi 연결 실패: {e}")
            self._connected = False
            return False
    
    async def disconnect(self):
        """Laixi 연결 해제"""
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        self._ws = None
        self._connected = False
    
    async def _sync_devices(self):
        """디바이스 목록 동기화"""
        response = await self.send_command({"action": "list"})  # 소문자 'list'
        logger.debug(f"Laixi list 응답: {response}")
        
        if response and response.get("StatusCode") == 200:
            # Laixi 응답: result가 JSON 문자열로 감싸져 있음
            result = response.get("result", "[]")
            logger.debug(f"result 원본: {result}, type: {type(result)}")
            
            if isinstance(result, str):
                try:
                    raw_devices = json.loads(result)
                except json.JSONDecodeError:
                    raw_devices = []
            else:
                raw_devices = result
            
            logger.debug(f"raw_devices: {raw_devices}, type: {type(raw_devices)}")
            
            # 배열이면 그대로, 딕셔너리면 키(디바이스 ID)를 리스트로 변환
            if isinstance(raw_devices, dict):
                device_list = list(raw_devices.keys())
            elif isinstance(raw_devices, list):
                device_list = raw_devices
            else:
                device_list = []
            
            # 디바이스 목록 변환
            self._devices = [
                {
                    "slot": i + 1,
                    "serial": d if isinstance(d, str) else str(d),
                    "status": "idle",
                    "battery_level": None
                }
                for i, d in enumerate(device_list)
            ]
            logger.info(f"디바이스 동기화 완료: {len(self._devices)}대 - {[d['serial'] for d in self._devices]}")
    
    async def send_command(self, command: dict, timeout: float = 10.0) -> Optional[dict]:
        """Laixi에 명령 전송"""
        if not self._connected or not self._ws:
            if not await self.connect():
                return None
        
        async with self._lock:
            try:
                await self._ws.send(json.dumps(command))
                response_text = await asyncio.wait_for(
                    self._ws.recv(),
                    timeout=timeout
                )
                return json.loads(response_text)
            except Exception as e:
                logger.error(f"Laixi 명령 실패: {e}")
                self._connected = False
                return None
    
    def get_device_snapshot(self) -> List[dict]:
        """디바이스 스냅샷 반환 (HEARTBEAT용)"""
        return self._devices.copy()
    
    @property
    def device_count(self) -> int:
        return len(self._devices)
    
    @property
    def is_connected(self) -> bool:
        return self._connected


# ============================================================
# Self-Healing: Laixi 재시작
# ============================================================

async def restart_laixi():
    """Laixi 앱 재시작 (비동기)"""
    logger.warning("🔄 Laixi 재시작 시도...")
    
    try:
        # 기존 프로세스 종료
        await asyncio.to_thread(
            subprocess.run,
            ["taskkill", "/f", "/im", "touping.exe"],
            capture_output=True,
            timeout=10
        )
        await asyncio.sleep(2)
        
        # 재시작
        if os.path.exists(Config.LAIXI_EXE_PATH):
            await asyncio.to_thread(
                subprocess.Popen,
                [Config.LAIXI_EXE_PATH],
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
            logger.info("✅ Laixi 재시작됨")
            await asyncio.sleep(5)
            return True
        else:
            logger.error(f"❌ Laixi 실행 파일 없음: {Config.LAIXI_EXE_PATH}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Laixi 재시작 실패: {e}")
        return False


# ============================================================
# NodeRunner (Protocol v1.0)
# ============================================================

class NodeRunner:
    """
    메인 에이전트 (WSS Protocol v1.0)
    
    Protocol Flow:
    1. HELLO (node_id + signature) → HELLO_ACK
    2. HEARTBEAT (30초) → HEARTBEAT_ACK + pending commands (Pull-based Push)
    3. COMMAND 실행 → RESULT
    """
    
    def __init__(self, gateway_url: str, node_id: str, secret_key: str = None):
        self.gateway_url = gateway_url
        self.node_id = node_id
        self.secret_key = secret_key
        
        self.laixi = LaixiClient()
        
        self._ws = None
        self._connected = False
        self._session_id = None
        self._reconnect_delay = Config.RECONNECT_MIN_DELAY
        self._should_run = True
        
        # 상태
        self._status = "READY"  # READY, BUSY, DEGRADED
        self._active_tasks = 0
        self._active_tasks_lock = asyncio.Lock()  # _active_tasks 동기화용 락
        self._task_queue: asyncio.Queue = asyncio.Queue()  # 스레드-세이프 큐
        
        # Self-Healing
        self._laixi_failures = 0
    
    async def run(self):
        """메인 실행 루프 (무한 재접속)"""
        logger.info(f"🚀 NodeRunner 시작: {self.node_id}")
        logger.info(f"📡 Gateway: {self.gateway_url}")
        logger.info(f"🔐 서명 모드: {'활성' if self.secret_key else '비활성'}")
        
        while self._should_run:
            try:
                await self._connect_and_run()
            except Exception as e:
                logger.error(f"연결 에러: {e}")
            
            if self._should_run:
                logger.info(f"⏳ {self._reconnect_delay}초 후 재접속...")
                await asyncio.sleep(self._reconnect_delay)
                
                # Exponential Backoff
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    Config.RECONNECT_MAX_DELAY
                )
    
    async def _connect_and_run(self):
        """Gateway 연결 및 메시지 루프"""
        try:
            logger.info("🔗 Gateway 연결 중...")
            
            async with websockets.connect(
                self.gateway_url,
                ping_interval=20,
                ping_timeout=10,
                max_size=10 * 1024 * 1024  # 10MB
            ) as ws:
                self._ws = ws
                self._connected = True
                self._reconnect_delay = Config.RECONNECT_MIN_DELAY
                
                # Phase 1: HELLO Handshake
                if not await self._do_hello():
                    return
                
                # Laixi 연결
                await self.laixi.connect()
                
                # Phase 2: HEARTBEAT + Message Loop
                heartbeat_task = asyncio.create_task(self._heartbeat_loop())
                command_task = asyncio.create_task(self._command_processor())
                
                try:
                    await self._message_loop()
                finally:
                    heartbeat_task.cancel()
                    command_task.cancel()
                    try:
                        await heartbeat_task
                        await command_task
                    except asyncio.CancelledError:
                        pass
        
        except ConnectionClosed as e:
            logger.warning(f"🔌 연결 끊김: {e.code} {e.reason}")
        except Exception as e:
            logger.error(f"❌ 연결 에러: {e}")
        finally:
            self._connected = False
            self._ws = None
            self._session_id = None
    
    async def _do_hello(self) -> bool:
        """HELLO 핸드셰이크"""
        # 디바이스 카운트를 위해 Laixi 연결 시도
        await self.laixi.connect()
        
        # HELLO 메시지 생성
        hello = build_hello(self.node_id, self.secret_key)
        hello["payload"]["device_count"] = self.laixi.device_count
        
        await self._ws.send(json.dumps(hello))
        logger.debug(f"→ HELLO 전송")
        
        # HELLO_ACK 대기
        try:
            response_text = await asyncio.wait_for(
                self._ws.recv(),
                timeout=Config.HELLO_TIMEOUT
            )
            response = json.loads(response_text)
        except asyncio.TimeoutError:
            logger.error("❌ HELLO_ACK 타임아웃")
            return False
        
        if response.get("type") == "HELLO_ACK":
            self._session_id = response.get("payload", {}).get("session_id")
            logger.info(f"✅ Gateway 연결 성공 (session={self._session_id})")
            return True
        
        elif response.get("type") == "ERROR":
            error = response.get("payload", {})
            logger.error(f"❌ HELLO 실패: {error.get('error_code')} - {error.get('error_message')}")
            return False
        
        else:
            logger.error(f"❌ 예상치 못한 응답: {response.get('type')}")
            return False
    
    async def _heartbeat_loop(self):
        """30초마다 HEARTBEAT 전송 + 명령 Pull"""
        while self._connected:
            try:
                await asyncio.sleep(Config.HEARTBEAT_INTERVAL)
                
                if not self._connected:
                    break
                
                # Laixi 상태 확인 및 재연결
                if not self.laixi.is_connected:
                    await self.laixi.connect()
                else:
                    # 디바이스 목록 갱신
                    await self.laixi._sync_devices()
                
                # 상태 결정
                if self._active_tasks >= Config.MAX_ACTIVE_TASKS:
                    self._status = "BUSY"
                elif not self.laixi.is_connected:
                    self._status = "DEGRADED"
                else:
                    self._status = "READY"
                
                # HEARTBEAT 메시지 생성
                heartbeat = build_heartbeat(
                    status=self._status,
                    device_snapshot=self.laixi.get_device_snapshot(),
                    resources=get_system_resources(),
                    active_tasks=self._active_tasks,
                    queue_depth=self._task_queue.qsize()
                )
                
                await self._ws.send(json.dumps(heartbeat))
                logger.debug(f"→ HEARTBEAT ({self.laixi.device_count}대, {self._status})")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"HEARTBEAT 에러: {e}")
    
    async def _message_loop(self):
        """메시지 수신 및 처리"""
        async for message in self._ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                msg_payload = data.get("payload", {})
                
                # HEARTBEAT_ACK (Pull-based Push)
                if msg_type == "HEARTBEAT_ACK":
                    commands = msg_payload.get("commands", [])
                    if commands:
                        logger.info(f"← HEARTBEAT_ACK + {len(commands)}개 명령")
                        for cmd in commands:
                            await self._task_queue.put(cmd)
                
                # COMMAND (직접 Push)
                elif msg_type == "COMMAND":
                    logger.info(f"← COMMAND: {msg_payload.get('command_type')}")
                    await self._task_queue.put(msg_payload)
                
                # ERROR
                elif msg_type == "ERROR":
                    error_code = msg_payload.get("error_code")
                    error_msg = msg_payload.get("error_message")
                    logger.error(f"← ERROR: {error_code} - {error_msg}")
                
                # ACK
                elif msg_type == "ACK":
                    logger.debug(f"← ACK: {msg_payload.get('status')}")
                
                else:
                    logger.warning(f"알 수 없는 메시지: {msg_type}")
                    
            except json.JSONDecodeError:
                logger.error(f"JSON 파싱 실패")
    
    async def _command_processor(self):
        """명령 큐 처리 (순차 실행)"""
        while self._connected:
            try:
                # asyncio.Queue.get()은 타임아웃과 함께 사용하여 취소 가능하게 함
                try:
                    command = await asyncio.wait_for(
                        self._task_queue.get(), 
                        timeout=0.5
                    )
                    await self._execute_command(command)
                    self._task_queue.task_done()
                except asyncio.TimeoutError:
                    # 큐가 비어있으면 계속 대기
                    continue
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"명령 처리 에러: {e}")
    
    async def _execute_command(self, command: dict):
        """명령 실행 → Laixi → RESULT 전송"""
        command_id = command.get("command_id")
        command_type = command.get("command_type")
        target = command.get("target", {"type": "ALL_DEVICES"})
        params = command.get("params", {})
        timeout = command.get("timeout_seconds", Config.COMMAND_TIMEOUT)
        
        logger.info(f"🎯 명령 실행: {command_type} (id={command_id})")
        async with self._active_tasks_lock:
            self._active_tasks += 1
        
        # 결과 초기화
        summary = {
            "total_devices": 0,
            "success_count": 0,
            "fail_count": 0,
            "execution_time_ms": 0
        }
        device_results = []
        error_message = None
        result_status = "SUCCESS"
        
        start_time = datetime.now(timezone.utc)
        
        try:
            # Laixi 연결 확인
            if not self.laixi.is_connected:
                if not await self.laixi.connect():
                    self._laixi_failures += 1
                    
                    # Self-Healing
                    if self._laixi_failures >= Config.MAX_LAIXI_FAILURES:
                        await restart_laixi()
                        await asyncio.sleep(5)
                        self._laixi_failures = 0
                    
                    if not await self.laixi.connect():
                        raise Exception("Laixi 연결 불가")
            
            # 대상 디바이스 결정
            target_type = target.get("type", "ALL_DEVICES")
            devices = self.laixi.get_device_snapshot()
            
            if target_type == "SPECIFIC_DEVICES":
                target_slots = target.get("device_slots", [])
                devices = [d for d in devices if d.get("slot") in target_slots]
            elif target_type == "IDLE_DEVICES":
                max_count = target.get("max_count", 10)
                devices = [d for d in devices if d.get("status") == "idle"][:max_count]
            
            summary["total_devices"] = len(devices)
            
            # 명령 실행
            laixi_response = await self._execute_laixi_action(
                command_type, devices, params, timeout
            )
            
            if laixi_response:
                if laixi_response.get("StatusCode") == 200:
                    summary["success_count"] = len(devices)
                    self._laixi_failures = 0
                else:
                    summary["fail_count"] = len(devices)
                    result_status = "FAILED"
                    error_message = laixi_response.get("Message", "Unknown error")
            else:
                summary["fail_count"] = len(devices)
                result_status = "FAILED"
                error_message = "Laixi 응답 없음"
                self._laixi_failures += 1
        
        except Exception as e:
            logger.error(f"명령 실행 실패: {e}")
            result_status = "FAILED"
            error_message = str(e)
        
        finally:
            async with self._active_tasks_lock:
                self._active_tasks -= 1
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            summary["execution_time_ms"] = int(elapsed)
        
        # RESULT 전송
        result = build_result(
            command_id=command_id,
            status=result_status,
            summary=summary,
            device_results=device_results,
            error_message=error_message
        )
        
        if self._connected and self._ws:
            await self._ws.send(json.dumps(result))
            logger.info(f"→ RESULT: {result_status} ({summary['success_count']}/{summary['total_devices']})")
    
    async def _execute_laixi_action(
        self,
        command_type: str,
        devices: List[dict],
        params: dict,
        timeout: float
    ) -> Optional[dict]:
        """명령 타입 → Laixi 명령 변환 및 실행"""
        
        # 디바이스 ID 리스트 (시리얼 또는 슬롯)
        device_ids = ",".join([d.get("serial", f"SLOT_{d.get('slot')}") for d in devices])
        if not device_ids:
            device_ids = "all"
        
        # 명령별 처리
        if command_type == "WATCH_VIDEO":
            url = params.get("video_url", params.get("url", ""))
            min_watch = params.get("min_watch_seconds", 30)
            return await self.laixi.send_command({
                "action": "adb",
                "comm": {
                    "deviceIds": device_ids,
                    "cmd": f"am start -a android.intent.action.VIEW -d \"{url}\""
                }
            }, timeout=timeout)
        
        elif command_type == "RANDOM_WATCH":
            # TikTok 등 자동 스와이프
            return await self.laixi.send_command({
                "action": "onSwipe",
                "comm": {
                    "deviceIds": device_ids,
                    "x1": 540, "y1": 1500,
                    "x2": 540, "y2": 500,
                    "duration": 300
                }
            }, timeout=timeout)
        
        elif command_type == "TAP":
            return await self.laixi.send_command({
                "action": "onTap",
                "comm": {
                    "deviceIds": device_ids,
                    "x": params.get("x", 540),
                    "y": params.get("y", 960)
                }
            }, timeout=timeout)
        
        elif command_type == "SWIPE":
            return await self.laixi.send_command({
                "action": "onSwipe",
                "comm": {
                    "deviceIds": device_ids,
                    "x1": params.get("x1", 540),
                    "y1": params.get("y1", 1500),
                    "x2": params.get("x2", 540),
                    "y2": params.get("y2", 500),
                    "duration": params.get("duration", 300)
                }
            }, timeout=timeout)
        
        elif command_type == "ADB":
            return await self.laixi.send_command({
                "action": "adb",
                "comm": {
                    "deviceIds": device_ids,
                    "cmd": params.get("cmd", "")
                }
            }, timeout=timeout)
        
        elif command_type == "HOME":
            return await self.laixi.send_command({
                "action": "adb",
                "comm": {
                    "deviceIds": device_ids,
                    "cmd": "input keyevent 3"
                }
            }, timeout=timeout)
        
        elif command_type == "BACK":
            return await self.laixi.send_command({
                "action": "adb",
                "comm": {
                    "deviceIds": device_ids,
                    "cmd": "input keyevent 4"
                }
            }, timeout=timeout)
        
        elif command_type == "RESTART_ADB":
            # ADB 서버 재시작
            return await self.laixi.send_command({
                "action": "RestartAdb"
            }, timeout=timeout)
        
        elif command_type == "GET_DEVICES":
            return await self.laixi.send_command({
                "action": "List"
            }, timeout=timeout)
        
        elif command_type == "PING":
            return {"StatusCode": 200, "Message": "PONG"}
        
        else:
            logger.warning(f"알 수 없는 명령 타입: {command_type}")
            return {"StatusCode": 400, "Message": f"Unknown command: {command_type}"}
    
    def stop(self):
        """종료"""
        self._should_run = False


# ============================================================
# 메인
# ============================================================

async def main():
    """메인 진입점"""
    gateway_url = Config.GATEWAY_URL
    node_id = Config.NODE_ID
    secret_key = Config.SECRET_KEY
    
    # 커맨드라인 인자 처리
    if "--local" in sys.argv:
        gateway_url = "ws://localhost:8000/ws/node"
        logger.info("🔧 로컬 테스트 모드")
    
    if "--no-sign" in sys.argv:
        secret_key = None
        logger.info("🔓 서명 비활성화")
    
    runner = NodeRunner(gateway_url, node_id, secret_key)
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("👋 종료 요청")
        runner.stop()


if __name__ == "__main__":
    asyncio.run(main())
