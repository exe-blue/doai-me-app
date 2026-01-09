"""
YouTube 자동화 API 엔드포인트

영상 목록 조회 및 시청 결과 저장을 위한 REST API

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-01
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import IntEnum
import logging

from ..services.supabase_rpc import get_supabase_client
from ..rate_limiter import limiter
from ..config import settings

# 로거 설정
logger = logging.getLogger("youtube_api")

router = APIRouter(prefix="/youtube", tags=["YouTube Automation"])


# === 데이터 모델 ===

class SearchType(IntEnum):
    """검색 경로 유형"""
    KEYWORD = 1
    KEYWORD_RECENT = 2
    TITLE = 3
    DIRECT_URL = 4


class VideoStatus(str):
    """영상 상태"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ERROR = "error"
    NOT_FOUND = "not_found"


class VideoInput(BaseModel):
    """영상 입력 데이터 (Tally/Airtable에서 수신)"""
    id: str = Field(..., description="고유 식별자")
    keyword: Optional[str] = Field(None, description="검색 키워드")
    title: Optional[str] = Field(None, description="영상 제목")
    url: Optional[str] = Field(None, description="YouTube URL")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "video_001",
                "keyword": "요리 브이로그",
                "title": "오늘의 집밥 만들기",
                "url": "https://youtube.com/watch?v=XXXXX"
            }
        }


class WatchResult(BaseModel):
    """시청 결과 데이터 (디바이스 → 서버)"""
    device_id: str = Field(..., description="디바이스 시리얼")
    video_id: str = Field(..., description="영상 ID")
    title: Optional[str] = Field(None, description="영상 제목")
    watch_time: int = Field(0, ge=0, description="시청 시간(초)")
    total_duration: Optional[int] = Field(None, ge=0, description="전체 길이(초)")
    commented: bool = Field(False, description="댓글 작성 여부")
    comment_text: Optional[str] = Field(None, description="작성한 댓글")
    liked: bool = Field(False, description="좋아요 여부")
    search_type: Optional[int] = Field(None, ge=1, le=4, description="검색 유형(1~4)")
    search_rank: Optional[int] = Field(None, ge=0, description="검색 순위")
    screenshot_path: Optional[str] = Field(None, description="스크린샷 경로")
    status: str = Field("completed", description="결과 상태")
    error_message: Optional[str] = Field(None, description="에러 메시지")
    
    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "DEVICE_001",
                "video_id": "video_001",
                "title": "오늘의 집밥 만들기",
                "watch_time": 180,
                "total_duration": 300,
                "commented": True,
                "comment_text": "좋은 영상이네요 👍",
                "liked": True,
                "search_type": 1,
                "search_rank": 5,
                "status": "completed"
            }
        }


class VideoResponse(BaseModel):
    """영상 목록 응답"""
    success: bool
    videos: List[VideoInput]
    stats: dict


class ResultResponse(BaseModel):
    """결과 저장 응답"""
    success: bool
    result_id: Optional[str] = None
    message: str


# === API 엔드포인트 ===

