"""
🤖 DoAi.Me - WiFi API Router
S9 기기들의 WiFi 연결 관리 API

엔드포인트:
- POST /api/v1/wifi/connect - WiFi 연결
- GET /api/v1/wifi/status - 전체 기기 WiFi 상태
- GET /api/v1/wifi/status/{device_id} - 특정 기기 WiFi 상태
- POST /api/v1/wifi/verify - WiFi 연결 검증
- POST /api/v1/wifi/disconnect - WiFi 연결 해제
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from loguru import logger

from ..services.wifi_service import (
    WifiService,
    get_wifi_service,
    DeviceWifiStatus,
    WifiConnectionResult
)


router = APIRouter(prefix="/api/v1/wifi", tags=["wifi"])


# ==================== Request/Response 모델 ====================

class WifiConnectRequest(BaseModel):
    """WiFi 연결 요청"""
    ssid: str = Field(..., description="WiFi SSID", example="JH-Wifi")
    password: str = Field(..., description="WiFi 비밀번호", example="password123")
    device_ids: Optional[str] = Field(
        default="all",
        description="대상 기기 ID ('all' 또는 쉼표로 구분된 ID)",
        example="device1,device2"
    )
    retry: Optional[bool] = Field(
        default=True,
        description="실패 시 재시도 여부"
    )


class WifiVerifyRequest(BaseModel):
    """WiFi 연결 검증 요청"""
    ssid: str = Field(..., description="확인할 SSID")
    device_ids: List[str] = Field(..., description="확인할 기기 ID 목록")


class WifiStatusResponse(BaseModel):
    """WiFi 상태 응답"""
    device_id: str
    connected: bool
    ssid: Optional[str] = None
    ip_address: Optional[str] = None
    rssi: Optional[int] = None
    link_speed: Optional[int] = None


class WifiConnectResponse(BaseModel):
    """WiFi 연결 응답"""
    success: bool
    ssid: str
    device_ids: str
    status: str
    steps: List[Dict[str, Any]]
    duration_ms: int
    error: Optional[str] = None


class WifiVerifyResponse(BaseModel):
    """WiFi 검증 응답"""
    target_ssid: str
    total_devices: int
    connected: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]
    success_rate: float
    timestamp: str


# ==================== API 엔드포인트 ====================

@router.post("/connect", response_model=WifiConnectResponse)
async def connect_wifi(request: WifiConnectRequest):
    """
    WiFi 연결 실행
    
    모든 기기 또는 지정된 기기들을 특정 WiFi에 연결합니다.
    
    - **ssid**: 연결할 WiFi SSID
    - **password**: WiFi 비밀번호
    - **device_ids**: 대상 기기 ("all" 또는 쉼표로 구분)
    - **retry**: 실패 시 1회 재시도 (기본값: true)
    """
    logger.info(f"WiFi 연결 요청: {request.ssid} -> {request.device_ids}")
    
    wifi_service = get_wifi_service()
    
    try:
        if request.retry:
            result = await wifi_service.connect_wifi_with_retry(
                ssid=request.ssid,
                password=request.password,
                device_ids=request.device_ids
            )
        else:
            result = await wifi_service.connect_wifi(
                ssid=request.ssid,
                password=request.password,
                device_ids=request.device_ids
            )
        
        return WifiConnectResponse(
            success=result.status == "completed",
            ssid=result.ssid,
            device_ids=result.device_ids,
            status=result.status,
            steps=result.steps,
            duration_ms=result.duration_ms,
            error=result.error
        )
        
    except Exception as e:
        logger.error(f"WiFi 연결 API 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=List[WifiStatusResponse])
async def get_all_wifi_status():
    """
    모든 기기의 WiFi 상태 조회
    
    연결된 모든 S9 기기의 WiFi 연결 상태를 반환합니다.
    """
    logger.info("전체 WiFi 상태 조회 요청")
    
    wifi_service = get_wifi_service()
    
    try:
        statuses = await wifi_service.check_all_devices()
        
        return [
            WifiStatusResponse(
                device_id=s.device_id,
                connected=s.connected,
                ssid=s.ssid,
                ip_address=s.ip_address,
                rssi=s.rssi,
                link_speed=s.link_speed
            )
            for s in statuses
        ]
        
    except Exception as e:
        logger.error(f"WiFi 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{device_id}", response_model=WifiStatusResponse)
async def get_device_wifi_status(device_id: str):
    """
    특정 기기의 WiFi 상태 조회
    
    - **device_id**: 기기 ID
    """
    logger.info(f"기기 WiFi 상태 조회: {device_id}")
    
    wifi_service = get_wifi_service()
    
    try:
        status = await wifi_service.check_wifi_status(device_id)
        
        return WifiStatusResponse(
            device_id=status.device_id,
            connected=status.connected,
            ssid=status.ssid,
            ip_address=status.ip_address,
            rssi=status.rssi,
            link_speed=status.link_speed
        )
        
    except Exception as e:
        logger.error(f"WiFi 상태 조회 오류 ({device_id}): {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify", response_model=WifiVerifyResponse)
async def verify_wifi_connection(request: WifiVerifyRequest):
    """
    WiFi 연결 검증 및 리포트
    
    지정된 기기들이 특정 SSID에 연결되어 있는지 확인하고 리포트를 생성합니다.
    
    - **ssid**: 확인할 WiFi SSID
    - **device_ids**: 확인할 기기 ID 목록
    """
    logger.info(f"WiFi 연결 검증 요청: {request.ssid}")
    
    wifi_service = get_wifi_service()
    
    try:
        report = await wifi_service.verify_connection(
            target_ssid=request.ssid,
            device_ids=request.device_ids
        )
        
        return WifiVerifyResponse(**report)
        
    except Exception as e:
        logger.error(f"WiFi 검증 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect_wifi(device_ids: Optional[str] = "all"):
    """
    WiFi 연결 해제 (WiFi 재시작)
    
    지정된 기기의 WiFi를 껐다가 다시 켭니다.
    
    - **device_ids**: 대상 기기 ("all" 또는 쉼표로 구분)
    """
    logger.info(f"WiFi 연결 해제 요청: {device_ids}")
    
    wifi_service = get_wifi_service()
    
    try:
        result = await wifi_service.disconnect_wifi(device_ids)
        return result
        
    except Exception as e:
        logger.error(f"WiFi 연결 해제 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 백그라운드 작업 ====================

@router.post("/connect-async")
async def connect_wifi_async(
    request: WifiConnectRequest,
    background_tasks: BackgroundTasks
):
    """
    WiFi 연결 (비동기 백그라운드)
    
    연결 작업을 백그라운드에서 실행하고 즉시 응답합니다.
    대량의 기기 연결 시 타임아웃 방지용입니다.
    """
    logger.info(f"WiFi 비동기 연결 요청: {request.ssid}")
    
    wifi_service = get_wifi_service()
    
    async def background_connect():
        try:
            await wifi_service.connect_wifi_with_retry(
                ssid=request.ssid,
                password=request.password,
                device_ids=request.device_ids
            )
        except Exception as e:
            logger.error(f"백그라운드 WiFi 연결 오류: {e}")
    
    background_tasks.add_task(background_connect)
    
    return {
        "message": "WiFi 연결이 백그라운드에서 시작되었습니다",
        "ssid": request.ssid,
        "device_ids": request.device_ids,
        "check_status_at": "/api/v1/wifi/status"
    }

