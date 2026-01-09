"""
DoAi.Me NodeRunner - The Muscle
T5810 Local Executor

Mission: 단순함이 전부다.
- wss://api.doai.me/ws/node 접속
- 끊기면 무한 재접속 (Backoff)
- COMMAND → Laixi 토스 → RESULT 전송
- 30초마다 HEARTBEAT
- Self-Healing: Laixi가 죽으면 다시 시작

"복잡한 생각은 버려라." - Orion
"""

import asyncio
import json
import logging
import os
import socket
import subprocess
import sys
import time
from typing import Dict, Optional

try:
    import websockets
    from websockets.exceptions import ConnectionClosed
except ImportError:
    print("pip install websockets")
    sys.exit(1)

# ============================================================
# Configuration (환경변수 또는 기본값)
# ============================================================

NODE_ID = os.getenv("NODE_ID", socket.gethostname())
CENTRAL_URL = os.getenv("CENTRAL_URL", "wss://api.doai.me/ws/node")
LAIXI_HOST = os.getenv("LAIXI_HOST", "127.0.0.1")
LAIXI_PORT = int(os.getenv("LAIXI_PORT", "22221"))  # Laixi WebSocket API 포트
LAIXI_PATH = os.getenv("LAIXI_PATH", r"C:\Program Files\Laixi\Laixi.exe")  # Self-Healing용

HEARTBEAT_INTERVAL = 30  # 30초마다 HEARTBEAT
RECONNECT_BASE = 5       # 재연결 기본 대기 (초)
RECONNECT_MAX = 60       # 재연결 최대 대기 (초)

# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("NodeRunner")

# ============================================================
# Laixi Client (최소화)
# ============================================================

