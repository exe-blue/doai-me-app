"""
Laixi 로컬 디바이스 제어 API

로컬 PC에 설치된 Laixi App (WebSocket ws://127.0.0.1:22221/)을 통해
Android 기기에 YouTube 영상 시청 명령을 전송합니다.

엔드포인트:
- POST /api/laixi/watch - 영상 시청 명령
- GET /api/laixi/devices - 연결된 기기 목록
- POST /api/laixi/stop - 시청 중지
"""

import asyncio
import json
import logging
from typing import Optional, List
from datetime import datetime
from enum import Enum

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, HttpUrl

# Laixi 클라이언트 임포트
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

try:
    from shared.laixi_client import LaixiClient, LaixiConfig, get_laixi_client
    HAS_LAIXI = True
except ImportError:
    HAS_LAIXI = False
    # Stub definitions for type hints when Laixi is not available
    class LaixiClient:
        """Stub class for type hints"""
        pass
    class LaixiConfig:
        """Stub class for type hints"""
        pass
    def get_laixi_client():
        return None

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/laixi", tags=["Laixi"])


# ============================================
# Pydantic Models
# ============================================

class WatchMode(str, Enum):
    """시청 모드"""
    DIRECT_URL = "direct_url"  # URL 직접 열기 (am start -a VIEW)
    APP_SEARCH = "app_search"  # 앱 내 검색 후 시청


class WatchRequest(BaseModel):
    """YouTube 시청 요청"""
    video_url: str = Field(..., description="YouTube 영상 URL")
    video_id: Optional[str] = Field(None, description="영상 ID (자동 추출)")
    title: Optional[str] = Field(None, description="영상 제목 (로깅용)")
    target_device_ids: Optional[List[str]] = Field(
        None,
        description="대상 디바이스 ID 목록 (None이면 전체)"
    )
    watch_duration_seconds: int = Field(
        30,
        ge=5,
        le=3600,
        description="시청 시간 (초)"
    )
    mode: WatchMode = Field(
        WatchMode.DIRECT_URL,
        description="시청 모드"
    )


class WatchResponse(BaseModel):
    """시청 응답"""
    success: bool
    message: str
    dispatched_count: int = 0
    target_device_ids: List[str] = []
    errors: List[str] = []


class DeviceInfo(BaseModel):
    """디바이스 정보"""
    id: str
    model: Optional[str] = None
    status: str = "unknown"


class DevicesResponse(BaseModel):
    """디바이스 목록 응답"""
    success: bool
    devices: List[DeviceInfo] = []
    count: int = 0


class StopRequest(BaseModel):
    """중지 요청"""
    target_device_ids: Optional[List[str]] = Field(
        None,
        description="대상 디바이스 ID 목록 (None이면 전체)"
    )


# ============================================
# Helper Functions
# ============================================

def extract_video_id(url: str) -> Optional[str]:
    """
    YouTube URL에서 video_id 추출
    
    지원 형식:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://youtube.com/shorts/VIDEO_ID
    """
    import re
    
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})',
        r'[?&]v=([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


async def dispatch_youtube_watch(
    client: LaixiClient,
    device_ids: str,
    video_url: str,
    video_id: str,
    title: Optional[str] = None
) -> bool:
    """
    YouTube 영상 시청 명령 전송
    
    ADB Intent를 사용하여 YouTube 앱에서 영상을 엽니다.
    """
    try:
        # YouTube 앱으로 영상 열기 (Intent ACTION_VIEW)
        # 형식: am start -a android.intent.action.VIEW -d URL
        adb_command = f'am start -a android.intent.action.VIEW -d "{video_url}"'
        
        result = await client.execute_adb(device_ids, adb_command)
        
        if result:
            logger.info(f"YouTube 시청 명령 전송 성공: {device_ids} → {video_id}")
            
            # Toast 메시지로 피드백
            if title:
                await client.show_toast(device_ids, f"▶ {title[:30]}...")
            
            return True
        else:
            logger.warning(f"YouTube 시청 명령 실패: {device_ids}")
            return False
            
    except Exception as e:
        logger.error(f"YouTube 시청 명령 오류: {e}")
        return False


# ============================================
# API Endpoints
# ============================================

@router.get("/health")
async def laixi_health():
    """Laixi 연결 상태 확인"""
    if not HAS_LAIXI:
        return {
            "success": False,
            "status": "unavailable",
            "message": "Laixi 클라이언트가 설치되지 않음 (pip install websockets)"
        }
    
    try:
        client = get_laixi_client()
        connected = await client.connect()
        
        if connected:
            devices = await client.list_devices()
            await client.disconnect()
            
            return {
                "success": True,
                "status": "connected",
                "device_count": len(devices),
                "laixi_url": client.config.websocket_url
            }
        else:
            return {
                "success": False,
                "status": "disconnected",
                "message": "Laixi 서버에 연결할 수 없음 (laixi.app 실행 확인)"
            }
    except Exception as e:
        return {
            "success": False,
            "status": "error",
            "message": str(e)
        }


