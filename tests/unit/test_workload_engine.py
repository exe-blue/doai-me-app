"""
WorkloadEngine 단위 테스트

테스트 대상:
- WorkloadState 상태 초기화
- WorkloadStatus 상태 전이
- _calculate_next_video() - 다음 영상 선택
- _should_continue_cycle() - 종료 조건 검사
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from shared.workload_engine import WorkloadEngine, WorkloadState
from shared.schemas.workload import (
    WorkloadStatus,
    WorkloadCreate,
    BatchConfig,
    WatchConfig,
    WorkloadCycleResult,
)


class TestWorkloadState:
    """WorkloadState 데이터클래스 테스트"""
    
    def test_create_with_defaults(self):
        """기본값으로 생성"""
        state = WorkloadState(workload_id="wl-001")
        
        assert state.workload_id == "wl-001"
        assert state.status == WorkloadStatus.PENDING
        assert state.current_video_index == 0
        assert state.current_batch == 0
        assert state.total_batches == 0
        assert state.total_tasks == 0
        assert state.completed_tasks == 0
        assert state.failed_tasks == 0
        assert state.is_running is False
        assert state.should_stop is False
        assert state.last_error is None
    
    def test_create_with_values(self):
        """값 지정하여 생성"""
        state = WorkloadState(
            workload_id="wl-002",
            status=WorkloadStatus.EXECUTING,
            current_video_index=3,
            total_tasks=10,
            completed_tasks=5,
            is_running=True
        )
        
        assert state.status == WorkloadStatus.EXECUTING
        assert state.current_video_index == 3
        assert state.completed_tasks == 5
        assert state.is_running is True
    
    def test_cycle_results_list(self):
        """사이클 결과 리스트"""
        state = WorkloadState(workload_id="wl-003")
        
        assert isinstance(state.cycle_results, list)
        assert len(state.cycle_results) == 0


class TestWorkloadStatus:
    """WorkloadStatus Enum 테스트"""
    
    def test_status_values(self):
        """상태 값 확인"""
        assert WorkloadStatus.PENDING.value == "pending"
        assert WorkloadStatus.LISTING.value == "listing"
        assert WorkloadStatus.EXECUTING.value == "executing"
        assert WorkloadStatus.RECORDING.value == "recording"
        assert WorkloadStatus.WAITING.value == "waiting"
        assert WorkloadStatus.COMPLETED.value == "completed"
        assert WorkloadStatus.PAUSED.value == "paused"
        assert WorkloadStatus.CANCELLED.value == "cancelled"
        assert WorkloadStatus.ERROR.value == "error"
    
    def test_all_statuses(self):
        """모든 상태 존재 확인"""
        expected = [
            "pending", "listing", "executing", "recording",
            "waiting", "completed", "paused", "cancelled", "error"
        ]
        
        actual = [s.value for s in WorkloadStatus]
        
        for status in expected:
            assert status in actual


class TestWorkloadStatusTransitions:
    """상태 전이 테스트"""
    
    def test_pending_to_listing(self):
        """PENDING -> LISTING"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.PENDING
        )
        
        # 시작 시 LISTING으로 전이
        state.status = WorkloadStatus.LISTING
        assert state.status == WorkloadStatus.LISTING
    
    def test_listing_to_executing(self):
        """LISTING -> EXECUTING"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.LISTING
        )
        
        # 영상 선택 후 EXECUTING으로 전이
        state.status = WorkloadStatus.EXECUTING
        assert state.status == WorkloadStatus.EXECUTING
    
    def test_executing_to_recording(self):
        """EXECUTING -> RECORDING"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.EXECUTING
        )
        
        # 실행 완료 후 RECORDING으로 전이
        state.status = WorkloadStatus.RECORDING
        assert state.status == WorkloadStatus.RECORDING
    
    def test_recording_to_waiting(self):
        """RECORDING -> WAITING"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.RECORDING
        )
        
        # 기록 완료 후 WAITING으로 전이
        state.status = WorkloadStatus.WAITING
        assert state.status == WorkloadStatus.WAITING
    
    def test_waiting_to_listing(self):
        """WAITING -> LISTING (사이클 반복)"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.WAITING
        )
        
        # 대기 후 다음 영상 선택을 위해 LISTING으로
        state.status = WorkloadStatus.LISTING
        assert state.status == WorkloadStatus.LISTING
    
    def test_any_to_paused(self):
        """아무 상태 -> PAUSED"""
        for status in [WorkloadStatus.LISTING, WorkloadStatus.EXECUTING, WorkloadStatus.WAITING]:
            state = WorkloadState(workload_id="wl-001", status=status)
            state.status = WorkloadStatus.PAUSED
            assert state.status == WorkloadStatus.PAUSED
    
    def test_paused_to_previous(self):
        """PAUSED -> 이전 상태 (재개)"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.PAUSED
        )
        
        # 재개 시 LISTING으로 돌아감
        state.status = WorkloadStatus.LISTING
        assert state.status == WorkloadStatus.LISTING
    
    def test_any_to_cancelled(self):
        """아무 상태 -> CANCELLED"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.EXECUTING
        )
        
        state.status = WorkloadStatus.CANCELLED
        assert state.status == WorkloadStatus.CANCELLED
    
    def test_any_to_error(self):
        """아무 상태 -> ERROR"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.EXECUTING
        )
        
        state.status = WorkloadStatus.ERROR
        state.last_error = "테스트 에러"
        
        assert state.status == WorkloadStatus.ERROR
        assert state.last_error == "테스트 에러"
    
    def test_to_completed(self):
        """-> COMPLETED (종료)"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.RECORDING,
            total_tasks=10,
            completed_tasks=10
        )
        
        state.status = WorkloadStatus.COMPLETED
        assert state.status == WorkloadStatus.COMPLETED


