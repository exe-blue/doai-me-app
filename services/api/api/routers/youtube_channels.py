"""
📺 YouTube 채널 관리 API
채널 등록, 조회, 삭제 및 수동 스캔 트리거

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-08
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from loguru import logger

from ..services.youtube_monitor import get_youtube_monitor, youtube_scan_job


router = APIRouter(
    prefix="/youtube-channels",
    tags=["YouTube Channels"]
)


# =========================================
# Request/Response 모델
# =========================================

class ChannelCreateRequest(BaseModel):
    """채널 등록 요청"""
    channel_id: str = Field(..., description="YouTube 채널 ID (UC로 시작)")
    channel_name: Optional[str] = Field(None, description="채널 이름")
    watch_priority: str = Field("NORMAL", description="시청 우선순위 (LOW, NORMAL, HIGH, URGENT)")
    min_watch_seconds: int = Field(30, ge=10, le=600, description="최소 시청 시간 (초)")
    max_watch_seconds: int = Field(180, ge=30, le=1800, description="최대 시청 시간 (초)")
    enable_like: bool = Field(False, description="좋아요 활성화")
    enable_comment: bool = Field(False, description="댓글 활성화")
    enable_subscribe: bool = Field(False, description="구독 활성화")


class ChannelResponse(BaseModel):
    """채널 응답"""
    id: Optional[str] = None
    channel_id: str
    channel_name: Optional[str] = None
    is_active: bool = True
    watch_priority: str = "NORMAL"
    min_watch_seconds: int = 30
    max_watch_seconds: int = 180
    enable_like: bool = False
    enable_comment: bool = False
    enable_subscribe: bool = False


class VideoQueueItem(BaseModel):
    """Video Queue 아이템"""
    id: Optional[str] = None
    video_id: str
    video_url: str
    title: Optional[str] = None
    channel_id: Optional[str] = None
    status: str = "PENDING"
    priority: str = "NORMAL"


class ScanResultResponse(BaseModel):
    """스캔 결과 응답"""
    success: bool
    scanned_channels: int
    new_videos: int
    errors: int
    channels: List[dict]


# =========================================
# 채널 관리 엔드포인트
# =========================================

@router.get("/", response_model=List[ChannelResponse])
async def list_channels(
    active_only: bool = Query(True, description="활성 채널만 조회")
):
    """
    등록된 YouTube 채널 목록 조회
    """
    monitor = get_youtube_monitor()
    
    try:
        if active_only:
            channels = await monitor.get_active_channels()
        else:
            # 전체 조회
            result = monitor.client.table("youtube_channels").select("*").execute()
            channels = result.data or []
        
        return channels
        
    except Exception as e:
        logger.error(f"채널 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ChannelResponse)
async def add_channel(request: ChannelCreateRequest):
    """
    새 YouTube 채널 등록
    
    채널 ID 찾는 방법:
    1. YouTube 채널 페이지에서 우클릭 → 페이지 소스 보기
    2. "channelId" 검색 → UC로 시작하는 값
    """
    monitor = get_youtube_monitor()
    
    try:
        result = await monitor.add_channel(
            channel_id=request.channel_id,
            channel_name=request.channel_name,
            watch_priority=request.watch_priority,
            min_watch_seconds=request.min_watch_seconds,
            max_watch_seconds=request.max_watch_seconds,
            enable_like=request.enable_like,
            enable_comment=request.enable_comment,
            enable_subscribe=request.enable_subscribe
        )
        
        if result:
            return result
        else:
            raise HTTPException(status_code=400, detail="채널 등록 실패")
            
    except Exception as e:
        logger.error(f"채널 등록 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{channel_id}")
async def remove_channel(channel_id: str):
    """
    채널 비활성화 (삭제 대신 is_active=false)
    """
    monitor = get_youtube_monitor()
    
    try:
        success = await monitor.remove_channel(channel_id)
        
        if success:
            return {"success": True, "message": f"채널 {channel_id} 비활성화됨"}
        else:
            raise HTTPException(status_code=404, detail="채널을 찾을 수 없음")
            
    except Exception as e:
        logger.error(f"채널 비활성화 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =========================================
# 스캔 엔드포인트
# =========================================

@router.post("/scan", response_model=ScanResultResponse)
async def trigger_scan():
    """
    수동으로 채널 스캔 트리거
    
    모든 활성 채널의 RSS를 확인하고 새 영상을 video_queue에 추가
    """
    monitor = get_youtube_monitor()
    
    try:
        result = await monitor.scan_all_channels()
        
        return {
            "success": True,
            **result
        }
        
    except Exception as e:
        logger.error(f"채널 스캔 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/single/{channel_id}")
async def scan_single_channel(channel_id: str):
    """
    단일 채널 스캔 (테스트용)
    """
    monitor = get_youtube_monitor()
    
    try:
        # RSS 가져오기
        xml = await monitor.fetch_channel_rss(channel_id)
        
        if not xml:
            raise HTTPException(status_code=404, detail="RSS 피드를 가져올 수 없음")
        
        # 파싱 (기본 설정으로)
        channel_info = {
            "channel_id": channel_id,
            "watch_priority": "NORMAL",
            "min_watch_seconds": 30,
            "max_watch_seconds": 180,
            "enable_like": False,
            "enable_comment": False,
            "enable_subscribe": False
        }
        
        videos = monitor.parse_rss(xml, channel_info)
        
        return {
            "success": True,
            "channel_id": channel_id,
            "videos_found": len(videos),
            "videos": videos
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"단일 채널 스캔 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =========================================
# Video Queue 엔드포인트
# =========================================

@router.get("/queue", response_model=List[VideoQueueItem])
async def get_video_queue(
    status: Optional[str] = Query(None, description="상태 필터 (PENDING, WATCHING, COMPLETED, FAILED)"),
    limit: int = Query(50, ge=1, le=200, description="최대 조회 수")
):
    """
    Video Queue 조회
    """
    monitor = get_youtube_monitor()
    
    try:
        query = monitor.client.table("video_queue").select("*")
        
        if status:
            query = query.eq("status", status)
        
        result = query.order(
            "created_at", desc=True
        ).limit(limit).execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Video Queue 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/queue/{video_id}")
async def remove_from_queue(video_id: str):
    """
    Video Queue에서 영상 삭제
    """
    monitor = get_youtube_monitor()
    
    try:
        result = monitor.client.table("video_queue").delete().eq(
            "video_id", video_id
        ).execute()
        
        if result.data and len(result.data) > 0:
            return {"success": True, "message": f"영상 {video_id} 삭제됨"}
        else:
            raise HTTPException(status_code=404, detail="영상을 찾을 수 없음")
            
    except Exception as e:
        logger.error(f"영상 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/stats")
async def get_queue_stats():
    """
    Video Queue 통계
    """
    monitor = get_youtube_monitor()
    
    try:
        result = monitor.client.table("video_queue").select("status").execute()
        
        stats = {
            "total": 0,
            "PENDING": 0,
            "WATCHING": 0,
            "COMPLETED": 0,
            "FAILED": 0
        }
        
        if result.data:
            stats["total"] = len(result.data)
            for item in result.data:
                status = item.get("status", "PENDING")
                if status in stats:
                    stats[status] += 1
        
        return stats
        
    except Exception as e:
        logger.error(f"통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))


