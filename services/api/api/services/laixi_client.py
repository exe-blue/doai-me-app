"""
🤖 DoAi.Me - Laixi WebSocket Client
Laixi 제어 서버와의 WebSocket 통신을 담당하는 클라이언트

왜 이 구조인가?
- Laixi는 WebSocket으로 Android 기기들을 제어
- ADB 명령, 터치 이벤트, 클립보드 등 모든 제어가 여기를 통해 이루어짐
- 비동기 처리로 다수의 기기를 동시 제어 가능

PR #2 Features:
- 지수 백오프 재연결 (1초 → 2초 → 4초 → 최대 30초)
- 연결 상태 메트릭 수집
- 연결/끊김 콜백 훅 지원
"""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, List, Union, Callable, Awaitable
from loguru import logger

try:
    import websockets
except ImportError:
    logger.warning("websockets 모듈이 설치되지 않음. pip install websockets 필요")
    websockets = None


@dataclass
class LaixiConnectionMetrics:
    """Laixi 연결 상태 메트릭"""

    # 연결 카운터
    connection_attempts: int = 0
    connection_successes: int = 0
    connection_failures: int = 0
    connection_lost_count: int = 0
    reconnect_success_count: int = 0

    # 현재 상태
    is_connected: bool = False
    last_connected_at: Optional[datetime] = None
    last_disconnected_at: Optional[datetime] = None
    last_error: Optional[str] = None

    # 연속 실패 카운터 (백오프 계산용)
    consecutive_failures: int = 0

    def record_connection_attempt(self) -> None:
        """연결 시도 기록"""
        self.connection_attempts += 1

    def record_connection_success(self, is_reconnect: bool = False) -> None:
        """연결 성공 기록"""
        self.connection_successes += 1
        self.is_connected = True
        self.last_connected_at = datetime.now()
        self.consecutive_failures = 0
        self.last_error = None
        if is_reconnect:
            self.reconnect_success_count += 1

    def record_connection_failure(self, error: str) -> None:
        """연결 실패 기록"""
        self.connection_failures += 1
        self.consecutive_failures += 1
        self.last_error = error

    def record_connection_lost(self) -> None:
        """연결 끊김 기록"""
        self.connection_lost_count += 1
        self.is_connected = False
        self.last_disconnected_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "connection_attempts": self.connection_attempts,
            "connection_successes": self.connection_successes,
            "connection_failures": self.connection_failures,
            "connection_lost_count": self.connection_lost_count,
            "reconnect_success_count": self.reconnect_success_count,
            "is_connected": self.is_connected,
            "last_connected_at": self.last_connected_at.isoformat() if self.last_connected_at else None,
            "last_disconnected_at": self.last_disconnected_at.isoformat() if self.last_disconnected_at else None,
            "last_error": self.last_error,
            "consecutive_failures": self.consecutive_failures,
        }


# 콜백 타입 정의
ConnectionCallback = Callable[["LaixiClient", str], Awaitable[None]]


