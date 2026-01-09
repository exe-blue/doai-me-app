"""
Laixi Driver - 임시 하드웨어 드라이버 (Temporary Driver)

Orion의 지시: "지금 당장 그들의 몸(Laixi)을 빌려, 우리의 영혼(Behavior)을 주입해라."

Strangler Pattern:
- 이 드라이버는 Laixi WebSocket API를 래핑합니다
- 향후 ScrcpyDriver로 교체해도 시스템 전체가 영향받지 않습니다
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, List

from .device_driver import (
    DeviceDriver, DriverType, DeviceInfo,
    TapResult, SwipeResult, TextResult
)

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

logger = logging.getLogger(__name__)


class LaixiDriver(DeviceDriver):
    """
    Laixi WebSocket API 드라이버
    
    Laixi 앱(touping.exe)과 WebSocket으로 통신하여 Android 기기를 제어합니다.
    포트: ws://127.0.0.1:22221/
    좌표계: 백분율 (0.0 ~ 1.0)
    """
    
    def __init__(
        self,
        websocket_url: str = "ws://127.0.0.1:22221/",
        timeout: float = 10.0,
        reconnect_interval: float = 5.0,
        max_reconnect_attempts: int = 3
    ):
        if not HAS_WEBSOCKETS:
            raise ImportError("websockets 모듈이 필요합니다: pip install websockets")
        
        self.websocket_url = websocket_url
        self.timeout = timeout
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        
        self._websocket: Optional[Any] = None
        self._lock = asyncio.Lock()
        self._connected_devices: Dict[str, DeviceInfo] = {}
    
    @property
    def driver_type(self) -> DriverType:
        return DriverType.LAIXI
    
    # ==================== 연결 관리 ====================
    
    async def _ensure_websocket(self) -> bool:
        """WebSocket 연결 확인 및 재연결"""
        if self._websocket and not self._websocket.closed:
            return True
        
        for attempt in range(self.max_reconnect_attempts):
            try:
                logger.info(f"Laixi 연결 시도 ({attempt + 1}/{self.max_reconnect_attempts})")
                self._websocket = await asyncio.wait_for(
                    websockets.connect(self.websocket_url),
                    timeout=self.timeout
                )
                logger.info(f"Laixi 연결 성공: {self.websocket_url}")
                return True
            except Exception as e:
                logger.error(f"Laixi 연결 실패: {e}")
                await asyncio.sleep(self.reconnect_interval)
        
        return False
    
    async def _send_command(self, command: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Laixi에 명령 전송"""
        async with self._lock:
            if not await self._ensure_websocket():
                logger.error("Laixi 연결되지 않음")
                return None
            
            try:
                await self._websocket.send(json.dumps(command))
                response_text = await asyncio.wait_for(
                    self._websocket.recv(),
                    timeout=self.timeout
                )
                return json.loads(response_text)
            except asyncio.TimeoutError:
                logger.warning("명령 타임아웃")
                return None
            except Exception as e:
                logger.error(f"명령 실패: {e}")
                self._websocket = None
                return None
    
    async def connect(self, device_id: str) -> bool:
        """Laixi WebSocket 서버에 연결"""
        if await self._ensure_websocket():
            # 디바이스 목록 갱신
            devices = await self.list_devices()
            if device_id == "all":
                return len(devices) > 0
            return any(d.device_id == device_id for d in devices)
        return False
    
    async def disconnect(self, device_id: str) -> bool:
        """연결 해제"""
        if device_id in self._connected_devices:
            del self._connected_devices[device_id]
        
        # 모든 디바이스가 해제되면 WebSocket도 닫기
        if not self._connected_devices and self._websocket:
            await self._websocket.close()
            self._websocket = None
            logger.info("Laixi 연결 종료")
        return True
    
    async def list_devices(self) -> List[DeviceInfo]:
        """연결된 모든 디바이스 목록"""
        response = await self._send_command({"action": "List"})
        
        if not response or "devices" not in response:
            return []
        
        devices = []
        for device in response["devices"]:
            device_id = device.get("id") or device.get("serial", "unknown")
            info = DeviceInfo(
                device_id=device_id,
                model=device.get("model"),
                screen_width=device.get("width", 1080),
                screen_height=device.get("height", 2280),
                is_connected=True,
                extra=device
            )
            devices.append(info)
            self._connected_devices[device_id] = info
        
        return devices
    
    # ==================== 터치 입력 ====================
    
    async def tap(
        self,
        device_id: str,
        x: float,
        y: float,
        duration_ms: int = 100
    ) -> TapResult:
        """
        화면 탭 (백분율 좌표)
        
        Laixi PointerEvent:
        - mask: "0" = press, "1" = move, "2" = release
        """
        try:
            # Press
            await self._send_command({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": device_id,
                    "mask": "0",
                    "x": str(x),
                    "y": str(y),
                    "endx": "0",
                    "endy": "0",
                    "delta": "0"
                }
            })
            
            # 터치 지속 시간
            await asyncio.sleep(duration_ms / 1000.0)
            
            # Release
            response = await self._send_command({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": device_id,
                    "mask": "2",
                    "x": str(x),
                    "y": str(y),
                    "endx": "0",
                    "endy": "0",
                    "delta": "0"
                }
            })
            
            return TapResult(
                success=response is not None,
                actual_x=x,
                actual_y=y,
                duration_ms=duration_ms
            )
        except Exception as e:
            return TapResult(
                success=False,
                actual_x=x,
                actual_y=y,
                duration_ms=duration_ms,
                error=str(e)
            )
    
    async def swipe(
        self,
        device_id: str,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        duration_ms: int = 300
    ) -> SwipeResult:
        """
        화면 스와이프 (백분율 좌표)
        
        Smoothstep 이징으로 자연스러운 스와이프
        """
        try:
            path = []
            steps = max(int(duration_ms / 16), 5)  # ~60fps
            
            # Press at start
            await self._send_command({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": device_id,
                    "mask": "0",
                    "x": str(x1),
                    "y": str(y1),
                    "endx": "0",
                    "endy": "0",
                    "delta": "0"
                }
            })
            path.append({"x": x1, "y": y1, "t": 0})
            
            # Move with smoothstep easing
            for i in range(1, steps):
                t = i / steps
                # Smoothstep: t * t * (3 - 2 * t)
                ease_t = t * t * (3 - 2 * t)
                
                current_x = x1 + (x2 - x1) * ease_t
                current_y = y1 + (y2 - y1) * ease_t
                
                await self._send_command({
                    "action": "PointerEvent",
                    "comm": {
                        "deviceIds": device_id,
                        "mask": "1",
                        "x": str(current_x),
                        "y": str(current_y),
                        "endx": "0",
                        "endy": "0",
                        "delta": "0"
                    }
                })
                path.append({"x": current_x, "y": current_y, "t": int((duration_ms * i) / steps)})
                
                await asyncio.sleep(duration_ms / steps / 1000.0)
            
            # Release at end
            response = await self._send_command({
                "action": "PointerEvent",
                "comm": {
                    "deviceIds": device_id,
                    "mask": "2",
                    "x": str(x2),
                    "y": str(y2),
                    "endx": "0",
                    "endy": "0",
                    "delta": "0"
                }
            })
            path.append({"x": x2, "y": y2, "t": duration_ms})
            
            return SwipeResult(
                success=response is not None,
                path=path,
                duration_ms=duration_ms
            )
        except Exception as e:
            return SwipeResult(
                success=False,
                path=[],
                duration_ms=duration_ms,
                error=str(e)
            )
    
    async def text(
        self,
        device_id: str,
        content: str,
        use_clipboard: bool = True
    ) -> TextResult:
        """
        텍스트 입력 (클립보드 사용으로 한글 지원)
        """
        try:
            if use_clipboard:
                # 클립보드에 텍스트 쓰기
                await self._send_command({
                    "action": "writeclipboard",
                    "comm": {
                        "deviceIds": device_id,
                        "content": content
                    }
                })
                
                # 붙여넣기 (Ctrl+V / keycode 279)
                await self.execute_adb(device_id, "input keyevent 279")
            else:
                # 직접 입력 (영어만)
                await self.execute_adb(device_id, f"input text '{content}'")
            
            return TextResult(
                success=True,
                typed_text=content
            )
        except Exception as e:
            return TextResult(
                success=False,
                typed_text="",
                error=str(e)
            )
    
    async def execute_adb(self, device_id: str, command: str) -> bool:
        """ADB 명령 실행"""
        response = await self._send_command({
            "action": "adb",
            "comm": {
                "command": command,
                "deviceIds": device_id
            }
        })
        return response is not None
    
    async def screenshot(
        self,
        device_id: str,
        save_path: Optional[str] = None
    ) -> Optional[bytes]:
        """스크린샷 캡처"""
        if save_path:
            await self._send_command({
                "action": "screen",
                "comm": {
                    "deviceIds": device_id,
                    "savePath": save_path
                }
            })
            # Laixi는 파일로만 저장, 바이트 반환 불가
            return None
        
        # 바이트 반환 필요 시 ADB screencap 사용
        # TODO: 구현 필요
        return None
    
    # ==================== Laixi 전용 메서드 ====================
    
    async def basis_operate(self, device_id: str, operation_type: int) -> bool:
        """
        기본 작업 실행
        
        operation_type:
        - 1: Volume Up
        - 2: Volume Down
        - 3: Back
        - 4: Home
        - 14: Screen Off
        - 15: Screen On
        """
        response = await self._send_command({
            "action": "BasisOperate",
            "comm": {
                "deviceIds": device_id,
                "type": str(operation_type)
            }
        })
        return response is not None
    
    async def press_home(self, device_id: str) -> bool:
        """홈 버튼 (Laixi 네이티브)"""
        return await self.basis_operate(device_id, 4)
    
    async def press_back(self, device_id: str) -> bool:
        """뒤로가기 (Laixi 네이티브)"""
        return await self.basis_operate(device_id, 3)
    
    async def screen_on(self, device_id: str) -> bool:
        """화면 켜기"""
        return await self.basis_operate(device_id, 15)
    
    async def screen_off(self, device_id: str) -> bool:
        """화면 끄기"""
        return await self.basis_operate(device_id, 14)
    
    async def show_toast(self, device_id: str, message: str) -> bool:
        """Toast 메시지 표시"""
        response = await self._send_command({
            "action": "Toast",
            "comm": {
                "deviceIds": device_id,
                "content": message
            }
        })
        return response is not None
    
    async def get_current_app(self, device_id: str) -> Optional[Dict]:
        """현재 활성 앱 정보"""
        return await self._send_command({
            "action": "CurrentAppInfo",
            "comm": {
                "deviceIds": device_id
            }
        })
    
    async def quick_swipe(
        self,
        device_id: str,
        direction: str
    ) -> bool:
        """
        빠른 스와이프 (Laixi 네이티브)
        
        direction: "up", "down", "left", "right"
        """
        mask_map = {
            "up": "6",
            "down": "7",
            "left": "8",
            "right": "9"
        }
        
        if direction not in mask_map:
            return False
        
        response = await self._send_command({
            "action": "PointerEvent",
            "comm": {
                "deviceIds": device_id,
                "mask": mask_map[direction],
                "x": "0.5",
                "y": "0.5",
                "endx": "0",
                "endy": "0",
                "delta": "2"
            }
        })
        return response is not None

