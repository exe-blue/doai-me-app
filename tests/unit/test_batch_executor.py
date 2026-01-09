"""
BatchExecutor 단위 테스트

테스트 대상:
- _split_devices_into_groups() - A/B 그룹 분할
- _calculate_batch_delay() - 랜덤 딜레이 계산
- VideoTarget 데이터클래스
- BatchExecutionContext 콜백 처리
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from shared.batch_executor import (
    BatchExecutor,
    BatchExecutionContext,
    VideoTarget,
)
from shared.device_registry import DeviceInfo, DeviceGroup
from shared.schemas.workload import BatchConfig, WatchConfig, CommandStatus


class TestVideoTarget:
    """VideoTarget 데이터클래스 테스트"""
    
    def test_create_with_all_fields(self):
        """모든 필드로 생성"""
        target = VideoTarget(
            video_id="dQw4w9WgXcQ",
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            title="테스트 영상",
            duration_seconds=180
        )
        
        assert target.video_id == "dQw4w9WgXcQ"
        assert target.url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert target.title == "테스트 영상"
        assert target.duration_seconds == 180
    
    def test_create_with_required_fields(self):
        """필수 필드만으로 생성"""
        target = VideoTarget(
            video_id="abc123",
            url="https://youtube.com/watch?v=abc123"
        )
        
        assert target.video_id == "abc123"
        assert target.title is None
        assert target.duration_seconds is None


class TestBatchExecutionContext:
    """BatchExecutionContext 테스트"""
    
    def test_create_with_defaults(self):
        """기본값으로 생성"""
        context = BatchExecutionContext()
        
        assert context.workload_id is None
        assert context.video is None
        assert context.batch_config is not None
        assert context.watch_config is not None
    
    def test_create_with_video(self):
        """영상 정보 포함"""
        video = VideoTarget(
            video_id="test123",
            url="https://youtube.com/watch?v=test123"
        )
        context = BatchExecutionContext(video=video)
        
        assert context.video.video_id == "test123"
    
    def test_create_with_callbacks(self):
        """콜백 함수 포함"""
        async def on_start(device_id, hierarchy_id):
            pass
        
        context = BatchExecutionContext(
            on_device_start=on_start
        )
        
        assert context.on_device_start is not None


class TestBatchExecutorSplitDevices:
    """디바이스 그룹 분할 테스트"""
    
    @pytest.fixture
    def executor(self):
        """BatchExecutor 인스턴스"""
        return BatchExecutor()
    
    @pytest.fixture
    def sample_devices(self):
        """샘플 디바이스 목록"""
        devices = []
        for i in range(10):
            device = DeviceInfo(
                id=f"device-{i:03d}",
                serial_number=f"R58M{i:08d}",
                hierarchy_id=f"WS01-PB01-S{i+1:02d}",
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=i + 1,
                device_group="A" if i < 5 else "B",
                status="idle"
            )
            devices.append(device)
        return devices
    
    def test_split_even_number(self, executor, sample_devices):
        """짝수 개 디바이스 분할"""
        group_a, group_b = executor._split_devices_into_groups(sample_devices)
        
        assert len(group_a) == 5
        assert len(group_b) == 5
        assert len(group_a) + len(group_b) == len(sample_devices)
    
    def test_split_odd_number(self, executor):
        """홀수 개 디바이스 분할"""
        devices = []
        for i in range(7):
            device = DeviceInfo(
                id=f"device-{i:03d}",
                serial_number=f"R58M{i:08d}",
                hierarchy_id=f"WS01-PB01-S{i+1:02d}",
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=i + 1,
                device_group="A" if i < 4 else "B",
                status="idle"
            )
            devices.append(device)
        
        group_a, group_b = executor._split_devices_into_groups(devices)
        
        # 홀수면 A그룹이 하나 더 많음
        assert len(group_a) == 4
        assert len(group_b) == 3
    
    def test_split_single_device(self, executor):
        """단일 디바이스"""
        devices = [DeviceInfo(
            id="device-001",
            serial_number="R58M00000001",
            hierarchy_id="WS01-PB01-S01",
            workstation_id="WS01",
            phoneboard_id="WS01-PB01",
            slot_number=1,
            device_group="A",
            status="idle"
        )]
        
        group_a, group_b = executor._split_devices_into_groups(devices)
        
        assert len(group_a) == 1
        assert len(group_b) == 0
    
    def test_split_empty_list(self, executor):
        """빈 목록"""
        group_a, group_b = executor._split_devices_into_groups([])
        
        assert len(group_a) == 0
        assert len(group_b) == 0
    
    def test_split_maintains_device_info(self, executor, sample_devices):
        """분할 후 디바이스 정보 유지"""
        group_a, group_b = executor._split_devices_into_groups(sample_devices)
        
        all_devices = group_a + group_b
        for device in all_devices:
            assert device.id is not None
            assert device.serial_number is not None


class TestBatchExecutorCalculateDelay:
    """배치 딜레이 계산 테스트"""
    
    @pytest.fixture
    def executor(self):
        return BatchExecutor()
    
    def test_fixed_delay(self, executor):
        """고정 딜레이"""
        config = BatchConfig(
            batch_interval_seconds=60,
            randomize_interval=False
        )
        
        delay = executor._calculate_batch_delay(config)
        assert delay == 60
    
    def test_random_delay_in_range(self, executor):
        """랜덤 딜레이 범위 확인"""
        config = BatchConfig(
            batch_interval_seconds=60,
            randomize_interval=True,
            min_interval_seconds=30,
            max_interval_seconds=120
        )
        
        # 여러 번 테스트
        for _ in range(20):
            delay = executor._calculate_batch_delay(config)
            assert 30 <= delay <= 120
    
    @patch('random.uniform')
    def test_random_delay_uses_uniform(self, mock_uniform, executor):
        """random.uniform 사용 확인"""
        mock_uniform.return_value = 75.0
        
        config = BatchConfig(
            batch_interval_seconds=60,
            randomize_interval=True,
            min_interval_seconds=30,
            max_interval_seconds=120
        )
        
        delay = executor._calculate_batch_delay(config)
        
        mock_uniform.assert_called_once_with(30, 120)
        assert delay == 75.0


class TestBatchExecutorCreateResult:
    """배치 결과 생성 테스트"""
    
    @pytest.fixture
    def executor(self):
        return BatchExecutor()
    
    def test_create_success_result(self, executor):
        """성공 결과 생성"""
        result = executor._create_batch_result(
            batch_number=1,
            total_devices=5,
            success_count=5,
            failed_count=0,
            skipped_count=0
        )
        
        assert result.batch_number == 1
        assert result.total_devices == 5
        assert result.success_count == 5
        assert result.failed_count == 0
    
    def test_create_partial_result(self, executor):
        """부분 성공 결과"""
        result = executor._create_batch_result(
            batch_number=2,
            total_devices=10,
            success_count=7,
            failed_count=2,
            skipped_count=1
        )
        
        assert result.success_count == 7
        assert result.failed_count == 2
        assert result.skipped_count == 1


class TestBatchConfigValidation:
    """BatchConfig 유효성 테스트"""
    
    def test_valid_device_percent(self):
        """유효한 디바이스 비율"""
        config = BatchConfig(device_percent=0.5)
        assert config.device_percent == 0.5
    
    def test_device_percent_bounds(self):
        """디바이스 비율 경계값"""
        config_min = BatchConfig(device_percent=0.1)
        config_max = BatchConfig(device_percent=1.0)
        
        assert config_min.device_percent == 0.1
        assert config_max.device_percent == 1.0
    
    def test_interval_settings(self):
        """인터벌 설정"""
        config = BatchConfig(
            batch_interval_seconds=120,
            min_interval_seconds=60,
            max_interval_seconds=180
        )
        
        assert config.batch_interval_seconds == 120
        assert config.min_interval_seconds == 60
        assert config.max_interval_seconds == 180


class TestWatchConfigValidation:
    """WatchConfig 유효성 테스트"""
    
    def test_valid_watch_percent(self):
        """유효한 시청률"""
        config = WatchConfig(
            min_watch_percent=0.7,
            max_watch_percent=1.0
        )
        
        assert config.min_watch_percent == 0.7
        assert config.max_watch_percent == 1.0
    
    def test_valid_probabilities(self):
        """유효한 확률값"""
        config = WatchConfig(
            like_probability=0.20,
            comment_probability=0.05
        )
        
        assert config.like_probability == 0.20
        assert config.comment_probability == 0.05