class LaixiClient:
    """Laixi WebSocket Client - 로컬 디바이스 컨트롤"""
    
    def __init__(self):
        self.url = f"ws://{LAIXI_HOST}:{LAIXI_PORT}/"
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._lock = asyncio.Lock()
        self._devices: Dict[str, dict] = {}
        self._restart_count = 0
    
    async def connect(self) -> bool:
        """Laixi 연결"""
        try:
            # 핑/퐁으로 연결 상태 모니터링 (20초 간격, 10초 타임아웃)
            self._ws = await asyncio.wait_for(
                websockets.connect(
                    self.url, 
                    ping_interval=20,
                    ping_timeout=10
                ),
                timeout=5.0
            )
            await self._sync_devices()
            logger.info(f"Laixi 연결 ({len(self._devices)} devices)")
            return True
        except Exception as e:
            logger.warning(f"Laixi 연결 실패: {e}")
            return False
    
    async def ensure_connected(self) -> bool:
        """연결 보장 (Self-Healing 포함)"""
        if self.is_connected:
            return True
        
        # 연결 시도
        if await self.connect():
            return True
        
        # Self-Healing: Laixi 재시작
        logger.warning("Laixi Self-Healing 시작...")
        await self._restart_laixi()
        
        # 재연결 시도 (3회)
        for attempt in range(3):
            await asyncio.sleep(5)
            if await self.connect():
                logger.info("Laixi Self-Healing 성공!")
                return True
        
        logger.error("Laixi Self-Healing 실패")
        return False
    
    async def _restart_laixi(self):
        """Laixi 프로세스 재시작"""
        self._restart_count += 1
        logger.info(f"Laixi 재시작 시도 #{self._restart_count}")
        
        try:
            # 기존 Laixi 프로세스 종료
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/f", "/im", "Laixi.exe"], 
                             capture_output=True, timeout=10)
            else:
                subprocess.run(["pkill", "-f", "laixi"], 
                             capture_output=True, timeout=10)
            
            await asyncio.sleep(2)
            
            # Laixi 재시작
            if os.path.exists(LAIXI_PATH):
                subprocess.Popen([LAIXI_PATH], 
                               stdout=subprocess.DEVNULL, 
                               stderr=subprocess.DEVNULL)
                logger.info(f"Laixi 시작됨: {LAIXI_PATH}")
            else:
                logger.warning(f"Laixi 경로 없음: {LAIXI_PATH}")
                
        except Exception as e:
            logger.error(f"Laixi 재시작 실패: {e}")
    
    async def _sync_devices(self):
        """디바이스 목록 동기화"""
        resp = await self._send({"action": "List"})
        if resp and resp.get("StatusCode") == 200:
            # Laixi 응답: result가 JSON 문자열로 감싸져 있음
            result = resp.get("result", "[]")
            if isinstance(result, str):
                devices = json.loads(result)
            else:
                devices = result if result else []
            self._devices = {d.get("deviceId", ""): d for d in devices}
    
    async def _send(self, cmd: dict, timeout: float = 10.0) -> Optional[dict]:
        """Laixi 명령 전송"""
        if not self._ws:
            return None
        
        async with self._lock:
            try:
                await self._ws.send(json.dumps(cmd))
                resp = await asyncio.wait_for(self._ws.recv(), timeout=timeout)
                return json.loads(resp)
            except Exception as e:
                logger.error(f"Laixi 명령 실패: {e}")
                self._ws = None  # 연결 끊김 마킹
                return None
    
    @property
    def device_count(self) -> int:
        return len(self._devices)
    
    @property
    def is_connected(self) -> bool:
        return self._ws is not None and self._ws.open
    
    async def execute(self, action: str, device_id: str, params: dict) -> dict:
        """
        명령 실행 → Laixi 토스
        
        지원 Actions:
        - P0: list, watch, adb, tap, swipe
        - P1: scroll_up/down/left/right, home, back, screen_on/off, current_app
        - P2: screenshot, clipboard_set/get, toast, volume_up/down
        """
        import re
        from urllib.parse import urlparse
        
        # 디바이스 ID 처리
        target = device_id if device_id != "all" else ",".join(self._devices.keys())
        if not target:
            return {"success": False, "error": "No devices available"}
        
        # ==================== P0: 핵심 기능 ====================
        
        if action == "list":
            # 디바이스 목록
            await self._sync_devices()
            return {
                "success": True,
                "data": {
                    "count": self.device_count,
                    "devices": list(self._devices.keys()),
                    "details": list(self._devices.values())
                }
            }
        
        elif action == "watch":
            # YouTube 시청
            url = params.get("url", "")
            
            if not url:
                return {"success": False, "error": "URL is required"}
            
            try:
                parsed = urlparse(url)
                allowed_hosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']
                if parsed.scheme not in ('http', 'https'):
                    return {"success": False, "error": "Invalid URL scheme"}
                if parsed.netloc not in allowed_hosts:
                    return {"success": False, "error": f"Domain not allowed: {parsed.netloc}"}
            except Exception:
                return {"success": False, "error": "Invalid URL format"}
            
            safe_url = url.replace('"', '\\"').replace('`', '').replace('$', '').replace(';', '')
            
            cmd = {
                "action": "adb",
                "comm": {
                    "deviceIds": target,
                    "cmd": f'am start -a android.intent.action.VIEW -d "{safe_url}"'
                }
            }
            resp = await self._send(cmd)
            
            duration = params.get("duration", 30)
            if duration > 0:
                await asyncio.sleep(min(duration, 300))
            
            return {
                "success": resp is not None,
                "data": {"watched_sec": duration}
            }
        
        elif action == "adb":
            # ADB 명령 직접 실행 (화이트리스트)
            cmd_str = params.get("command", "")
            
            allowed_patterns = [
                r'^am start ', r'^am force-stop ',
                r'^input tap \d+ \d+$', r'^input swipe \d+ \d+ \d+ \d+',
                r'^input text ', r'^input keyevent \d+$',
                r'^pm list packages', r'^dumpsys ', r'^getprop ',
            ]
            blacklisted = ['su', 'rm ', 'rm -', 'reboot', '|', ';', '&&', '||', '`', '$(']
            
            cmd_lower = cmd_str.lower()
            for token in blacklisted:
                if token in cmd_lower:
                    return {"success": False, "error": f"Forbidden token: {token}"}
            
            is_allowed = any(re.match(pattern, cmd_str) for pattern in allowed_patterns)
            if not is_allowed:
                return {"success": False, "error": "Command not in allowed patterns"}
            
            resp = await self._send({
                "action": "adb",
                "comm": {"deviceIds": target, "cmd": cmd_str}
            })
            return {"success": resp is not None, "data": resp}
        
        elif action == "tap":
            # 화면 탭 (백분율 좌표 0.0-1.0)
            x, y = float(params.get("x", 0.5)), float(params.get("y", 0.5))
            
            # PointerEvent 사용 (백분율 지원)
            await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target,
                    "mask": "0",  # press
                    "x": str(x), "y": str(y),
                    "endx": "0", "endy": "0", "delta": "0"
                }
            })
            await asyncio.sleep(0.05)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target,
                    "mask": "2",  # release
                    "x": str(x), "y": str(y),
                    "endx": "0", "endy": "0", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        elif action == "swipe":
            # 스와이프 (백분율 좌표)
            x1, y1 = float(params.get("x1", 0.5)), float(params.get("y1", 0.7))
            x2, y2 = float(params.get("x2", 0.5)), float(params.get("y2", 0.3))
            duration_ms = int(params.get("duration", 300))
            
            await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "0",
                    "x": str(x1), "y": str(y1),
                    "endx": "0", "endy": "0", "delta": "0"
                }
            })
            await asyncio.sleep(0.05)
            await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "1",
                    "x": str(x2), "y": str(y2),
                    "endx": "0", "endy": "0", "delta": "0"
                }
            })
            await asyncio.sleep(duration_ms / 1000.0)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "2",
                    "x": str(x2), "y": str(y2),
                    "endx": "0", "endy": "0", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        # ==================== P1: 상호작용 기능 ====================
        
        elif action == "scroll_up":
            # 위로 스크롤 (PointerEvent mask=6)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "6",
                    "x": "0.5", "y": "0.5",
                    "endx": "0.5", "endy": "0.3", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        elif action == "scroll_down":
            # 아래로 스크롤 (PointerEvent mask=7)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "7",
                    "x": "0.5", "y": "0.5",
                    "endx": "0.5", "endy": "0.7", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        elif action == "scroll_left":
            # 왼쪽으로 스크롤 (PointerEvent mask=8)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "8",
                    "x": "0.5", "y": "0.5",
                    "endx": "0.2", "endy": "0.5", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        elif action == "scroll_right":
            # 오른쪽으로 스크롤 (PointerEvent mask=9)
            resp = await self._send({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": target, "mask": "9",
                    "x": "0.5", "y": "0.5",
                    "endx": "0.8", "endy": "0.5", "delta": "0"
                }
            })
            return {"success": resp is not None}
        
        elif action == "home":
            # 홈 버튼 (BasisOperate type=4)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "4"}
            })
            return {"success": resp is not None}
        
        elif action == "back":
            # 뒤로가기 (BasisOperate type=3)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "3"}
            })
            return {"success": resp is not None}
        
        elif action == "screen_on":
            # 화면 켜기 (BasisOperate type=15)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "15"}
            })
            return {"success": resp is not None}
        
        elif action == "screen_off":
            # 화면 끄기 (BasisOperate type=14)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "14"}
            })
            return {"success": resp is not None}
        
        elif action == "current_app":
            # 현재 앱 정보 (CurrentAppInfo)
            resp = await self._send({
                "action": "CurrentAppInfo",
                "comm": {"deviceIds": target}
            })
            if resp and resp.get("StatusCode") == 200:
                result = resp.get("result", "{}")
                if isinstance(result, str):
                    try:
                        result = json.loads(result)
                    except:
                        pass
                return {"success": True, "data": result}
            return {"success": False, "error": "Failed to get current app"}
        
        # ==================== P2: 고급 기능 ====================
        
        elif action == "screenshot":
            # 스크린샷 (screen)
            save_path = params.get("save_path", "d:\\screenshots")
            resp = await self._send({
                "action": "screen",
                "comm": {"deviceIds": target, "savePath": save_path}
            })
            return {"success": resp is not None, "data": {"path": save_path}}
        
        elif action == "clipboard_set":
            # 클립보드 쓰기 (writeclipboard) - 한글 지원
            text = params.get("text", "")
            resp = await self._send({
                "action": "writeclipboard",
                "comm": {"deviceIds": target, "content": text}
            })
            return {"success": resp is not None}
        
        elif action == "clipboard_get":
            # 클립보드 읽기 (getclipboard) - 단일 디바이스만
            resp = await self._send({
                "action": "getclipboard",
                "comm": {"deviceIds": target}
            })
            if resp:
                content = resp.get("content", resp.get("result", ""))
                return {"success": True, "data": {"content": content}}
            return {"success": False, "error": "Failed to get clipboard"}
        
        elif action == "toast":
            # Toast 메시지 (Toast)
            message = params.get("message", "DoAi.Me")
            resp = await self._send({
                "action": "Toast",
                "comm": {"deviceIds": target, "content": message}
            })
            return {"success": resp is not None}
        
        elif action == "volume_up":
            # 볼륨 증가 (BasisOperate type=1)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "1"}
            })
            return {"success": resp is not None}
        
        elif action == "volume_down":
            # 볼륨 감소 (BasisOperate type=2)
            resp = await self._send({
                "action": "BasisOperate",
                "comm": {"deviceIds": target, "type": "2"}
            })
            return {"success": resp is not None}
        
        elif action == "launch_app":
            # 앱 실행 (패키지명)
            package = params.get("package", "")
            if not package:
                return {"success": False, "error": "Package name required"}
            resp = await self._send({
                "action": "adb",
                "comm": {
                    "deviceIds": target,
                    "cmd": f"monkey -p {package} -c android.intent.category.LAUNCHER 1"
                }
            })
            return {"success": resp is not None}
        
        elif action == "force_stop":
            # 앱 강제 종료
            package = params.get("package", "")
            if not package:
                return {"success": False, "error": "Package name required"}
            resp = await self._send({
                "action": "adb",
                "comm": {
                    "deviceIds": target,
                    "cmd": f"am force-stop {package}"
                }
            })
            return {"success": resp is not None}
        
        elif action == "keyevent":
            # 키 이벤트 (input keyevent)
            keycode = int(params.get("keycode", 0))
            resp = await self._send({
                "action": "adb",
                "comm": {
                    "deviceIds": target,
                    "cmd": f"input keyevent {keycode}"
                }
            })
            return {"success": resp is not None}
        
        else:
            return {"success": False, "error": f"Unknown action: {action}"}