@router.get("/videos", response_model=VideoResponse)
@limiter.limit(settings.rate_limit_read)
async def get_videos(
    request: Request,
    status: Optional[str] = Query(None, description="필터링할 상태 (pending, completed, error)"),
    limit: int = Query(50, ge=1, le=200, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋")
):
    """
    영상 목록 조회
    
    - 상태별 필터링 지원
    - 페이지네이션 지원
    """
    try:
        supabase = get_supabase_client()
        
        # 쿼리 빌드
        query = supabase.table("videos").select("*")
        
        if status:
            query = query.eq("status", status)
        
        query = query.range(offset, offset + limit - 1).order("created_at", desc=True)
        
        result = query.execute()
        
        # 통계 조회
        stats_query = supabase.rpc("get_video_stats")
        stats_result = stats_query.execute()
        
        stats = stats_result.data[0] if stats_result.data else {
            "total": len(result.data),
            "pending": 0,
            "completed": 0,
            "error": 0
        }
        
        return VideoResponse(
            success=True,
            videos=[VideoInput(**v) for v in result.data],
            stats=stats
        )
        
    except Exception as e:
        logger.error(f"영상 목록 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch videos: {str(e)}")


@router.post("/videos", response_model=dict)
@limiter.limit(settings.rate_limit_write)
async def add_video(request: Request, video: VideoInput):
    """
    영상 추가 (수동 또는 Webhook)
    """
    try:
        supabase = get_supabase_client()
        
        # 중복 체크
        existing = supabase.table("videos").select("id").eq("id", video.id).execute()
        
        if existing.data:
            return {"success": False, "message": "이미 존재하는 영상입니다", "video_id": video.id}
        
        # 삽입
        insert_data = {
            "id": video.id,
            "keyword": video.keyword,
            "title": video.title,
            "url": video.url,
            "status": VideoStatus.PENDING,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("videos").insert(insert_data).execute()
        
        return {"success": True, "message": "영상 추가 완료", "video_id": video.id}
        
    except Exception as e:
        logger.error(f"영상 추가 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add video: {str(e)}")


@router.post("/results", response_model=ResultResponse)
@limiter.limit(settings.rate_limit_write)
async def save_result(request: Request, result: WatchResult):
    """
    시청 결과 저장
    
    - 디바이스에서 전송된 시청 결과를 DB에 저장
    - 영상 상태 업데이트
    """
    try:
        supabase = get_supabase_client()
        
        # 결과 저장
        insert_data = {
            "device_id": result.device_id,
            "video_id": result.video_id,
            "title": result.title,
            "watch_time": result.watch_time,
            "total_duration": result.total_duration,
            "commented": result.commented,
            "comment_text": result.comment_text,
            "liked": result.liked,
            "search_type": result.search_type,
            "search_rank": result.search_rank,
            "screenshot_url": result.screenshot_path,
            "status": result.status,
            "error_message": result.error_message,
            "created_at": datetime.utcnow().isoformat()
        }
        
        db_result = supabase.table("results").insert(insert_data).execute()
        
        # 영상 상태 업데이트
        video_update = {"status": result.status, "updated_at": datetime.utcnow().isoformat()}
        
        if result.liked:
            video_update["total_likes"] = supabase.rpc(
                "increment_counter",
                {"table_name": "videos", "column_name": "total_likes", "row_id": result.video_id}
            )
        
        if result.commented:
            video_update["total_comments"] = supabase.rpc(
                "increment_counter",
                {"table_name": "videos", "column_name": "total_comments", "row_id": result.video_id}
            )
        
        supabase.table("videos").update(video_update).eq("id", result.video_id).execute()
        
        result_id = db_result.data[0]["id"] if db_result.data else None
        
        logger.info(f"결과 저장 완료: video={result.video_id}, device={result.device_id}")
        
        return ResultResponse(
            success=True,
            result_id=result_id,
            message="시청 결과가 저장되었습니다"
        )
        
    except Exception as e:
        logger.error(f"결과 저장 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save result: {str(e)}")


@router.get("/stats")
@limiter.limit(settings.rate_limit_read)
async def get_stats(request: Request):
    """
    전체 통계 조회
    """
    try:
        supabase = get_supabase_client()
        
        # 영상 통계
        videos_stats = supabase.rpc("get_video_stats").execute()
        
        # 디바이스 통계
        device_stats = supabase.rpc("get_device_stats").execute()
        
        # 오늘 결과
        today_results = supabase.table("results")\
            .select("count", count="exact")\
            .gte("created_at", datetime.utcnow().date().isoformat())\
            .execute()
        
        return {
            "success": True,
            "videos": videos_stats.data[0] if videos_stats.data else {},
            "devices": device_stats.data[0] if device_stats.data else {},
            "today_completed": today_results.count or 0
        }
        
    except Exception as e:
        logger.error(f"통계 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.delete("/videos/{video_id}")
@limiter.limit(settings.rate_limit_write)
async def delete_video(request: Request, video_id: str):
    """
    영상 삭제
    """
    try:
        supabase = get_supabase_client()
        
        # 관련 결과도 함께 삭제
        supabase.table("results").delete().eq("video_id", video_id).execute()
        supabase.table("videos").delete().eq("id", video_id).execute()
        
        return {"success": True, "message": f"영상 {video_id} 삭제 완료"}
        
    except Exception as e:
        logger.error(f"영상 삭제 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


