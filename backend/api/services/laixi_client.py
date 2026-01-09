"""
🤖 DoAi.Me - Laixi WebSocket Client
Laixi 제어 서버와의 WebSocket 통신을 담당하는 클라이언트

왜 이 구조인가?
- Laixi는 WebSocket으로 Android 기기들을 제어
- ADB 명령, 터치 이벤트, 클립보드 등 모든 제어가 여기를 통해 이루어짐
- 비동기 처리로 다수의 기기를 동시 제어 가능
"""

import asyncio
import json
from typing import Optional, Dict, Any, List, Union
from loguru import logger

try:
    import websockets
except ImportError:
    logger.warning("websockets 모듈이 설치되지 않음. pip install websockets 필요")
    websockets = None


class LaixiClient:
    """
    Laixi WebSocket 클라이언트
    
    S9 기기 제어를 위한 모든 Laixi API 호출을 래핑
    """
    
    # 기본 설정
    DEFAULT_WS_URL = "ws://127.0.0.1:22221/"
    RESPONSE_TIMEOUT = 30.0
    
    def __init__(self, ws_url: str = None):
        """
        Args:
            ws_url: Laixi WebSocket 서버 URL (기본값: ws://127.0.0.1:22221/)
        """
        self.ws_url = ws_url or self.DEFAULT_WS_URL
        self.ws: Optional[Any] = None
        self._lock = asyncio.Lock()
    
    async def connect(self) -> bool:
        """
        WebSocket 연결 수립
        
        Returns:
            연결 성공 여부
        """
        if websockets is None:
            logger.error("websockets 모듈이 설치되지 않음")
            return False
        
        try:
            self.ws = await websockets.connect(
                self.ws_url,
                ping_interval=20,
                ping_timeout=10
            )
            logger.info(f"Laixi 연결 성공: {self.ws_url}")
            return True
        except Exception as e:
            logger.error(f"Laixi 연결 실패: {e}")
            return False
    
    async def disconnect(self) -> None:
        """WebSocket 연결 종료"""
        if self.ws:
            try:
                await self.ws.close()
                logger.info("Laixi 연결 종료")
            except Exception as e:
                logger.warning(f"연결 종료 중 오류: {e}")
            finally:
                self.ws = None
    
    async def ensure_connected(self) -> bool:
        """연결 상태 확인 및 필요시 재연결"""
        if self.ws is None or self.ws.closed:
            return await self.connect()
        return True
    
    async def send(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Laixi 서버로 메시지 전송 및 응답 수신
        
        Args:
            message: 전송할 JSON 메시지
            
        Returns:
            서버 응답 (JSON 파싱됨)
        """
        async with self._lock:
            if not await self.ensure_connected():
                return {"error": "연결 실패", "success": False}
            
            try:
                await self.ws.send(json.dumps(message))
                response = await asyncio.wait_for(
                    self.ws.recv(),
                    timeout=self.RESPONSE_TIMEOUT
                )
                return json.loads(response)
            except asyncio.TimeoutError:
                logger.error("Laixi 응답 타임아웃")
                return {"error": "응답 타임아웃", "success": False}
            except Exception as e:
                logger.error(f"Laixi 통신 오류: {e}")
                return {"error": str(e), "success": False}
    
    # ==================== ADB 명령 ====================
    
    async def adb(
        self, 
        command: str, 
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        ADB 명령 실행
        
        Args:
            command: ADB 명령어 (예: "input tap 100 200")
            device_ids: 대상 기기 ID ("all" 또는 특정 ID)
            
        Returns:
            명령 실행 결과
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        logger.debug(f"ADB 명령: {command} -> {device_ids}")
        
        return await self.send({
            "action": "adb",
            "comm": {
                "command": command,
                "deviceIds": device_ids
            }
        })
    
    # ==================== 터치 이벤트 ====================
    
    async def tap(
        self, 
        x: float, 
        y: float, 
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        화면 탭 (터치 후 릴리즈)
        
        Args:
            x: X 좌표 (0.0 ~ 1.0 백분율 또는 픽셀 값)
            y: Y 좌표 (0.0 ~ 1.0 백분율 또는 픽셀 값)
            device_ids: 대상 기기 ID
            
        Returns:
            실행 결과
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        logger.debug(f"탭: ({x}, {y}) -> {device_ids}")
        
        # Press (mask=0)
        await self.send({
            "action": "pointerEvent",
            "comm": {
                "deviceIds": device_ids,
                "mask": "0",
                "x": str(x),
                "y": str(y),
                "endx": "0",
                "endy": "0",
                "delta": "0"
            }
        })
        
        await asyncio.sleep(0.05)
        
        # Release (mask=2)
        result = await self.send({
            "action": "pointerEvent",
            "comm": {
                "deviceIds": device_ids,
                "mask": "2",
                "x": str(x),
                "y": str(y),
                "endx": "0",
                "endy": "0",
                "delta": "0"
            }
        })
        
        return result
    
    async def swipe(
        self,
        start_x: float,
        start_y: float,
        end_x: float,
        end_y: float,
        duration_ms: int = 500,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        스와이프 제스처 실행
        
        Args:
            start_x, start_y: 시작 좌표
            end_x, end_y: 끝 좌표
            duration_ms: 스와이프 지속 시간 (밀리초)
            device_ids: 대상 기기 ID
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        command = f"input swipe {int(start_x)} {int(start_y)} {int(end_x)} {int(end_y)} {duration_ms}"
        return await self.adb(command, device_ids)
    
    async def long_press(
        self,
        x: float,
        y: float,
        duration_ms: int = 1000,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        롱 프레스 (길게 누르기)
        
        Args:
            x, y: 좌표
            duration_ms: 누르고 있을 시간 (밀리초)
            device_ids: 대상 기기 ID
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        command = f"input swipe {int(x)} {int(y)} {int(x)} {int(y)} {duration_ms}"
        return await self.adb(command, device_ids)
    
    # ==================== 클립보드 ====================
    
    async def clipboard_write(
        self, 
        content: str, 
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        클립보드에 텍스트 쓰기
        
        Args:
            content: 클립보드에 저장할 텍스트
            device_ids: 대상 기기 ID
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        logger.debug(f"클립보드 쓰기: {content[:20]}... -> {device_ids}")
        
        return await self.send({
            "action": "writeclipboard",
            "comm": {
                "deviceIds": device_ids,
                "content": content
            }
        })
    
    async def paste(
        self, 
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        붙여넣기 실행 (KEYCODE_PASTE = 279)
        
        Args:
            device_ids: 대상 기기 ID
        """
        return await self.adb("input keyevent 279", device_ids)
    
    # ==================== 키 이벤트 ====================
    
    async def key_event(
        self,
        keycode: int,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        키 이벤트 전송
        
        Args:
            keycode: Android 키코드 (예: 4=Back, 3=Home)
            device_ids: 대상 기기 ID
        """
        return await self.adb(f"input keyevent {keycode}", device_ids)
    
    async def press_back(self, device_ids: Union[str, List[str]] = "all") -> Dict[str, Any]:
        """뒤로 가기 버튼"""
        return await self.key_event(4, device_ids)
    
    async def press_home(self, device_ids: Union[str, List[str]] = "all") -> Dict[str, Any]:
        """홈 버튼"""
        return await self.key_event(3, device_ids)
    
    async def press_enter(self, device_ids: Union[str, List[str]] = "all") -> Dict[str, Any]:
        """엔터 키"""
        return await self.key_event(66, device_ids)
    
    # ==================== 기기 관리 ====================
    
    async def get_device_list(self) -> Dict[str, Any]:
        """
        연결된 기기 목록 조회
        
        Returns:
            기기 목록 {"devices": [...]}
        """
        logger.debug("기기 목록 조회")
        return await self.send({"action": "List"})
    
    async def take_screenshot(
        self,
        device_ids: Union[str, List[str]] = "all",
        save_path: str = None
    ) -> Dict[str, Any]:
        """
        스크린샷 촬영
        
        Args:
            device_ids: 대상 기기 ID
            save_path: 저장 경로 (선택)
        """
        if isinstance(device_ids, list):
            device_ids = ",".join(device_ids)
        
        message = {
            "action": "screen",
            "comm": {
                "deviceIds": device_ids
            }
        }
        
        if save_path:
            message["comm"]["savePath"] = save_path
        
        return await self.send(message)
    
    # ==================== 앱 제어 ====================
    
    async def start_activity(
        self,
        action: str,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        Android Activity 시작
        
        Args:
            action: Intent action (예: "android.settings.WIFI_SETTINGS")
            device_ids: 대상 기기 ID
        """
        command = f"am start -a {action}"
        return await self.adb(command, device_ids)
    
    async def launch_app(
        self,
        package_name: str,
        activity_name: str = None,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        앱 실행
        
        Args:
            package_name: 패키지 이름 (예: "com.ss.android.ugc.trill")
            activity_name: Activity 이름 (선택)
            device_ids: 대상 기기 ID
        """
        if activity_name:
            command = f"am start -n {package_name}/{activity_name}"
        else:
            command = f"monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
        
        return await self.adb(command, device_ids)
    
    async def force_stop_app(
        self,
        package_name: str,
        device_ids: Union[str, List[str]] = "all"
    ) -> Dict[str, Any]:
        """
        앱 강제 종료
        
        Args:
            package_name: 패키지 이름
            device_ids: 대상 기기 ID
        """
        command = f"am force-stop {package_name}"
        return await self.adb(command, device_ids)
    
    # ==================== 시스템 정보 ====================
    
    async def get_wifi_info(
        self,
        device_id: str
    ) -> Dict[str, Any]:
        """
        WiFi 연결 정보 조회
        
        Args:
            device_id: 기기 ID (단일 기기만 가능)
            
        Returns:
            WiFi 정보 (SSID, IP 등)
        """
        result = await self.adb(
            "dumpsys wifi | grep mWifiInfo",
            device_id
        )
        return result
    
    async def get_battery_info(
        self,
        device_id: str
    ) -> Dict[str, Any]:
        """
        배터리 정보 조회
        
        Args:
            device_id: 기기 ID
        """
        result = await self.adb(
            "dumpsys battery | grep level",
            device_id
        )
        return result


# ==================== 싱글톤 인스턴스 ====================

_laixi_client: Optional[LaixiClient] = None


def get_laixi_client() -> LaixiClient:
    """
    Laixi 클라이언트 싱글톤 인스턴스 반환
    
    왜 싱글톤인가?
    - WebSocket 연결은 비용이 크므로 재사용
    - 하나의 연결로 모든 요청 처리
    """
    global _laixi_client
    if _laixi_client is None:
        _laixi_client = LaixiClient()
    return _laixi_client

