"""
Device Driver 추상화 계층 (The Abstraction Layer)

Orion의 지시: "Laixi 관련 코드는 철저히 모듈화해라. 
나중에 이 모듈만 ScrcpyDriver로 갈아끼우면 시스템 전체가 영향을 받지 않아야 한다."

이 인터페이스는 하드웨어 드라이버의 추상화 계층입니다.
- LaixiDriver: 현재 구현 (임시 드라이버)
- ScrcpyDriver: 향후 구현 (영구 드라이버)
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class DriverType(Enum):
    """드라이버 타입"""
    LAIXI = "laixi"
    SCRCPY = "scrcpy"
    AUTOX = "autox"


@dataclass
class DeviceInfo:
    """디바이스 정보"""
    device_id: str
    model: Optional[str] = None
    screen_width: int = 1080
    screen_height: int = 2280
    is_connected: bool = False
    extra: Optional[Dict[str, Any]] = None


@dataclass
class TapResult:
    """탭 결과"""
    success: bool
    actual_x: float
    actual_y: float
    duration_ms: int
    error: Optional[str] = None


@dataclass
class SwipeResult:
    """스와이프 결과"""
    success: bool
    path: List[Dict[str, float]]
    duration_ms: int
    error: Optional[str] = None


@dataclass
class TextResult:
    """텍스트 입력 결과"""
    success: bool
    typed_text: str
    typo_count: int = 0
    error: Optional[str] = None


class DeviceDriver(ABC):
    """
    Device Driver 추상 클래스
    
    모든 하드웨어 드라이버가 구현해야 하는 인터페이스입니다.
    Strangler Pattern: 이 인터페이스를 통해 Laixi → Scrcpy 전환이 가능합니다.
    """
    
    @property
    @abstractmethod
    def driver_type(self) -> DriverType:
        """드라이버 타입 반환"""
        pass
    
    @abstractmethod
    async def connect(self, device_id: str) -> bool:
        """
        디바이스에 연결
        
        Args:
            device_id: 디바이스 ID 또는 "all"
            
        Returns:
            연결 성공 여부
        """
        pass
    
    @abstractmethod
    async def disconnect(self, device_id: str) -> bool:
        """
        디바이스 연결 해제
        
        Args:
            device_id: 디바이스 ID
            
        Returns:
            해제 성공 여부
        """
        pass
    
    @abstractmethod
    async def list_devices(self) -> List[DeviceInfo]:
        """
        연결된 모든 디바이스 목록
        
        Returns:
            디바이스 정보 리스트
        """
        pass
    
    @abstractmethod
    async def tap(
        self,
        device_id: str,
        x: float,
        y: float,
        duration_ms: int = 100
    ) -> TapResult:
        """
        화면 탭 (백분율 좌표)
        
        Args:
            device_id: 디바이스 ID
            x: X 좌표 (0.0 ~ 1.0)
            y: Y 좌표 (0.0 ~ 1.0)
            duration_ms: 터치 지속 시간
            
        Returns:
            탭 결과
        """
        pass
    
    @abstractmethod
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
        
        Args:
            device_id: 디바이스 ID
            x1, y1: 시작 좌표 (0.0 ~ 1.0)
            x2, y2: 종료 좌표 (0.0 ~ 1.0)
            duration_ms: 스와이프 지속 시간
            
        Returns:
            스와이프 결과
        """
        pass
    
    @abstractmethod
    async def text(
        self,
        device_id: str,
        content: str,
        use_clipboard: bool = True
    ) -> TextResult:
        """
        텍스트 입력
        
        Args:
            device_id: 디바이스 ID
            content: 입력할 텍스트
            use_clipboard: 클립보드 사용 여부 (한글 지원)
            
        Returns:
            텍스트 입력 결과
        """
        pass
    
    @abstractmethod
    async def execute_adb(
        self,
        device_id: str,
        command: str
    ) -> bool:
        """
        ADB 명령 실행
        
        Args:
            device_id: 디바이스 ID
            command: ADB 명령어
            
        Returns:
            실행 성공 여부
        """
        pass
    
    @abstractmethod
    async def screenshot(
        self,
        device_id: str,
        save_path: Optional[str] = None
    ) -> Optional[bytes]:
        """
        스크린샷 캡처
        
        Args:
            device_id: 디바이스 ID
            save_path: 저장 경로 (None이면 바이트 반환)
            
        Returns:
            스크린샷 바이트 또는 None
        """
        pass
    
    # ==================== 편의 메서드 ====================
    
    async def press_home(self, device_id: str) -> bool:
        """홈 버튼"""
        return await self.execute_adb(device_id, "input keyevent 3")
    
    async def press_back(self, device_id: str) -> bool:
        """뒤로가기"""
        return await self.execute_adb(device_id, "input keyevent 4")
    
    async def open_youtube_video(self, device_id: str, video_url: str) -> bool:
        """YouTube 영상 열기"""
        return await self.execute_adb(
            device_id,
            f"am start -a android.intent.action.VIEW -d {video_url}"
        )
    
    async def scroll_down(self, device_id: str) -> SwipeResult:
        """아래로 스크롤 (위로 스와이프)"""
        return await self.swipe(device_id, 0.5, 0.7, 0.5, 0.3, 300)
    
    async def scroll_up(self, device_id: str) -> SwipeResult:
        """위로 스크롤 (아래로 스와이프)"""
        return await self.swipe(device_id, 0.5, 0.3, 0.5, 0.7, 300)


# ==================== 드라이버 팩토리 ====================

_driver_instance: Optional[DeviceDriver] = None


def get_driver(driver_type: DriverType = DriverType.LAIXI) -> DeviceDriver:
    """
    드라이버 인스턴스 반환 (팩토리 패턴)
    
    Strangler Pattern: driver_type만 바꾸면 전체 시스템이 새 드라이버 사용
    
    Args:
        driver_type: 사용할 드라이버 타입
        
    Returns:
        DeviceDriver 인스턴스
    """
    global _driver_instance
    
    if _driver_instance is not None:
        return _driver_instance
    
    if driver_type == DriverType.LAIXI:
        from .laixi_driver import LaixiDriver
        _driver_instance = LaixiDriver()
    elif driver_type == DriverType.SCRCPY:
        # TODO: ScrcpyDriver 구현 후 활성화
        raise NotImplementedError("ScrcpyDriver는 아직 구현되지 않았습니다")
    else:
        raise ValueError(f"지원하지 않는 드라이버 타입: {driver_type}")
    
    return _driver_instance


def set_driver(driver: DeviceDriver) -> None:
    """드라이버 인스턴스 직접 설정 (테스트용)"""
    global _driver_instance
    _driver_instance = driver

