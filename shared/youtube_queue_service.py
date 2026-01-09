"""
YouTubeQueueService - 영상 대기열 관리 서비스

영상 등록, 예약, 실행 관리를 담당합니다.

주요 기능:
1. 영상 등록 (직접/채널 API/AI 생성)
2. 예약 실행 (scheduled_at)
3. 인터랙션 확률 관리 (좋아요 20%, 댓글 5%)
4. 실행 결과 기록
"""

import asyncio
import random
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import uuid

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.supabase_client import get_client
from shared.schemas.youtube_queue import (
    QueueSource,
    QueueStatus,
    ExecutionStatus,
    SearchMethod,
    VideoQueueCreate,
    VideoQueueUpdate,
    VideoQueueResponse,
    ExecutionLogCreate,
    ExecutionLogInDB,
    CommentPoolCreate,
    CommentPoolInDB,
    QueueSummary,
    DailyExecutionStats
)


class YouTubeQueueService:
    """
    YouTube 영상 대기열 관리 서비스
    
    Usage:
        service = YouTubeQueueService()
        
        # 영상 직접 등록
        item = await service.add_video(VideoQueueCreate(
            youtube_video_id="dQw4w9WgXcQ",
            title="테스트 영상",
            source=QueueSource.DIRECT,
            target_device_percent=0.5,
            like_probability=0.20,
            comment_probability=0.05
        ))
        
        # 다음 실행할 영상 가져오기
        next_item = await service.get_next_ready_item()
        
        # 실행 결과 기록
        await service.record_execution(ExecutionLogCreate(...))
    """
    
    def __init__(self):
        self.client = get_client()
    
    # =========================================
    # 대기열 관리
    # =========================================
    
    async def add_video(self, request: VideoQueueCreate) -> VideoQueueResponse:
        """
        영상을 대기열에 추가
        
        Args:
            request: 등록 요청
        
        Returns:
            생성된 대기열 항목
        """
        item_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        # 예약 시간이 지났거나 없으면 ready 상태
        is_ready = request.scheduled_at is None or request.scheduled_at <= now
        status = QueueStatus.READY if is_ready else QueueStatus.PENDING
        
        # 검색 키워드가 없으면 제목 사용
        search_keyword = request.search_keyword or request.title
        
        data = {
            "id": item_id,
            "youtube_video_id": request.youtube_video_id,
            "title": request.title,
            "channel_id": request.channel_id,
            "channel_name": request.channel_name,
            "duration_seconds": request.duration_seconds,
            "view_count": request.view_count,
            "thumbnail_url": request.thumbnail_url,
            "source": request.source.value,
            "search_keyword": search_keyword,
            "scheduled_at": request.scheduled_at.isoformat() if request.scheduled_at else None,
            "target_device_percent": request.target_device_percent,
            "target_executions": request.target_executions,
            "completed_executions": 0,
            "failed_executions": 0,
            "like_probability": request.like_probability,
            "comment_probability": request.comment_probability,
            "status": status.value,
            "priority": request.priority,
            "retry_count": 0,
            "max_retries": 3,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        result = self.client.table("video_queue").insert(data).execute()
        
        if not result.data:
            raise Exception("대기열 항목 생성 실패")
        
        logger.info(
            f"영상 대기열 추가: {request.youtube_video_id} "
            f"(source={request.source.value}, status={status.value})"
        )
        
        return self._to_response(result.data[0])
    
    async def add_videos_from_channel(
        self,
        channel_id: str,
        videos: List[Dict[str, Any]],
        **kwargs
    ) -> List[VideoQueueResponse]:
        """
        채널의 영상들을 대기열에 일괄 추가
        
        Args:
            channel_id: YouTube 채널 ID
            videos: 영상 정보 리스트 (videoId, title, duration 등)
            **kwargs: 공통 설정 (target_device_percent, like_probability 등)
        
        Returns:
            생성된 대기열 항목 리스트
        """
        results = []
        
        for video in videos:
            try:
                request = VideoQueueCreate(
                    youtube_video_id=video["videoId"],
                    title=video["title"],
                    channel_id=channel_id,
                    channel_name=video.get("channelTitle"),
                    duration_seconds=video.get("duration"),
                    thumbnail_url=video.get("thumbnail"),
                    source=QueueSource.CHANNEL_API,
                    **kwargs
                )
                item = await self.add_video(request)
                results.append(item)
            except Exception as e:
                logger.warning(f"채널 영상 추가 실패: {video.get('videoId')} - {e}")
        
        logger.info(f"채널 영상 {len(results)}개 추가 완료 (channel={channel_id})")
        return results
    
    async def get_queue_item(self, item_id: str) -> Optional[VideoQueueResponse]:
        """대기열 항목 조회"""
        try:
            result = self.client.table("video_queue").select("*").eq(
                "id", item_id
            ).single().execute()
            
            if result.data:
                return self._to_response(result.data)
            return None
        except Exception:
            return None
    
    async def get_queue_items(
        self,
        status: Optional[QueueStatus] = None,
        source: Optional[QueueSource] = None,
        limit: int = 50
    ) -> List[VideoQueueResponse]:
        """대기열 목록 조회"""
        try:
            query = self.client.table("video_queue").select("*")
            
            if status:
                query = query.eq("status", status.value)
            if source:
                query = query.eq("source", source.value)
            
            result = query.order("priority", desc=True).order(
                "created_at", desc=False
            ).limit(limit).execute()
            
            return [self._to_response(item) for item in (result.data or [])]
        except Exception as e:
            logger.error(f"대기열 목록 조회 실패: {e}")
            return []
    
    async def update_queue_item(
        self,
        item_id: str,
        update: VideoQueueUpdate
    ) -> Optional[VideoQueueResponse]:
        """대기열 항목 수정"""
        try:
            update_data = {
                k: v.value if hasattr(v, 'value') else v
                for k, v in update.model_dump(exclude_unset=True).items()
            }
            update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            result = self.client.table("video_queue").update(
                update_data
            ).eq("id", item_id).execute()
            
            if result.data:
                return self._to_response(result.data[0])
            return None
        except Exception as e:
            logger.error(f"대기열 항목 수정 실패: {item_id} - {e}")
            return None
    
    async def cancel_queue_item(self, item_id: str) -> bool:
        """대기열 항목 취소"""
        try:
            result = self.client.table("video_queue").update({
                "status": QueueStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", item_id).execute()
            
            logger.info(f"대기열 항목 취소: {item_id}")
            return bool(result.data)
        except Exception as e:
            logger.error(f"대기열 항목 취소 실패: {item_id} - {e}")
            return False
    
    async def delete_queue_item(self, item_id: str) -> bool:
        """대기열 항목 삭제"""
        try:
            self.client.table("video_queue").delete().eq("id", item_id).execute()
            logger.info(f"대기열 항목 삭제: {item_id}")
            return True
        except Exception as e:
            logger.error(f"대기열 항목 삭제 실패: {item_id} - {e}")
            return False
    
    # =========================================
    # 실행 관련
    # =========================================
    
    async def get_next_ready_item(self) -> Optional[VideoQueueResponse]:
        """
        다음 실행할 대기열 항목 가져오기
        
        조건:
        - status = 'ready' 또는 (status = 'pending' AND scheduled_at <= now)
        - completed_executions < target_executions
        - retry_count < max_retries
        
        Returns:
            실행 가능한 대기열 항목 (없으면 None)
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # 먼저 pending 상태 중 예약 시간이 도래한 항목들을 ready로 변경
            self.client.table("video_queue").update({
                "status": QueueStatus.READY.value
            }).eq("status", QueueStatus.PENDING.value).lte(
                "scheduled_at", now
            ).execute()
            
            # 실행 가능한 항목 조회
            result = self.client.table("video_queue").select("*").eq(
                "status", QueueStatus.READY.value
            ).order("priority", desc=True).order(
                "created_at", desc=False
            ).limit(1).execute()
            
            if result.data:
                item = result.data[0]
                
                # 목표 달성 여부 체크
                if item["completed_executions"] >= item["target_executions"]:
                    # 이미 완료된 항목 - 상태 업데이트 후 다음 항목 검색
                    self.client.table("video_queue").update({
                        "status": QueueStatus.COMPLETED.value,
                        "completed_at": now
                    }).eq("id", item["id"]).execute()
                    return await self.get_next_ready_item()
                
                return self._to_response(item)
            
            return None
        except Exception as e:
            logger.error(f"다음 실행 항목 조회 실패: {e}")
            return None
    
    async def mark_executing(self, item_id: str) -> bool:
        """대기열 항목을 실행 중 상태로 변경"""
        try:
            result = self.client.table("video_queue").update({
                "status": QueueStatus.EXECUTING.value,
                "first_executed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", item_id).execute()
            
            return bool(result.data)
        except Exception as e:
            logger.error(f"실행 상태 변경 실패: {item_id} - {e}")
            return False
    
    async def mark_ready(self, item_id: str) -> bool:
        """대기열 항목을 다시 ready 상태로 변경 (재시도용)"""
        try:
            result = self.client.table("video_queue").update({
                "status": QueueStatus.READY.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", item_id).execute()
            
            return bool(result.data)
        except Exception as e:
            logger.error(f"ready 상태 변경 실패: {item_id} - {e}")
            return False
    
    async def has_ready_items(self) -> bool:
        """실행 가능한 항목이 있는지 확인"""
        try:
            result = self.client.table("video_queue").select(
                "id", count="exact"
            ).eq("status", QueueStatus.READY.value).limit(1).execute()
            
            return result.count is not None and result.count > 0
        except Exception:
            return False
    
    # =========================================
    # 실행 로그
    # =========================================
    
    async def record_execution(
        self,
        log: ExecutionLogCreate
    ) -> ExecutionLogInDB:
        """
        실행 결과 기록
        
        Args:
            log: 실행 로그 데이터
        
        Returns:
            저장된 로그
        """
        log_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        # watch_percent 계산
        watch_percent = None
        if log.target_duration_seconds and log.watch_duration_seconds:
            watch_percent = round(
                (log.watch_duration_seconds / log.target_duration_seconds) * 100, 2
            )
        
        data = {
            "id": log_id,
            "queue_item_id": log.queue_item_id,
            "device_id": log.device_id,
            "device_hierarchy_id": log.device_hierarchy_id,
            "workstation_id": log.workstation_id,
            "status": log.status.value,
            "watch_duration_seconds": log.watch_duration_seconds,
            "target_duration_seconds": log.target_duration_seconds,
            "did_like": log.did_like,
            "like_attempted": log.like_attempted,
            "did_comment": log.did_comment,
            "comment_attempted": log.comment_attempted,
            "comment_text": log.comment_text,
            "comment_id": log.comment_id,
            "search_keyword": log.search_keyword,
            "search_method": log.search_method.value if log.search_method else None,
            "search_result_rank": log.search_result_rank,
            "device_logged_in": log.device_logged_in,
            "error_code": log.error_code,
            "error_message": log.error_message,
            "screenshot_path": log.screenshot_path,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "completed_at": now.isoformat()
        }
        
        result = self.client.table("execution_logs").insert(data).execute()
        
        if not result.data:
            raise Exception("실행 로그 저장 실패")
        
        # 대기열 항목 통계 업데이트는 DB 트리거로 처리됨
        
        logger.debug(
            f"실행 로그 기록: queue={log.queue_item_id}, "
            f"device={log.device_hierarchy_id}, status={log.status.value}"
        )
        
        return ExecutionLogInDB(
            **log.model_dump(),
            id=log_id,
            watch_percent=watch_percent,
            completed_at=now
        )
    
    async def get_execution_logs(
        self,
        queue_item_id: Optional[str] = None,
        device_id: Optional[str] = None,
        status: Optional[ExecutionStatus] = None,
        limit: int = 100
    ) -> List[ExecutionLogInDB]:
        """실행 로그 조회"""
        try:
            query = self.client.table("execution_logs").select("*")
            
            if queue_item_id:
                query = query.eq("queue_item_id", queue_item_id)
            if device_id:
                query = query.eq("device_id", device_id)
            if status:
                query = query.eq("status", status.value)
            
            result = query.order("completed_at", desc=True).limit(limit).execute()
            
            return [self._log_to_schema(log) for log in (result.data or [])]
        except Exception as e:
            logger.error(f"실행 로그 조회 실패: {e}")
            return []
    
    # =========================================
    # 댓글 풀
    # =========================================
    
    async def get_random_comment(
        self,
        category: Optional[str] = None,
        language: str = "ko"
    ) -> Optional[Tuple[str, str]]:
        """
        랜덤 댓글 가져오기 (가중치 기반)
        
        Args:
            category: 댓글 카테고리 (None=전체)
            language: 언어
        
        Returns:
            (comment_id, content) 또는 None
        """
        try:
            query = self.client.table("comment_pool").select("id, content, weight").eq(
                "is_active", True
            )
            
            if category:
                query = query.eq("category", category)
            
            # language가 'mixed'면 전체, 아니면 해당 언어 + mixed
            if language != "mixed":
                query = query.or_(f"language.eq.{language},language.eq.mixed")
            
            result = query.order("weight", desc=True).limit(20).execute()
            
            if not result.data:
                return None
            
            # 가중치 기반 랜덤 선택
            comments = result.data
            total_weight = sum(c["weight"] for c in comments)
            
            if total_weight == 0:
                selected = random.choice(comments)
            else:
                rand_val = random.uniform(0, total_weight)
                cumulative = 0
                selected = comments[0]
                for comment in comments:
                    cumulative += comment["weight"]
                    if rand_val <= cumulative:
                        selected = comment
                        break
            
            return (selected["id"], selected["content"])
        except Exception as e:
            logger.error(f"랜덤 댓글 가져오기 실패: {e}")
            return None
    
    async def add_comment(self, comment: CommentPoolCreate) -> CommentPoolInDB:
        """댓글 풀에 댓글 추가"""
        comment_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        data = {
            "id": comment_id,
            "content": comment.content,
            "category": comment.category.value,
            "language": comment.language,
            "weight": comment.weight,
            "use_count": 0,
            "is_active": True,
            "created_at": now.isoformat()
        }
        
        result = self.client.table("comment_pool").insert(data).execute()
        
        if not result.data:
            raise Exception("댓글 추가 실패")
        
        return CommentPoolInDB(
            **comment.model_dump(),
            id=comment_id,
            use_count=0,
            is_active=True,
            created_at=now
        )
    
    # =========================================
    # 통계
    # =========================================
    
    async def get_queue_summary(self) -> QueueSummary:
        """대기열 상태 요약"""
        try:
            result = self.client.table("video_queue").select(
                "status", count="exact"
            ).execute()
            
            # 상태별 집계
            summary = QueueSummary()
            
            for status in QueueStatus:
                count_result = self.client.table("video_queue").select(
                    "id", count="exact"
                ).eq("status", status.value).execute()
                
                count = count_result.count or 0
                summary.total_items += count
                setattr(summary, status.value, count)
            
            return summary
        except Exception as e:
            logger.error(f"대기열 요약 조회 실패: {e}")
            return QueueSummary()
    
    async def get_daily_stats(self, days: int = 7) -> List[DailyExecutionStats]:
        """일별 실행 통계"""
        try:
            result = self.client.table("daily_execution_stats").select(
                "*"
            ).limit(days).execute()
            
            return [
                DailyExecutionStats(**stat) for stat in (result.data or [])
            ]
        except Exception as e:
            logger.error(f"일별 통계 조회 실패: {e}")
            return []
    
    # =========================================
    # 인터랙션 확률 계산 (정적 메서드)
    # =========================================
    
    @staticmethod
    def calculate_like_probability(
        base_probability: float,
        view_count: Optional[int]
    ) -> float:
        """
        좋아요 확률 계산 (조회수 기반 조정)
        
        조회수가 적을수록 확률 증가
        
        Args:
            base_probability: 기본 확률 (0.0 ~ 1.0)
            view_count: 조회수 (None이면 기본 확률 반환)
        
        Returns:
            조정된 확률
        """
        if view_count is None:
            return base_probability
        
        if view_count < 1000:
            return min(base_probability * 2.0, 1.0)
        elif view_count < 10000:
            return min(base_probability * 1.5, 1.0)
        return base_probability
    
    @staticmethod
    def calculate_comment_probability(
        base_probability: float,
        view_count: Optional[int]
    ) -> float:
        """
        댓글 확률 계산 (조회수 기반 조정)
        
        조회수가 적을수록 확률 증가
        
        Args:
            base_probability: 기본 확률 (0.0 ~ 1.0)
            view_count: 조회수 (None이면 기본 확률 반환)
        
        Returns:
            조정된 확률
        """
        if view_count is None:
            return base_probability
        
        if view_count < 1000:
            return min(base_probability * 2.0, 1.0)
        elif view_count < 10000:
            return min(base_probability * 1.5, 1.0)
        return base_probability
    
    @staticmethod
    def should_like(
        probability: float,
        is_logged_in: bool
    ) -> bool:
        """
        좋아요 실행 여부 결정
        
        Args:
            probability: 좋아요 확률 (0.0 ~ 1.0)
            is_logged_in: 로그인 상태 여부
        
        Returns:
            True면 좋아요 실행, False면 스킵
        """
        if not is_logged_in:
            return False
        return random.random() < probability
    
    @staticmethod
    def should_comment(
        probability: float,
        is_logged_in: bool
    ) -> bool:
        """
        댓글 실행 여부 결정
        
        Args:
            probability: 댓글 확률 (0.0 ~ 1.0)
            is_logged_in: 로그인 상태 여부
        
        Returns:
            True면 댓글 실행, False면 스킵
        """
        if not is_logged_in:
            return False
        return random.random() < probability
    
    # =========================================
    # 유틸리티
    # =========================================
    
    def _to_response(self, data: Dict[str, Any]) -> VideoQueueResponse:
        """DB 레코드를 응답 스키마로 변환"""
        return VideoQueueResponse(
            id=data["id"],
            youtube_video_id=data["youtube_video_id"],
            title=data["title"],
            channel_id=data.get("channel_id"),
            channel_name=data.get("channel_name"),
            duration_seconds=data.get("duration_seconds"),
            view_count=data.get("view_count"),
            thumbnail_url=data.get("thumbnail_url"),
            source=QueueSource(data["source"]),
            search_keyword=data.get("search_keyword"),
            scheduled_at=datetime.fromisoformat(data["scheduled_at"]) if data.get("scheduled_at") else None,
            is_ready=data.get("is_ready", True),
            target_device_percent=data.get("target_device_percent", 0.5),
            target_executions=data.get("target_executions", 1),
            completed_executions=data.get("completed_executions", 0),
            failed_executions=data.get("failed_executions", 0),
            like_probability=data.get("like_probability", 0.20),
            comment_probability=data.get("comment_probability", 0.05),
            status=QueueStatus(data.get("status", "pending")),
            priority=data.get("priority", 5),
            last_error_code=data.get("last_error_code"),
            last_error_message=data.get("last_error_message"),
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 3),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.utcnow(),
            first_executed_at=datetime.fromisoformat(data["first_executed_at"]) if data.get("first_executed_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None
        )
    
    def _log_to_schema(self, data: Dict[str, Any]) -> ExecutionLogInDB:
        """실행 로그 DB 레코드를 스키마로 변환"""
        return ExecutionLogInDB(
            id=data["id"],
            queue_item_id=data["queue_item_id"],
            device_id=data["device_id"],
            device_hierarchy_id=data.get("device_hierarchy_id"),
            workstation_id=data.get("workstation_id"),
            status=ExecutionStatus(data["status"]),
            watch_duration_seconds=data.get("watch_duration_seconds"),
            target_duration_seconds=data.get("target_duration_seconds"),
            watch_percent=data.get("watch_percent"),
            did_like=data.get("did_like", False),
            like_attempted=data.get("like_attempted", False),
            did_comment=data.get("did_comment", False),
            comment_attempted=data.get("comment_attempted", False),
            comment_text=data.get("comment_text"),
            comment_id=data.get("comment_id"),
            search_keyword=data.get("search_keyword"),
            search_method=SearchMethod(data["search_method"]) if data.get("search_method") else None,
            search_result_rank=data.get("search_result_rank"),
            device_logged_in=data.get("device_logged_in"),
            error_code=data.get("error_code"),
            error_message=data.get("error_message"),
            screenshot_path=data.get("screenshot_path"),
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else datetime.utcnow()
        )


# 싱글톤 인스턴스
_service: Optional[YouTubeQueueService] = None


def get_youtube_queue_service() -> YouTubeQueueService:
    """YouTubeQueueService 싱글톤 반환"""
    global _service
    if _service is None:
        _service = YouTubeQueueService()
    return _service
