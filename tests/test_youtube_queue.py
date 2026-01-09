"""
YouTube 대기열 서비스 테스트

테스트 항목:
1. 대기열 CRUD 테스트
2. 인터랙션 확률 계산 테스트
3. AI 검색어 생성 테스트

Usage:
    pytest tests/test_youtube_queue.py -v
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

# 스키마 테스트 (DB 연결 없이)
from shared.schemas.youtube_queue import (
    QueueSource,
    QueueStatus,
    ExecutionStatus,
    SearchMethod,
    VideoQueueCreate,
    VideoQueueUpdate,
    VideoQueueResponse,
    ExecutionLogCreate,
    CommentCategory,
    CommentPoolCreate,
    DispatchRequest,
    QueueSummary,
)


class TestYouTubeQueueSchemas:
    """스키마 유효성 테스트"""
    
    def test_video_queue_create_valid(self):
        """유효한 대기열 생성 요청"""
        request = VideoQueueCreate(
            youtube_video_id="dQw4w9WgXcQ",
            title="테스트 영상",
            source=QueueSource.DIRECT,
            target_device_percent=0.5,
            like_probability=0.20,
            comment_probability=0.05
        )
        
        assert request.youtube_video_id == "dQw4w9WgXcQ"
        assert request.target_device_percent == 0.5
        assert request.like_probability == 0.20
        assert request.comment_probability == 0.05
    
    def test_video_queue_create_with_schedule(self):
        """예약 시간이 있는 대기열 생성"""
        scheduled_time = datetime.now(timezone.utc) + timedelta(hours=1)
        
        request = VideoQueueCreate(
            youtube_video_id="abc123xyz",
            title="예약 영상",
            source=QueueSource.CHANNEL_API,
            scheduled_at=scheduled_time,
            target_executions=10
        )
        
        assert request.scheduled_at == scheduled_time
        assert request.target_executions == 10
    
    def test_video_queue_create_defaults(self):
        """기본값 테스트"""
        request = VideoQueueCreate(
            youtube_video_id="test123",
            title="기본값 테스트"
        )
        
        assert request.source == QueueSource.DIRECT
        assert request.target_device_percent == 0.5
        assert request.target_executions == 1
        assert request.like_probability == 0.20
        assert request.comment_probability == 0.05
        assert request.priority == 5
    
    def test_video_queue_update(self):
        """대기열 업데이트 요청"""
        update = VideoQueueUpdate(
            priority=8,
            status=QueueStatus.READY
        )
        
        assert update.priority == 8
        assert update.status == QueueStatus.READY
        assert update.scheduled_at is None  # 미지정 필드는 None
    
    def test_execution_log_create(self):
        """실행 로그 생성"""
        log = ExecutionLogCreate(
            queue_item_id="queue-123",
            device_id="device-456",
            status=ExecutionStatus.SUCCESS,
            watch_duration_seconds=180,
            target_duration_seconds=240,
            did_like=True,
            did_comment=False,
            device_logged_in=True
        )
        
        assert log.status == ExecutionStatus.SUCCESS
        assert log.watch_duration_seconds == 180
        assert log.did_like is True
        assert log.did_comment is False
    
    def test_execution_status_enum(self):
        """실행 상태 Enum 값"""
        assert ExecutionStatus.SUCCESS.value == "success"
        assert ExecutionStatus.PARTIAL.value == "partial"
        assert ExecutionStatus.FAILED.value == "failed"
        assert ExecutionStatus.ERROR.value == "error"
        assert ExecutionStatus.SKIPPED.value == "skipped"
    
    def test_comment_pool_create(self):
        """댓글 풀 생성"""
        comment = CommentPoolCreate(
            content="좋은 영상이네요!",
            category=CommentCategory.POSITIVE,
            language="ko",
            weight=100
        )
        
        assert comment.content == "좋은 영상이네요!"
        assert comment.category == CommentCategory.POSITIVE
    
    def test_dispatch_request(self):
        """작업 분배 요청"""
        request = DispatchRequest(
            device_percent=0.5,
            workstation_id="WS01"
        )
        
        assert request.device_percent == 0.5
        assert request.workstation_id == "WS01"


class TestInteractionProbability:
    """인터랙션 확률 계산 테스트 (정적 메서드)"""
    
    def test_like_probability_default(self):
        """기본 좋아요 확률 (20%)"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 조회수 무관 기본 확률
        prob = YouTubeQueueService.calculate_like_probability(0.20, None)
        assert prob == 0.20
    
    def test_like_probability_low_views(self):
        """저조회수 영상 좋아요 확률 증가"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 1000 미만 조회수 → 2배
        prob = YouTubeQueueService.calculate_like_probability(0.20, 500)
        assert prob == 0.40
    
    def test_like_probability_medium_views(self):
        """중간 조회수 영상 좋아요 확률"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 1000~10000 조회수 → 1.5배
        prob = YouTubeQueueService.calculate_like_probability(0.20, 5000)
        assert prob == pytest.approx(0.30)
    
    def test_like_probability_high_views(self):
        """고조회수 영상 좋아요 확률"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 10000 이상 조회수 → 기본 확률
        prob = YouTubeQueueService.calculate_like_probability(0.20, 100000)
        assert prob == 0.20
    
    def test_should_like_logged_in(self):
        """로그인 상태에서 좋아요 확률"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 확률 100%로 테스트
        result = YouTubeQueueService.should_like(1.0, is_logged_in=True)
        assert result is True
        
        # 확률 0%로 테스트
        result = YouTubeQueueService.should_like(0.0, is_logged_in=True)
        assert result is False
    
    def test_should_like_not_logged_in(self):
        """비로그인 상태에서 좋아요 항상 False"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        # 확률 100%여도 비로그인이면 False
        result = YouTubeQueueService.should_like(1.0, is_logged_in=False)
        assert result is False
    
    def test_should_comment_not_logged_in(self):
        """비로그인 상태에서 댓글 항상 False"""
        from shared.youtube_queue_service import YouTubeQueueService
        
        result = YouTubeQueueService.should_comment(1.0, is_logged_in=False)
        assert result is False


class TestAISearchGenerator:
    """AI 검색어 생성 테스트 (정적 메서드)"""
    
    def test_fallback_keywords(self):
        """폴백 키워드 반환"""
        from shared.ai_search_generator import AISearchGenerator, FALLBACK_KEYWORDS
        
        keyword = AISearchGenerator._get_fallback_keyword()
        assert keyword in FALLBACK_KEYWORDS
    
    def test_fallback_with_exclusions(self):
        """제외 키워드가 있는 폴백"""
        from shared.ai_search_generator import AISearchGenerator, FALLBACK_KEYWORDS
        
        # 일부 키워드 제외
        exclude = FALLBACK_KEYWORDS[:5]
        keyword = AISearchGenerator._get_fallback_keyword(exclude_keywords=exclude)
        
        # 제외된 키워드가 아니어야 함
        assert keyword not in exclude
    
    def test_clean_keyword(self):
        """검색어 후처리"""
        from shared.ai_search_generator import AISearchGenerator
        
        # 따옴표 제거
        assert AISearchGenerator._clean_keyword('"브이로그"') == "브이로그"
        assert AISearchGenerator._clean_keyword("'게임'") == "게임"
        
        # 줄바꿈 제거 (첫 줄만)
        assert AISearchGenerator._clean_keyword("먹방\n설명입니다") == "먹방"
        
        # 공백 제거
        assert AISearchGenerator._clean_keyword("  요리  ") == "요리"
    
    def test_prompt_building(self):
        """프롬프트 구성"""
        from shared.ai_search_generator import AISearchGenerator, CATEGORY_PROMPTS
        
        # 카테고리 프롬프트 추가
        prompt = AISearchGenerator._build_prompt(category="gaming", context=None, exclude_keywords=None)
        assert "게임" in prompt or "gaming" in prompt.lower()


class TestQueueSummary:
    """대기열 요약 테스트"""
    
    def test_queue_summary_defaults(self):
        """기본 요약 통계"""
        summary = QueueSummary()
        
        assert summary.total_items == 0
        assert summary.pending == 0
        assert summary.ready == 0
        assert summary.executing == 0
        assert summary.completed == 0
        assert summary.failed == 0
        assert summary.cancelled == 0


# 통합 테스트 (DB 연결 필요)
@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL"),
    reason="SUPABASE_URL 환경변수 필요"
)
class TestYouTubeQueueServiceIntegration:
    """통합 테스트 (DB 연결 필요)"""
    
    @pytest.fixture
    def service(self):
        """서비스 인스턴스"""
        from shared.youtube_queue_service import YouTubeQueueService
        return YouTubeQueueService()
    
    @pytest.mark.asyncio
    async def test_add_and_get_video(self, service):
        """영상 추가 및 조회"""
        # 테스트 영상 추가
        request = VideoQueueCreate(
            youtube_video_id=f"test_{datetime.now().timestamp()}",
            title="통합 테스트 영상",
            source=QueueSource.DIRECT,
            duration_seconds=180
        )
        
        try:
            result = await service.add_video(request)
            
            assert result.youtube_video_id == request.youtube_video_id
            assert result.title == request.title
            assert result.status in [QueueStatus.PENDING, QueueStatus.READY]
            
            # 조회 테스트
            fetched = await service.get_queue_item(result.id)
            assert fetched is not None
            assert fetched.id == result.id
            
            # 정리
            await service.delete_queue_item(result.id)
        except Exception as e:
            # 테이블이 없으면 스킵
            if "does not exist" in str(e):
                pytest.skip("video_queue 테이블이 없습니다. 마이그레이션을 먼저 실행하세요.")
            raise


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