@router.get("/devices", response_model=DevicesResponse)
async def list_laixi_devices():
    """
    Laixi에 연결된 디바이스 목록
    
    Laixi App을 통해 현재 연결된 Android 기기 목록을 반환합니다.
    """
    if not HAS_LAIXI:
        raise HTTPException(
            status_code=503,
            detail="Laixi 클라이언트가 설치되지 않음"
        )
    
    try:
        client = get_laixi_client()
        
        if not await client.connect():
            raise HTTPException(
                status_code=503,
                detail="Laixi 서버에 연결할 수 없음 (Laixi.exe 실행 확인)"
            )
        
        devices_raw = await client.list_devices()
        await client.disconnect()
        
        devices = [
            DeviceInfo(
                id=d.get("id", d.get("deviceId", "unknown")),
                model=d.get("model"),
                status=d.get("status", "connected")
            )
            for d in devices_raw
        ]
        
        return DevicesResponse(
            success=True,
            devices=devices,
            count=len(devices)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"디바이스 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watch", response_model=WatchResponse)
async def watch_youtube_video(request: WatchRequest):
    """
    YouTube 영상 시청 명령
    
    지정된 디바이스(또는 전체)에서 YouTube 영상을 시청합니다.
    
    - **video_url**: YouTube 영상 URL (필수)
    - **target_device_ids**: 대상 디바이스 ID 목록 (None이면 전체)
    - **watch_duration_seconds**: 시청 시간 (기본 30초)
    
    예시:
    ```json
    {
      "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "target_device_ids": null,
      "watch_duration_seconds": 60
    }
    ```
    """
    if not HAS_LAIXI:
        raise HTTPException(
            status_code=503,
            detail="Laixi 클라이언트가 설치되지 않음"
        )
    
    # Video ID 추출
    video_id = request.video_id or extract_video_id(request.video_url)
    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="유효한 YouTube URL이 아닙니다"
        )
    
    try:
        client = get_laixi_client()
        
        if not await client.connect():
            raise HTTPException(
                status_code=503,
                detail="Laixi 서버에 연결할 수 없음"
            )
        
        # 대상 디바이스 결정
        if request.target_device_ids:
            target_ids = ",".join(request.target_device_ids)
            target_list = request.target_device_ids
        else:
            # 전체 디바이스
            devices = await client.list_devices()
            target_list = [d.get("id", d.get("deviceId")) for d in devices]
            target_ids = "all"
        
        if not target_list:
            await client.disconnect()
            return WatchResponse(
                success=False,
                message="연결된 디바이스가 없습니다",
                dispatched_count=0,
                target_device_ids=[]
            )
        
        # 시청 명령 전송
        logger.info(f"YouTube 시청 명령: {video_id} → {len(target_list)}대")
        
        success = await dispatch_youtube_watch(
            client=client,
            device_ids=target_ids,
            video_url=request.video_url,
            video_id=video_id,
            title=request.title
        )
        
        await client.disconnect()
        
        if success:
            return WatchResponse(
                success=True,
                message=f"{len(target_list)}대 디바이스에 시청 명령 전송 완료",
                dispatched_count=len(target_list),
                target_device_ids=target_list
            )
        else:
            return WatchResponse(
                success=False,
                message="시청 명령 전송 실패",
                dispatched_count=0,
                target_device_ids=target_list,
                errors=["ADB 명령 실행 실패"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube 시청 명령 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_youtube(request: StopRequest):
    """
    YouTube 시청 중지
    
    디바이스에서 YouTube 앱을 종료하고 홈 화면으로 이동합니다.
    """
    if not HAS_LAIXI:
        raise HTTPException(
            status_code=503,
            detail="Laixi 클라이언트가 설치되지 않음"
        )
    
    try:
        client = get_laixi_client()
        
        if not await client.connect():
            raise HTTPException(
                status_code=503,
                detail="Laixi 서버에 연결할 수 없음"
            )
        
        # 대상 디바이스 결정
        if request.target_device_ids:
            target_ids = ",".join(request.target_device_ids)
        else:
            target_ids = "all"
        
        # YouTube 앱 종료
        await client.execute_adb(target_ids, "am force-stop com.google.android.youtube")
        
        # 홈 버튼
        # 개별 디바이스에 대해 홈 버튼 전송 필요
        devices = await client.list_devices() if target_ids == "all" else []
        
        if target_ids == "all":
            for device in devices:
                device_id = device.get("id", device.get("deviceId"))
                if device_id:
                    await client.press_home(device_id)
        else:
            for device_id in request.target_device_ids or []:
                await client.press_home(device_id)
        
        await client.disconnect()
        
        return {
            "success": True,
            "message": "YouTube 종료 및 홈 화면 이동 완료"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube 중지 명령 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/screenshot")
async def take_screenshot(
    device_id: str,
    save_path: str = "d:\\screenshots"
):
    """
    디바이스 스크린샷
    
    지정된 디바이스의 현재 화면을 캡처합니다.
    """
    if not HAS_LAIXI:
        raise HTTPException(
            status_code=503,
            detail="Laixi 클라이언트가 설치되지 않음"
        )
    
    try:
        client = get_laixi_client()
        
        if not await client.connect():
            raise HTTPException(
                status_code=503,
                detail="Laixi 서버에 연결할 수 없음"
            )
        
        success = await client.screenshot(device_id, save_path)
        await client.disconnect()
        
        if success:
            return {
                "success": True,
                "message": f"스크린샷 저장: {save_path}",
                "device_id": device_id
            }
        else:
            return {
                "success": False,
                "message": "스크린샷 실패"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"스크린샷 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