class TestWorkloadEngineCalculateNextVideo:
    """다음 영상 선택 테스트"""
    
    @pytest.fixture
    def engine(self):
        return WorkloadEngine()
    
    def test_first_video(self, engine):
        """첫 번째 영상 선택"""
        videos = [
            {"id": "v1", "title": "영상 1"},
            {"id": "v2", "title": "영상 2"},
            {"id": "v3", "title": "영상 3"},
        ]
        
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=0
        )
        
        # 인덱스 0의 영상 선택
        video = engine._get_video_at_index(videos, state.current_video_index)
        
        assert video["id"] == "v1"
    
    def test_next_video(self, engine):
        """다음 영상으로 이동"""
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=0
        )
        
        # 인덱스 증가
        state.current_video_index += 1
        
        assert state.current_video_index == 1
    
    def test_last_video(self, engine):
        """마지막 영상"""
        videos = [{"id": "v1"}, {"id": "v2"}, {"id": "v3"}]
        
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=2
        )
        
        video = engine._get_video_at_index(videos, state.current_video_index)
        
        assert video["id"] == "v3"


class TestWorkloadEngineShouldContinue:
    """종료 조건 검사 테스트"""
    
    @pytest.fixture
    def engine(self):
        return WorkloadEngine()
    
    def test_continue_with_remaining_videos(self, engine):
        """남은 영상이 있으면 계속"""
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=0,
            should_stop=False
        )
        
        total_videos = 5
        should_continue = engine._should_continue_cycle(state, total_videos)
        
        assert should_continue is True
    
    def test_stop_when_all_done(self, engine):
        """모든 영상 완료 시 종료"""
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=5,
            should_stop=False
        )
        
        total_videos = 5
        should_continue = engine._should_continue_cycle(state, total_videos)
        
        assert should_continue is False
    
    def test_stop_when_flag_set(self, engine):
        """정지 플래그 설정 시 종료"""
        state = WorkloadState(
            workload_id="wl-001",
            current_video_index=2,
            should_stop=True
        )
        
        total_videos = 5
        should_continue = engine._should_continue_cycle(state, total_videos)
        
        assert should_continue is False
    
    def test_stop_when_cancelled(self, engine):
        """취소 상태면 종료"""
        state = WorkloadState(
            workload_id="wl-001",
            status=WorkloadStatus.CANCELLED,
            current_video_index=2
        )
        
        total_videos = 5
        should_continue = engine._should_continue_cycle(state, total_videos)
        
        assert should_continue is False


class TestWorkloadConfig:
    """WorkloadCreate 설정 테스트"""
    
    def test_default_config(self):
        """기본 설정"""
        config = WorkloadCreate(
            name="테스트 워크로드",
            video_ids=["v1", "v2", "v3"]
        )
        
        assert config.name == "테스트 워크로드"
        assert len(config.video_ids) == 3
    
    def test_with_batch_config(self):
        """배치 설정 포함"""
        batch_config = BatchConfig(
            device_percent=0.3,
            batch_interval_seconds=120
        )
        
        config = WorkloadCreate(
            name="배치 워크로드",
            video_ids=["v1"],
            batch_config=batch_config
        )
        
        assert config.batch_config.device_percent == 0.3
    
    def test_with_watch_config(self):
        """시청 설정 포함"""
        watch_config = WatchConfig(
            min_watch_percent=0.8,
            like_probability=0.30
        )
        
        config = WorkloadCreate(
            name="시청 워크로드",
            video_ids=["v1"],
            watch_config=watch_config
        )
        
        assert config.watch_config.like_probability == 0.30


class TestWorkloadCycleResult:
    """워크로드 사이클 결과 테스트"""
    
    def test_create_cycle_result(self):
        """사이클 결과 생성"""
        result = WorkloadCycleResult(
            cycle_number=1,
            video_id="v1",
            video_title="테스트 영상",
            total_devices=10,
            success_count=8,
            failed_count=2,
            skipped_count=0
        )
        
        assert result.cycle_number == 1
        assert result.success_count == 8
        assert result.failed_count == 2
    
    def test_success_rate(self):
        """성공률 계산"""
        result = WorkloadCycleResult(
            cycle_number=1,
            video_id="v1",
            video_title="테스트",
            total_devices=10,
            success_count=8,
            failed_count=2,
            skipped_count=0
        )
        
        success_rate = result.success_count / result.total_devices * 100
        assert success_rate == 80.0
