"""
Pydantic 스키마 유효성 테스트

테스트 대상:
- VideoQueueCreate, VideoQueueUpdate
- ExecutionLogCreate
- CommentPoolCreate
- DispatchRequest, QueueSummary
- WorkloadCreate, BatchConfig, WatchConfig
"""

import pytest
from datetime import datetime, timezone, timedelta

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
from shared.schemas.workload import (
    WorkloadStatus,
    WorkloadCreate,
    BatchConfig,
    WatchConfig,
)


class TestVideoQueueSchemas:
    """VideoQueue 관련 스키마 테스트"""
    
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
    
    def test_video_queue_update_partial(self):
        """대기열 부분 업데이트 요청"""
        update = VideoQueueUpdate(
            priority=8,
            status=QueueStatus.READY
        )
        
        assert update.priority == 8
        assert update.status == QueueStatus.READY
        assert update.scheduled_at is None
    
    def test_video_queue_update_status_only(self):
        """상태만 업데이트"""
        update = VideoQueueUpdate(status=QueueStatus.EXECUTING)
        assert update.status == QueueStatus.EXECUTING
        assert update.priority is None


class TestExecutionLogSchemas:
    """ExecutionLog 관련 스키마 테스트"""
    
    def test_execution_log_create_success(self):
        """성공 실행 로그 생성"""
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
    
    def test_execution_log_create_partial(self):
        """부분 성공 로그"""
        log = ExecutionLogCreate(
            queue_item_id="queue-123",
            device_id="device-456",
            status=ExecutionStatus.PARTIAL,
            watch_duration_seconds=120,
            target_duration_seconds=240,
            did_like=False,
            did_comment=False
        )
        
        assert log.status == ExecutionStatus.PARTIAL
    
    def test_execution_log_create_with_error(self):
        """에러 로그"""
        log = ExecutionLogCreate(
            queue_item_id="queue-123",
            device_id="device-456",
            status=ExecutionStatus.ERROR,
            error_code="APP_CRASH",
            error_message="YouTube 앱 크래시"
        )
        
        assert log.status == ExecutionStatus.ERROR
        assert log.error_code == "APP_CRASH"
    
    def test_execution_status_enum_values(self):
        """실행 상태 Enum 값 확인"""
        assert ExecutionStatus.SUCCESS.value == "success"
        assert ExecutionStatus.PARTIAL.value == "partial"
        assert ExecutionStatus.FAILED.value == "failed"
        assert ExecutionStatus.ERROR.value == "error"
        assert ExecutionStatus.SKIPPED.value == "skipped"


class TestCommentPoolSchemas:
    """CommentPool 관련 스키마 테스트"""
    
    def test_comment_pool_create_korean(self):
        """한국어 댓글 생성"""
        comment = CommentPoolCreate(
            content="좋은 영상이네요!",
            category=CommentCategory.POSITIVE,
            language="ko",
            weight=100
        )
        
        assert comment.content == "좋은 영상이네요!"
        assert comment.category == CommentCategory.POSITIVE
        assert comment.language == "ko"
    
    def test_comment_pool_create_emoji(self):
        """이모지 댓글"""
        comment = CommentPoolCreate(
            content="👍",
            category=CommentCategory.EMOJI,
            language="mixed"
        )
        
        assert comment.category == CommentCategory.EMOJI
    
    def test_comment_category_enum_values(self):
        """댓글 카테고리 Enum 값"""
        assert CommentCategory.GENERAL.value == "general"
        assert CommentCategory.POSITIVE.value == "positive"
        assert CommentCategory.QUESTION.value == "question"
        assert CommentCategory.EMOJI.value == "emoji"
        assert CommentCategory.SHORT.value == "short"


class TestDispatchRequestSchemas:
    """DispatchRequest 스키마 테스트"""
    
    def test_dispatch_request_basic(self):
        """기본 분배 요청"""
        request = DispatchRequest(
            device_percent=0.5,
            workstation_id="WS01"
        )
        
        assert request.device_percent == 0.5
        assert request.workstation_id == "WS01"
    
    def test_dispatch_request_defaults(self):
        """기본값 테스트"""
        request = DispatchRequest()
        
        assert request.device_percent == 0.5
        assert request.workstation_id is None


class TestQueueSummarySchemas:
    """QueueSummary 스키마 테스트"""
    
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
    
    def test_queue_summary_with_values(self):
        """값이 있는 요약 통계"""
        summary = QueueSummary(
            total_items=100,
            pending=20,
            ready=30,
            executing=10,
            completed=35,
            failed=5,
            cancelled=0
        )
        
        assert summary.total_items == 100
        assert summary.completed == 35


class TestWorkloadSchemas:
    """Workload 관련 스키마 테스트"""

    def test_batch_config_defaults(self):
        """BatchConfig 기본값"""
        config = BatchConfig()

        assert config.batch_size_percent == 50
        assert config.batch_interval_seconds == 60

    def test_batch_config_custom(self):
        """BatchConfig 커스텀 값"""
        config = BatchConfig(
            batch_size_percent=30,
            batch_interval_seconds=120,
            cycle_interval_seconds=400
        )

        assert config.batch_size_percent == 30
        assert config.batch_interval_seconds == 120

    def test_watch_config_defaults(self):
        """WatchConfig 기본값"""
        config = WatchConfig()

        assert config.watch_duration_min == 30
        assert config.watch_duration_max == 120
        assert config.like_probability == 0.05
        assert config.comment_probability == 0.02

    def test_watch_config_custom(self):
        """WatchConfig 커스텀 값"""
        config = WatchConfig(
            watch_duration_min=45,
            watch_duration_max=90,
            like_probability=0.30,
            comment_probability=0.10,
            enable_random_scroll=False
        )

        assert config.like_probability == 0.30
        assert config.comment_probability == 0.10
    
    def test_workload_status_enum_values(self):
        """WorkloadStatus Enum 값"""
        assert WorkloadStatus.PENDING.value == "pending"
        assert WorkloadStatus.LISTING.value == "listing"
        assert WorkloadStatus.EXECUTING.value == "executing"
        assert WorkloadStatus.RECORDING.value == "recording"
        assert WorkloadStatus.WAITING.value == "waiting"
        assert WorkloadStatus.COMPLETED.value == "completed"
        assert WorkloadStatus.PAUSED.value == "paused"
        assert WorkloadStatus.CANCELLED.value == "cancelled"
        assert WorkloadStatus.ERROR.value == "error"


class TestQueueSourceEnum:
    """QueueSource Enum 테스트"""
    
    def test_queue_source_values(self):
        """소스 타입 값 확인"""
        assert QueueSource.CHANNEL_API.value == "channel_api"
        assert QueueSource.DIRECT.value == "direct"
        assert QueueSource.AI_GENERATED.value == "ai_generated"


class TestSearchMethodEnum:
    """SearchMethod Enum 테스트"""
    
    def test_search_method_values(self):
        """검색 방법 값 확인"""
        assert SearchMethod.TITLE.value == "title"
        assert SearchMethod.KEYWORD.value == "keyword"
        assert SearchMethod.URL.value == "url"