# ============================================================
# NodeRunner (The Muscle)
# ============================================================

class NodeRunner:
    """Central 서버와 연결, 명령 수신, Laixi 실행"""
    
    def __init__(self):
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._laixi = LaixiClient()
        self._reconnect_delay = RECONNECT_BASE
        self._running = True
        self._start_time = time.time()
    
    async def run(self):
        """메인 루프 - 무한 재접속"""
        logger.info(f"NodeRunner 시작: {NODE_ID}")
        logger.info(f"Central: {CENTRAL_URL}")
        logger.info(f"Laixi: ws://{LAIXI_HOST}:{LAIXI_PORT}")
        
        while self._running:
            try:
                await self._connect_and_run()
            except ConnectionClosed as e:
                logger.warning(f"연결 끊김: {e}")
            except Exception as e:
                logger.error(f"에러: {e}")
            
            if self._running:
                logger.info(f"{self._reconnect_delay}초 후 재연결...")
                await asyncio.sleep(self._reconnect_delay)
                # Exponential Backoff
                self._reconnect_delay = min(self._reconnect_delay * 2, RECONNECT_MAX)
    
    async def _connect_and_run(self):
        """연결 후 메시지 처리"""
        logger.info("Central 연결 중...")
        
        # Laixi 먼저 연결
        await self._laixi.ensure_connected()
        
        # Central 연결
        self._ws = await asyncio.wait_for(
            websockets.connect(CENTRAL_URL, ping_interval=20, ping_timeout=10),
            timeout=30.0
        )
        
        # HELLO 전송
        await self._ws.send(json.dumps({
            "type": "HELLO",
            "node_id": NODE_ID,
            "device_count": self._laixi.device_count
        }))
        
        # HELLO_ACK 대기
        resp = await asyncio.wait_for(self._ws.recv(), timeout=10.0)
        data = json.loads(resp)
        
        if data.get("type") != "HELLO_ACK":
            logger.error(f"HELLO_ACK 실패: {data}")
            return
        
        logger.info("Central 연결 완료!")
        self._reconnect_delay = RECONNECT_BASE  # 재연결 딜레이 리셋
        
        # Heartbeat 태스크 시작
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
        try:
            # 메시지 수신 루프
            async for message in self._ws:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError:
                    logger.error("JSON 파싱 실패")
        finally:
            heartbeat_task.cancel()
    
    async def _handle_message(self, data: dict):
        """메시지 처리"""
        msg_type = data.get("type")
        
        if msg_type == "COMMAND":
            # 명령 실행
            asyncio.create_task(self._execute_command(data))
        
        elif msg_type == "HEARTBEAT_ACK":
            logger.debug("HEARTBEAT_ACK 수신")
        
        else:
            logger.warning(f"알 수 없는 메시지: {msg_type}")
    
    async def _execute_command(self, data: dict):
        """명령 실행 → RESULT 전송"""
        command_id = data.get("command_id", "unknown")
        action = data.get("action", "")
        device_id = data.get("device_id", "all")
        params = data.get("params", {})
        
        logger.info(f"명령 수신: {action} (device={device_id})")
        
        # Laixi 연결 확인 (Self-Healing)
        if not await self._laixi.ensure_connected():
            await self._send_result(command_id, False, error="Laixi 연결 실패")
            return
        
        try:
            # Laixi에 명령 토스
            result = await self._laixi.execute(action, device_id, params)
            
            await self._send_result(
                command_id,
                result.get("success", False),
                data=result.get("data"),
                error=result.get("error")
            )
            
        except Exception as e:
            logger.error(f"명령 실행 실패: {e}")
            await self._send_result(command_id, False, error=str(e))
    
    async def _send_result(self, command_id: str, success: bool, 
                          data: dict = None, error: str = None):
        """결과 전송"""
        result = {
            "type": "RESULT",
            "command_id": command_id,
            "success": success
        }
        if data:
            result["data"] = data
        if error:
            result["error"] = error
        
        try:
            await self._ws.send(json.dumps(result))
            logger.info(f"RESULT 전송: {command_id} success={success}")
        except Exception as e:
            logger.error(f"RESULT 전송 실패: {e}")
    
    async def _heartbeat_loop(self):
        """30초마다 확장된 HEARTBEAT 전송"""
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                
                # 디바이스 상태 갱신
                if self._laixi.is_connected:
                    await self._laixi._sync_devices()
                
                # 확장된 HEARTBEAT 전송
                heartbeat = {
                    "type": "HEARTBEAT",
                    "node_id": NODE_ID,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "metrics": {
                        "device_count": self._laixi.device_count,
                        "laixi_connected": self._laixi.is_connected,
                        "uptime_sec": int(time.time() - self._start_time),
                        "laixi_restarts": self._laixi._restart_count
                    },
                    "devices": [
                        {
                            "id": d.get("deviceId", ""),
                            "no": d.get("no", 0),
                            "name": d.get("name", ""),
                            "is_otg": d.get("isOtg", False)
                        }
                        for d in self._laixi._devices.values()
                    ]
                }
                await self._ws.send(json.dumps(heartbeat))
                logger.debug(f"HEARTBEAT (devices={self._laixi.device_count})")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"HEARTBEAT 실패: {e}")
                break


