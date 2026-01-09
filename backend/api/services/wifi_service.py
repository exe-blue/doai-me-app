"""
🤖 DoAi.Me - WiFi Service
S9 기기들의 WiFi 자동 연결 및 상태 관리

왜 이 구조인가?
- 600대 기기를 한 번에 동일한 WiFi에 연결해야 함
- 좌표 기반 UI 제어로 추가 앱 설치 없이 작동
- 연결 성공/실패 리포트로 운영 효율화
"""

import asyncio
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger

from .laixi_client import LaixiClient, get_laixi_client


class ConnectionStatus(str, Enum):
    """연결 상태"""
    PENDING = "pending"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class WifiConnectionResult:
    """WiFi 연결 결과"""
    ssid: str
    device_ids: str
    status: str
    steps: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    duration_ms: int = 0


@dataclass
class DeviceWifiStatus:
    """기기별 WiFi 상태"""
    device_id: str
    connected: bool = False
    ssid: Optional[str] = None
    ip_address: Optional[str] = None
    rssi: Optional[int] = None
    link_speed: Optional[int] = None


# ==================== S9 화면 좌표 ====================
# 해상도: 1440 x 2960
# 좌표는 백분율 (0.0 ~ 1.0)로 정의

class S9Coordinates:
    """S9 WiFi 설정 화면 좌표"""
    
    # WiFi 설정 화면
    SEARCH_ICON = (0.92, 0.05)           # 검색 아이콘
    FIRST_RESULT = (0.5, 0.25)           # 첫 번째 검색 결과
    PASSWORD_FIELD = (0.5, 0.45)         # 비밀번호 입력 필드
    CONNECT_BUTTON = (0.85, 0.95)        # 연결 버튼
    WIFI_TOGGLE = (0.9, 0.15)            # WiFi 토글 스위치
    
    # 키보드
    KEYBOARD_DONE = (0.95, 0.65)         # 키보드 완료 버튼
    
    # 픽셀 좌표로 변환 (S9 해상도 기준)
    SCREEN_WIDTH = 1440
    SCREEN_HEIGHT = 2960
    
    @classmethod
    def to_pixels(cls, coord_percent: tuple) -> tuple:
        """백분율 좌표를 픽셀 좌표로 변환"""
        return (
            int(coord_percent[0] * cls.SCREEN_WIDTH),
            int(coord_percent[1] * cls.SCREEN_HEIGHT)
        )


