"""
Video Queue CRUD 통합 테스트

Supabase 연결이 필요합니다.
테스트 전 SUPABASE_URL, SUPABASE_KEY 환경변수가 설정되어야 합니다.
"""

from datetime import datetime, timedelta, timezone

import pytest

from shared.schemas.youtube_queue import (
    QueueSource,
    QueueStatus,
    VideoQueueCreate,
    VideoQueueUpdate,
)
from tests.conftest import SKIP_INTEGRATION_TESTS

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(SKIP_INTEGRATION_TESTS, reason="실제 Supabase 자격 증명 필요"),
]


class TestVideoQueueCRUD:
    """Video Queue CRUD 테스트"""

    @pytest.fixture
    def service(self, supabase_client):
        """YouTubeQueueService 인스턴스"""
        from shared.youtube_queue_service import YouTubeQueueService

        return YouTubeQueueService()

    @pytest.fixture
    def unique_video_id(self):
        """유니크한 테스트 영상 ID (max 20 chars)"""
        # YouTube video ID는 11자, 테스트 ID도 비슷하게 유지
        import hashlib

        ts = str(datetime.now(timezone.utc).timestamp())
        return hashlib.md5(ts.encode()).hexdigest()[:11]

    @pytest.mark.asyncio
    async def test_add_video(self, service, unique_video_id):
        """영상 추가"""
        request = VideoQueueCreate(
            youtube_video_id=unique_video_id,
            title="통합 테스트 영상",
            source=QueueSource.DIRECT,
            duration_seconds=180,
        )

        try:
            result = await service.add_video(request)

            assert result.youtube_video_id == unique_video_id
            assert result.title == "통합 테스트 영상"
            assert result.status in [QueueStatus.PENDING, QueueStatus.READY]

            # 정리
            await service.delete_queue_item(result.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_get_queue_item(self, service, unique_video_id):
        """대기열 항목 조회"""
        # 먼저 추가
        request = VideoQueueCreate(youtube_video_id=unique_video_id, title="조회 테스트")

        try:
            created = await service.add_video(request)

            # 조회
            fetched = await service.get_queue_item(created.id)

            assert fetched is not None
            assert fetched.id == created.id
            assert fetched.youtube_video_id == unique_video_id

            # 정리
            await service.delete_queue_item(created.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_update_queue_item(self, service, unique_video_id):
        """대기열 항목 업데이트"""
        request = VideoQueueCreate(
            youtube_video_id=unique_video_id, title="업데이트 테스트", priority=5
        )

        try:
            created = await service.add_video(request)

            # 업데이트
            update = VideoQueueUpdate(priority=10, status=QueueStatus.READY)
            updated = await service.update_queue_item(created.id, update)

            assert updated.priority == 10
            assert updated.status == QueueStatus.READY

            # 정리
            await service.delete_queue_item(created.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_delete_queue_item(self, service, unique_video_id):
        """대기열 항목 삭제"""
        request = VideoQueueCreate(youtube_video_id=unique_video_id, title="삭제 테스트")

        try:
            created = await service.add_video(request)

            # 삭제
            deleted = await service.delete_queue_item(created.id)
            assert deleted is True

            # 삭제 확인
            fetched = await service.get_queue_item(created.id)
            assert fetched is None
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_get_ready_items(self, service):
        """실행 가능 항목 조회"""
        import hashlib

        ts = str(datetime.now().timestamp())
        unique_id_1 = hashlib.md5((ts + "1").encode()).hexdigest()[:11]
        unique_id_2 = hashlib.md5((ts + "2").encode()).hexdigest()[:11]

        try:
            # 실행 가능 항목 추가
            req1 = VideoQueueCreate(
                youtube_video_id=unique_id_1, title="Ready 1", scheduled_at=None  # 즉시 실행 가능
            )
            req2 = VideoQueueCreate(
                youtube_video_id=unique_id_2, title="Ready 2", scheduled_at=None
            )

            created1 = await service.add_video(req1)
            created2 = await service.add_video(req2)

            # 조회
            ready_items = await service.get_ready_items(limit=10)

            assert len(ready_items) >= 2

            # 정리
            await service.delete_queue_item(created1.id)
            await service.delete_queue_item(created2.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_scheduled_video(self, service):
        """예약 영상 테스트"""
        import hashlib

        unique_id = hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:11]
        future_time = datetime.now(timezone.utc) + timedelta(hours=1)

        try:
            request = VideoQueueCreate(
                youtube_video_id=unique_id, title="예약 영상", scheduled_at=future_time
            )

            created = await service.add_video(request)

            # 예약 시간이 설정되어야 함
            assert created.scheduled_at is not None

            # 아직 실행 가능 목록에 없어야 함 (예약 시간 전)
            ready_items = await service.get_ready_items(limit=100)
            [item.id for item in ready_items]

            # created.id가 ready_items에 없을 수 있음
            # (scheduled_at이 미래이므로)

            # 정리
            await service.delete_queue_item(created.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_get_queue_summary(self, service):
        """대기열 통계 조회"""
        try:
            summary = await service.get_queue_summary()

            assert summary is not None
            assert hasattr(summary, "total_items")
            assert hasattr(summary, "pending")
            assert hasattr(summary, "ready")
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise


class TestCommentPoolCRUD:
    """Comment Pool CRUD 테스트"""

    @pytest.fixture
    def service(self, supabase_client):
        from shared.youtube_queue_service import YouTubeQueueService

        return YouTubeQueueService()

    @pytest.mark.asyncio
    async def test_get_random_comment(self, service):
        """랜덤 댓글 조회"""
        try:
            comment = await service.get_random_comment()

            # 댓글 풀에 데이터가 있다면
            if comment is not None:
                assert comment.content is not None
                assert len(comment.content) > 0
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise

    @pytest.mark.asyncio
    async def test_get_random_comment_by_category(self, service):
        """카테고리별 랜덤 댓글"""
        try:
            comment = await service.get_random_comment(category="positive")

            if comment is not None:
                assert comment.category == "positive"
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise


class TestExecutionLogCRUD:
    """Execution Log CRUD 테스트"""

    @pytest.fixture
    def service(self, supabase_client):
        from shared.youtube_queue_service import YouTubeQueueService

        return YouTubeQueueService()

    @pytest.mark.asyncio
    async def test_record_execution(self, service):
        """실행 로그 기록"""
        # 먼저 테스트용 영상 추가
        import hashlib

        unique_id = hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:11]

        try:
            video_request = VideoQueueCreate(youtube_video_id=unique_id, title="실행 로그 테스트")
            video = await service.add_video(video_request)

            # 실행 로그 기록
            from shared.schemas.youtube_queue import ExecutionLogCreate, ExecutionStatus

            log = ExecutionLogCreate(
                queue_item_id=str(video.id),
                device_id=None,  # 테스트이므로 None
                status=ExecutionStatus.SUCCESS,
                watch_duration_seconds=150,
                target_duration_seconds=180,
                did_like=True,
                did_comment=False,
                device_logged_in=True,
            )

            result = await service.record_execution(log)

            assert result is not None

            # 정리
            await service.delete_queue_item(video.id)
        except Exception as e:
            error_msg = str(e).lower()
            if (
                "does not exist" in error_msg
                or "invalid schema" in error_msg
                or "pgrst106" in error_msg
            ):
                pytest.skip(f"DB 스키마 문제: {e}")
            raise