class LaixiClient:
    """
    Laixi WebSocket 클라이언트

    S9 기기 제어를 위한 모든 Laixi API 호출을 래핑

    Features:
    - 지수 백오프 재연결 (1초 → 2초 → 4초 → 최대 30초)
    - 연결 상태 메트릭 수집
    - 연결/끊김 콜백 훅 지원
    """

    # 기본 설정
    DEFAULT_WS_URL = "ws://127.0.0.1:22221/"
    RESPONSE_TIMEOUT = 30.0

    # 지수 백오프 설정
    BACKOFF_BASE = 1.0  # 초기 대기 시간 (초)
    BACKOFF_MULTIPLIER = 2.0  # 배수
    BACKOFF_MAX = 30.0  # 최대 대기 시간 (초)
    MAX_RECONNECT_ATTEMPTS = 10  # 최대 재연결 시도 횟수 (0 = 무한)

    def __init__(self, ws_url: str = None):
        """
        Args:
            ws_url: Laixi WebSocket 서버 URL (기본값: ws://127.0.0.1:22221/)
        """
        self.ws_url = ws_url or self.DEFAULT_WS_URL
        self.ws: Optional[Any] = None
        self._lock = asyncio.Lock()

        # 메트릭
        self._metrics = LaixiConnectionMetrics()

        # 콜백 훅
        self._on_connected_callbacks: List[ConnectionCallback] = []
        self._on_disconnected_callbacks: List[ConnectionCallback] = []
        self._on_reconnect_failed_callbacks: List[ConnectionCallback] = []

        # 재연결 상태
        self._is_reconnecting = False

    @property
    def metrics(self) -> LaixiConnectionMetrics:
        """연결 메트릭 조회"""
        return self._metrics

    def get_metrics(self) -> Dict[str, Any]:
        """메트릭을 딕셔너리로 반환"""
        return self._metrics.to_dict()

    # ==================== 콜백 훅 등록 ====================

    def on_connected(self, callback: ConnectionCallback) -> None:
        """연결 성공 시 호출될 콜백 등록"""
        self._on_connected_callbacks.append(callback)

    def on_disconnected(self, callback: ConnectionCallback) -> None:
        """연결 끊김 시 호출될 콜백 등록"""
        self._on_disconnected_callbacks.append(callback)

    def on_reconnect_failed(self, callback: ConnectionCallback) -> None:
        """재연결 실패 시 호출될 콜백 등록"""
        self._on_reconnect_failed_callbacks.append(callback)

    async def _fire_callbacks(
        self, callbacks: List[ConnectionCallback], event: str
    ) -> None:
        """콜백 실행"""
        for callback in callbacks:
            try:
                await callback(self, event)
            except Exception as e:
                logger.warning(f"콜백 실행 중 오류 ({event}): {e}")

    # ==================== 연결 관리 ====================

    def _calculate_backoff(self) -> float:
        """지수 백오프 대기 시간 계산"""
        failures = self._metrics.consecutive_failures
        delay = self.BACKOFF_BASE * (self.BACKOFF_MULTIPLIER ** failures)
        return min(delay, self.BACKOFF_MAX)

    async def connect(self) -> bool:
        """
        WebSocket 연결 수립

        Returns:
            연결 성공 여부
        """
        if websockets is None:
            logger.error("websockets 모듈이 설치되지 않음")
            return False

        self._metrics.record_connection_attempt()

        try:
            self.ws = await websockets.connect(
                self.ws_url,
                ping_interval=20,
                ping_timeout=10
            )
            self._metrics.record_connection_success(is_reconnect=self._is_reconnecting)
            logger.info(f"Laixi 연결 성공: {self.ws_url}")

            # 연결 성공 콜백 실행
            await self._fire_callbacks(self._on_connected_callbacks, "connected")

            return True
        except Exception as e:
            error_msg = str(e)
            self._metrics.record_connection_failure(error_msg)
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
                self._metrics.record_connection_lost()

                # 연결 끊김 콜백 실행
                await self._fire_callbacks(self._on_disconnected_callbacks, "disconnected")

    async def reconnect_with_backoff(self, max_attempts: int = None) -> bool:
        """
        지수 백오프를 사용한 재연결

        Args:
            max_attempts: 최대 시도 횟수 (None이면 클래스 기본값 사용)

        Returns:
            재연결 성공 여부
        """
        if max_attempts is None:
            max_attempts = self.MAX_RECONNECT_ATTEMPTS

        self._is_reconnecting = True
        attempt = 0

        try:
            while max_attempts == 0 or attempt < max_attempts:
                attempt += 1
                backoff_delay = self._calculate_backoff()

                logger.info(
                    f"Laixi 재연결 시도 {attempt}"
                    f"{'/' + str(max_attempts) if max_attempts > 0 else ''} "
                    f"(대기: {backoff_delay:.1f}초)"
                )

                # 백오프 대기
                await asyncio.sleep(backoff_delay)

                # 연결 시도
                if await self.connect():
                    logger.info(f"Laixi 재연결 성공 (시도 {attempt}회)")
                    return True

            # 최대 시도 횟수 초과
            logger.error(f"Laixi 재연결 실패: 최대 시도 횟수 {max_attempts}회 초과")

            # 재연결 실패 콜백 실행
            await self._fire_callbacks(
                self._on_reconnect_failed_callbacks,
                f"reconnect_failed_after_{attempt}_attempts"
            )

            return False
        finally:
            self._is_reconnecting = False

    async def ensure_connected(self) -> bool:
        """연결 상태 확인 및 필요시 재연결 (지수 백오프 적용)"""
        if self.ws is None or self.ws.closed:
            # 연결이 끊긴 상태
            if self._metrics.is_connected:
                # 이전에 연결되어 있었으면 끊김으로 기록
                self._metrics.record_connection_lost()
                await self._fire_callbacks(self._on_disconnected_callbacks, "connection_lost")

            # 재연결 시도 (첫 시도는 백오프 없이)
            if await self.connect():
                return True

            # 첫 시도 실패 시 백오프로 재시도
            return await self.reconnect_with_backoff()

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
                # 통신 오류 시 연결 상태 확인
                if self.ws and hasattr(self.ws, 'closed') and self.ws.closed:
                    self._metrics.record_connection_lost()
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


def reset_laixi_client() -> None:
    """싱글톤 인스턴스 초기화 (테스트용)"""
    global _laixi_client
    _laixi_client = None