# ============================================================
# Health Server (로컬 모니터링용)
# ============================================================

async def start_health_server(runner: NodeRunner):
    """로컬 헬스체크 서버"""
    try:
        from aiohttp import web
        
        async def health(request):
            return web.json_response({
                "status": "ok" if runner._ws else "disconnected",
                "node_id": NODE_ID,
                "central_connected": runner._ws is not None,
                "laixi_connected": runner._laixi.is_connected,
                "device_count": runner._laixi.device_count,
                "uptime": int(time.time() - runner._start_time)
            })
        
        app = web.Application()
        app.router.add_get("/health", health)
        
        web_runner = web.AppRunner(app)
        await web_runner.setup()
        site = web.TCPSite(web_runner, "0.0.0.0", 9999)
        await site.start()
        logger.info("Health: http://localhost:9999/health")
        
    except ImportError:
        logger.warning("aiohttp 없음, health server 비활성화")
    except Exception as e:
        logger.warning(f"Health server 실패: {e}")


# ============================================================
# Main
# ============================================================

async def main():
    """메인 함수"""
    global CENTRAL_URL
    
    # 로컬 테스트 모드
    if "--local" in sys.argv:
        CENTRAL_URL = "ws://localhost:8000/ws/node"
        logger.info("=== LOCAL TEST MODE ===")
    
    runner = NodeRunner()
    await start_health_server(runner)
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("종료 요청")
        runner._running = False


if __name__ == "__main__":
    asyncio.run(main())