class WifiService:
    """
    WiFi 연결 서비스
    
    책임:
    - WiFi 연결 자동화 (설정 열기 → SSID 검색 → 비밀번호 입력 → 연결)
    - 연결 상태 확인
    - 연결 결과 리포트 생성
    """
    
    # 타임아웃 설정 (초)
    STEP_DELAY = 0.5
    CONNECT_WAIT = 5.0
    MAX_RETRIES = 1
    
    def __init__(self, laixi_client: LaixiClient = None):
        self.laixi = laixi_client or get_laixi_client()
        self.coords = S9Coordinates()
    
    async def connect_wifi(
        self,
        ssid: str,
        password: str,
        device_ids: str = "all"
    ) -> WifiConnectionResult:
        """
        WiFi 연결 실행
        
        Args:
            ssid: WiFi SSID
            password: WiFi 비밀번호
            device_ids: 대상 기기 ID ("all" 또는 쉼표로 구분된 ID)
            
        Returns:
            WifiConnectionResult: 연결 결과
        """
        import time
        start_time = time.time()
        
        result = WifiConnectionResult(
            ssid=ssid,
            device_ids=device_ids,
            status="started"
        )
        
        try:
            logger.info(f"WiFi 연결 시작: {ssid} -> {device_ids}")
            
            # Step 1: WiFi 설정 열기
            await self.laixi.adb(
                "am start -a android.settings.WIFI_SETTINGS",
                device_ids
            )
            result.steps.append({
                "step": 1, 
                "action": "open_settings", 
                "status": "ok"
            })
            await asyncio.sleep(2.0)
            
            # Step 2: 검색 아이콘 탭
            x, y = self.coords.to_pixels(S9Coordinates.SEARCH_ICON)
            await self.laixi.tap(x, y, device_ids)
            result.steps.append({
                "step": 2, 
                "action": "tap_search", 
                "status": "ok"
            })
            await asyncio.sleep(self.STEP_DELAY)
            
            # Step 3: SSID 입력 (클립보드 사용)
            await self.laixi.clipboard_write(ssid, device_ids)
            await asyncio.sleep(0.2)
            await self.laixi.paste(device_ids)
            result.steps.append({
                "step": 3, 
                "action": "input_ssid", 
                "status": "ok"
            })
            await asyncio.sleep(1.0)
            
            # Step 4: 검색 결과 첫 번째 항목 탭
            x, y = self.coords.to_pixels(S9Coordinates.FIRST_RESULT)
            await self.laixi.tap(x, y, device_ids)
            result.steps.append({
                "step": 4, 
                "action": "tap_result", 
                "status": "ok"
            })
            await asyncio.sleep(self.STEP_DELAY)
            
            # Step 5: 비밀번호 필드 탭
            x, y = self.coords.to_pixels(S9Coordinates.PASSWORD_FIELD)
            await self.laixi.tap(x, y, device_ids)
            result.steps.append({
                "step": 5, 
                "action": "tap_password", 
                "status": "ok"
            })
            await asyncio.sleep(0.3)
            
            # Step 6: 비밀번호 입력
            await self.laixi.clipboard_write(password, device_ids)
            await asyncio.sleep(0.2)
            await self.laixi.paste(device_ids)
            result.steps.append({
                "step": 6, 
                "action": "input_password", 
                "status": "ok"
            })
            await asyncio.sleep(self.STEP_DELAY)
            
            # Step 7: 연결 버튼 탭
            x, y = self.coords.to_pixels(S9Coordinates.CONNECT_BUTTON)
            await self.laixi.tap(x, y, device_ids)
            result.steps.append({
                "step": 7, 
                "action": "tap_connect", 
                "status": "ok"
            })
            
            # 연결 대기
            await asyncio.sleep(self.CONNECT_WAIT)
            
            result.status = "completed"
            logger.info(f"WiFi 연결 완료: {ssid}")
            
        except Exception as e:
            logger.error(f"WiFi 연결 오류: {e}")
            result.status = "error"
            result.error = str(e)
        
        result.duration_ms = int((time.time() - start_time) * 1000)
        return result
    
    async def connect_wifi_with_retry(
        self,
        ssid: str,
        password: str,
        device_ids: str = "all",
        max_retries: int = None
    ) -> WifiConnectionResult:
        """
        재시도 포함 WiFi 연결
        
        Args:
            ssid: WiFi SSID
            password: WiFi 비밀번호
            device_ids: 대상 기기 ID
            max_retries: 최대 재시도 횟수 (기본값: 1)
        """
        max_retries = max_retries or self.MAX_RETRIES
        
        for attempt in range(max_retries + 1):
            logger.info(f"WiFi 연결 시도 {attempt + 1}/{max_retries + 1}")
            
            result = await self.connect_wifi(ssid, password, device_ids)
            
            if result.status == "completed":
                # 연결 검증
                await asyncio.sleep(2.0)
                # device_ids 처리: "all"이면 그대로, 문자열이면 리스트로 변환
                if isinstance(device_ids, str) and device_ids != "all":
                    verify_device_ids = [device_ids]
                elif isinstance(device_ids, list):
                    verify_device_ids = device_ids
                else:
                    verify_device_ids = device_ids  # "all" 또는 기타
                verification = await self.verify_connection(ssid, verify_device_ids)
                
                if verification["success_rate"] >= 95:
                    return result
            
            if attempt < max_retries:
                logger.info("재시도 대기 중...")
                await asyncio.sleep(3.0)
        
        return result
    
    async def check_wifi_status(self, device_id: str) -> DeviceWifiStatus:
        """
        단일 기기의 WiFi 연결 상태 확인
        
        Args:
            device_id: 기기 ID
            
        Returns:
            DeviceWifiStatus: WiFi 상태 정보
        """
        status = DeviceWifiStatus(device_id=device_id)
        
        try:
            result = await self.laixi.adb(
                "dumpsys wifi | grep -E '(mWifiInfo|SSID|IP|RSSI|Link speed)'",
                device_id
            )
            
            output = result.get("output", "")
            
            # SSID 파싱
            ssid_match = re.search(r'SSID:\s*"?([^"]+)"?', output)
            if ssid_match:
                status.ssid = ssid_match.group(1).strip()
                status.connected = status.ssid != "<unknown ssid>"
            
            # IP 주소 파싱
            ip_match = re.search(r'IP address:\s*(\d+\.\d+\.\d+\.\d+)', output)
            if ip_match:
                status.ip_address = ip_match.group(1)
            
            # RSSI 파싱
            rssi_match = re.search(r'RSSI:\s*(-?\d+)', output)
            if rssi_match:
                status.rssi = int(rssi_match.group(1))
            
            # Link speed 파싱
            speed_match = re.search(r'Link speed:\s*(\d+)', output)
            if speed_match:
                status.link_speed = int(speed_match.group(1))
            
            logger.debug(f"기기 {device_id} WiFi 상태: {status}")
            
        except Exception as e:
            logger.error(f"WiFi 상태 확인 오류 ({device_id}): {e}")
        
        return status
    
    async def check_all_devices(self) -> List[DeviceWifiStatus]:
        """
        모든 기기의 WiFi 상태 확인
        
        Returns:
            List[DeviceWifiStatus]: 모든 기기의 WiFi 상태
        """
        results = []
        
        try:
            devices_response = await self.laixi.get_device_list()
            devices = devices_response.get("devices", [])
            
            if not devices:
                logger.warning("연결된 기기가 없습니다")
                return results
            
            # 병렬로 상태 확인
            tasks = []
            for device in devices:
                device_id = device.get("id") or device.get("deviceId")
                if device_id:
                    tasks.append(self.check_wifi_status(device_id))
            
            results = await asyncio.gather(*tasks)
            logger.info(f"총 {len(results)}개 기기 상태 확인 완료")
            
        except Exception as e:
            logger.error(f"전체 기기 상태 확인 오류: {e}")
        
        return list(results)
    
    async def verify_connection(
        self,
        target_ssid: str,
        device_ids: List[str]
    ) -> Dict[str, Any]:
        """
        WiFi 연결 검증 및 리포트 생성
        
        Args:
            target_ssid: 확인할 SSID
            device_ids: 확인할 기기 ID 목록
            
        Returns:
            연결 검증 리포트
        """
        report = {
            "target_ssid": target_ssid,
            "total_devices": len(device_ids),
            "connected": [],
            "failed": [],
            "success_rate": 0.0,
            "timestamp": None
        }
        
        from datetime import datetime
        report["timestamp"] = datetime.now().isoformat()
        
        for device_id in device_ids:
            status = await self.check_wifi_status(device_id)
            
            if status.connected and status.ssid == target_ssid:
                report["connected"].append({
                    "device_id": device_id,
                    "ip_address": status.ip_address,
                    "rssi": status.rssi
                })
            else:
                report["failed"].append({
                    "device_id": device_id,
                    "current_ssid": status.ssid,
                    "reason": "not_connected" if not status.connected else "wrong_ssid"
                })
        
        if report["total_devices"] > 0:
            report["success_rate"] = (len(report["connected"]) / report["total_devices"]) * 100
        
        logger.info(
            f"WiFi 검증 완료: {len(report['connected'])}/{report['total_devices']} "
            f"({report['success_rate']:.1f}%)"
        )
        
        return report
    
    async def disconnect_wifi(
        self,
        device_ids: str = "all"
    ) -> Dict[str, Any]:
        """
        WiFi 연결 해제
        
        Args:
            device_ids: 대상 기기 ID
        """
        try:
            # WiFi 끄기 명령
            await self.laixi.adb(
                "svc wifi disable",
                device_ids
            )
            await asyncio.sleep(1.0)
            
            # WiFi 다시 켜기
            await self.laixi.adb(
                "svc wifi enable",
                device_ids
            )
            
            return {"success": True, "message": "WiFi 재시작됨"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# ==================== 싱글톤 인스턴스 ====================

_wifi_service: Optional[WifiService] = None


def get_wifi_service() -> WifiService:
    """WiFi 서비스 싱글톤 인스턴스 반환"""
    global _wifi_service
    if _wifi_service is None:
        _wifi_service = WifiService()
    return _wifi_service

