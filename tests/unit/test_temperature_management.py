"""
온도 관리 단위 테스트

PR #4: 디바이스 온도 관리 자동화
- TemperatureConfig 설정 테스트
- TemperatureGate 온도 체크 테스트
- CooldownQueue 쿨다운 대기열 테스트
- 동적 배치 간격 조정 테스트
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

from shared.schemas.workload import (
    TemperatureConfig,
    TemperatureStatus,
    CooldownQueueItem,
    CooldownQueueStatus,
)
from shared.batch_executor import (
    TemperatureGate,
    TemperatureCheckResult,
    CooldownQueue,
    reset_batch_executor,
)
from shared.device_registry import DeviceInfo


# =========================================
# TemperatureConfig 테스트
# =========================================

class TestTemperatureConfig:
    """TemperatureConfig 스키마 테스트"""

    def test_default_values(self):
        """기본값 확인"""
        config = TemperatureConfig()

        assert config.warning_threshold == 40.0
        assert config.critical_threshold == 45.0
        assert config.overheat_threshold == 50.0
        assert config.cooldown_target_temp == 38.0
        assert config.cooldown_check_interval_seconds == 60
        assert config.max_cooldown_time_seconds == 600
        assert config.enable_dynamic_interval is True
        assert config.interval_increase_per_degree == 10
        assert config.max_interval_increase == 120

    def test_custom_values(self):
        """커스텀 값 설정"""
        config = TemperatureConfig(
            warning_threshold=38.0,
            critical_threshold=42.0,
            overheat_threshold=48.0,
            cooldown_target_temp=35.0,
        )

        assert config.warning_threshold == 38.0
        assert config.critical_threshold == 42.0
        assert config.overheat_threshold == 48.0
        assert config.cooldown_target_temp == 35.0


class TestTemperatureStatus:
    """TemperatureStatus Enum 테스트"""

    def test_status_values(self):
        """상태 값 확인"""
        assert TemperatureStatus.NORMAL.value == "normal"
        assert TemperatureStatus.WARNING.value == "warning"
        assert TemperatureStatus.CRITICAL.value == "critical"
        assert TemperatureStatus.OVERHEAT.value == "overheat"


# =========================================
# TemperatureGate 테스트
# =========================================

class TestTemperatureGate:
    """TemperatureGate 클래스 테스트"""

    @pytest.fixture
    def gate(self):
        """기본 TemperatureGate"""
        return TemperatureGate()

    @pytest.fixture
    def custom_gate(self):
        """커스텀 임계값 TemperatureGate"""
        config = TemperatureConfig(
            warning_threshold=38.0,
            critical_threshold=43.0,
            overheat_threshold=48.0,
        )
        return TemperatureGate(config)

    def test_get_temperature_status_normal(self, gate):
        """정상 온도 판정"""
        assert gate.get_temperature_status(35.0) == TemperatureStatus.NORMAL
        assert gate.get_temperature_status(39.9) == TemperatureStatus.NORMAL

    def test_get_temperature_status_warning(self, gate):
        """경고 온도 판정"""
        assert gate.get_temperature_status(40.0) == TemperatureStatus.WARNING
        assert gate.get_temperature_status(44.9) == TemperatureStatus.WARNING

    def test_get_temperature_status_critical(self, gate):
        """위험 온도 판정"""
        assert gate.get_temperature_status(45.0) == TemperatureStatus.CRITICAL
        assert gate.get_temperature_status(49.9) == TemperatureStatus.CRITICAL

    def test_get_temperature_status_overheat(self, gate):
        """과열 온도 판정"""
        assert gate.get_temperature_status(50.0) == TemperatureStatus.OVERHEAT
        assert gate.get_temperature_status(55.0) == TemperatureStatus.OVERHEAT

    def test_get_temperature_status_none(self, gate):
        """온도 정보 없음 - 정상 처리"""
        assert gate.get_temperature_status(None) == TemperatureStatus.NORMAL

    def test_check_device_normal(self, gate):
        """정상 온도 디바이스 체크"""
        device = MagicMock(spec=DeviceInfo)
        device.battery_temp = 35.0
        device.hierarchy_id = "WS01-PB01-S01"

        result = gate.check_device(device)

        assert result.temperature == 35.0
        assert result.status == TemperatureStatus.NORMAL
        assert result.can_execute is True
        assert result.needs_cooldown is False

    def test_check_device_warning(self, gate):
        """경고 온도 디바이스 체크"""
        device = MagicMock(spec=DeviceInfo)
        device.battery_temp = 42.0
        device.hierarchy_id = "WS01-PB01-S02"

        result = gate.check_device(device)

        assert result.temperature == 42.0
        assert result.status == TemperatureStatus.WARNING
        assert result.can_execute is True  # WARNING은 실행 가능
        assert result.needs_cooldown is False

    def test_check_device_critical(self, gate):
        """위험 온도 디바이스 체크"""
        device = MagicMock(spec=DeviceInfo)
        device.battery_temp = 47.0
        device.hierarchy_id = "WS01-PB01-S03"

        result = gate.check_device(device)

        assert result.temperature == 47.0
        assert result.status == TemperatureStatus.CRITICAL
        assert result.can_execute is False  # CRITICAL은 실행 불가
        assert result.needs_cooldown is True

    def test_check_device_overheat(self, gate):
        """과열 디바이스 체크"""
        device = MagicMock(spec=DeviceInfo)
        device.battery_temp = 52.0
        device.hierarchy_id = "WS01-PB01-S04"

        result = gate.check_device(device)

        assert result.temperature == 52.0
        assert result.status == TemperatureStatus.OVERHEAT
        assert result.can_execute is False
        assert result.needs_cooldown is True

    def test_filter_devices(self, gate):
        """디바이스 필터링"""
        # 정상 디바이스
        device_normal = MagicMock(spec=DeviceInfo)
        device_normal.id = "d1"
        device_normal.battery_temp = 35.0
        device_normal.hierarchy_id = "WS01-PB01-S01"

        # 경고 디바이스 (실행 가능)
        device_warning = MagicMock(spec=DeviceInfo)
        device_warning.id = "d2"
        device_warning.battery_temp = 42.0
        device_warning.hierarchy_id = "WS01-PB01-S02"

        # 과열 디바이스 (실행 불가)
        device_overheat = MagicMock(spec=DeviceInfo)
        device_overheat.id = "d3"
        device_overheat.battery_temp = 52.0
        device_overheat.hierarchy_id = "WS01-PB01-S03"

        devices = [device_normal, device_warning, device_overheat]

        executable, needs_cooldown, all_results = gate.filter_devices(devices)

        assert len(executable) == 2  # normal + warning
        assert len(needs_cooldown) == 1  # overheat
        assert len(all_results) == 3

    def test_calculate_dynamic_interval_no_warning(self, gate):
        """동적 간격 - 경고 없음"""
        check_results = [
            TemperatureCheckResult(
                device=MagicMock(),
                temperature=35.0,
                status=TemperatureStatus.NORMAL,
                can_execute=True,
                needs_cooldown=False,
            )
        ]

        interval = gate.calculate_dynamic_interval(60, check_results)

        assert interval == 60  # 변경 없음

    def test_calculate_dynamic_interval_with_warning(self, gate):
        """동적 간격 - 경고 온도"""
        check_results = [
            TemperatureCheckResult(
                device=MagicMock(),
                temperature=42.0,  # 40 + 2도 초과
                status=TemperatureStatus.WARNING,
                can_execute=True,
                needs_cooldown=False,
            )
        ]

        # 기본: 60초, 초과 2도 × 10초/도 = 20초 추가
        interval = gate.calculate_dynamic_interval(60, check_results)

        assert interval == 80

    def test_calculate_dynamic_interval_max_cap(self, gate):
        """동적 간격 - 최대값 제한"""
        check_results = [
            TemperatureCheckResult(
                device=MagicMock(),
                temperature=45.0,  # 40 + 5도 초과 → 50초 추가
                status=TemperatureStatus.WARNING,
                can_execute=True,
                needs_cooldown=False,
            ),
            TemperatureCheckResult(
                device=MagicMock(),
                temperature=45.0,
                status=TemperatureStatus.WARNING,
                can_execute=True,
                needs_cooldown=False,
            ),
        ]

        # 기본: 60초, 평균 초과 5도 × 10초/도 = 50초 추가
        interval = gate.calculate_dynamic_interval(60, check_results)

        assert interval == 110  # 60 + 50

    def test_calculate_dynamic_interval_disabled(self):
        """동적 간격 비활성화"""
        config = TemperatureConfig(enable_dynamic_interval=False)
        gate = TemperatureGate(config)

        check_results = [
            TemperatureCheckResult(
                device=MagicMock(),
                temperature=44.0,
                status=TemperatureStatus.WARNING,
                can_execute=True,
                needs_cooldown=False,
            )
        ]

        interval = gate.calculate_dynamic_interval(60, check_results)

        assert interval == 60  # 변경 없음


# =========================================
# CooldownQueue 테스트
# =========================================

class TestCooldownQueue:
    """CooldownQueue 클래스 테스트"""

    @pytest.fixture
    def queue(self):
        """기본 CooldownQueue"""
        return CooldownQueue()

    @pytest.fixture
    def device(self):
        """테스트용 DeviceInfo"""
        device = MagicMock(spec=DeviceInfo)
        device.id = "device-001"
        device.hierarchy_id = "WS01-PB01-S01"
        device.serial_number = "R58M12345678"
        return device

    def test_add_device(self, queue, device):
        """디바이스 추가"""
        item = queue.add(device, 52.0)

        assert item.device_id == "device-001"
        assert item.temperature_at_entry == 52.0
        assert item.is_ready is False
        assert len(queue) == 1

    def test_add_multiple_devices(self, queue):
        """여러 디바이스 추가"""
        for i in range(3):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            queue.add(device, 50.0 + i)

        assert len(queue) == 3

    def test_remove_device(self, queue, device):
        """디바이스 제거"""
        queue.add(device, 52.0)
        removed = queue.remove("device-001")

        assert removed is not None
        assert removed.device_id == "device-001"
        assert len(queue) == 0

    def test_remove_nonexistent(self, queue):
        """존재하지 않는 디바이스 제거"""
        removed = queue.remove("nonexistent")

        assert removed is None

    def test_update_temperature(self, queue, device):
        """온도 업데이트"""
        queue.add(device, 52.0)
        item = queue.update_temperature("device-001", 45.0)

        assert item.current_temperature == 45.0
        assert item.check_count == 1
        assert item.is_ready is False  # 아직 38도 미만 아님

    def test_update_temperature_ready(self, queue, device):
        """쿨다운 완료 (목표 온도 도달)"""
        queue.add(device, 52.0)
        item = queue.update_temperature("device-001", 37.0)

        assert item.current_temperature == 37.0
        assert item.is_ready is True

    def test_get_ready_devices(self, queue):
        """쿨다운 완료 디바이스 조회"""
        for i in range(3):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            queue.add(device, 50.0)

        # 디바이스 0, 1만 쿨다운 완료
        queue.update_temperature("device-0", 35.0)
        queue.update_temperature("device-1", 36.0)
        queue.update_temperature("device-2", 45.0)  # 아직 높음

        ready = queue.get_ready_devices()

        assert len(ready) == 2

    def test_get_cooling_devices(self, queue):
        """아직 쿨링 중인 디바이스 조회"""
        for i in range(3):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            queue.add(device, 50.0)

        queue.update_temperature("device-0", 35.0)  # 완료

        cooling = queue.get_cooling_devices()

        assert len(cooling) == 2

    def test_pop_ready_devices(self, queue):
        """쿨다운 완료 디바이스 꺼내기"""
        for i in range(3):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            queue.add(device, 50.0)

        queue.update_temperature("device-0", 35.0)
        queue.update_temperature("device-1", 36.0)

        ready = queue.pop_ready_devices()

        assert len(ready) == 2
        assert len(queue) == 1  # device-2만 남음

    def test_get_status(self, queue):
        """대기열 상태 조회"""
        for i in range(3):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            queue.add(device, 48.0 + i)

        queue.update_temperature("device-0", 35.0)

        status = queue.get_status()

        assert status.total_devices == 3
        assert status.ready_devices == 1
        assert status.cooling_devices == 2
        assert status.max_temperature == 50.0

    def test_get_status_empty(self, queue):
        """빈 대기열 상태"""
        status = queue.get_status()

        assert status.total_devices == 0
        assert status.ready_devices == 0

    def test_contains(self, queue, device):
        """포함 여부 확인"""
        assert "device-001" not in queue

        queue.add(device, 52.0)

        assert "device-001" in queue


class TestCooldownQueueExpiry:
    """쿨다운 대기열 만료 테스트"""

    def test_get_expired_devices(self):
        """만료된 디바이스 조회"""
        config = TemperatureConfig(max_cooldown_time_seconds=60)
        queue = CooldownQueue(config)

        device = MagicMock(spec=DeviceInfo)
        device.id = "device-001"
        device.hierarchy_id = "WS01-PB01-S01"
        device.serial_number = "R58M12345678"

        item = queue.add(device, 52.0)

        # 진입 시간을 과거로 설정 (70초 전)
        item.entered_at = datetime.now(timezone.utc) - timedelta(seconds=70)

        expired = queue.get_expired_devices()

        assert len(expired) == 1
        assert expired[0].device_id == "device-001"

    def test_no_expired_devices(self):
        """만료된 디바이스 없음"""
        config = TemperatureConfig(max_cooldown_time_seconds=600)
        queue = CooldownQueue(config)

        device = MagicMock(spec=DeviceInfo)
        device.id = "device-001"
        device.hierarchy_id = "WS01-PB01-S01"
        device.serial_number = "R58M12345678"

        queue.add(device, 52.0)

        expired = queue.get_expired_devices()

        assert len(expired) == 0


# =========================================
# CooldownQueueItem 테스트
# =========================================

class TestCooldownQueueItem:
    """CooldownQueueItem 스키마 테스트"""

    def test_create_item(self):
        """아이템 생성"""
        now = datetime.now(timezone.utc)

        item = CooldownQueueItem(
            device_id="device-001",
            device_hierarchy_id="WS01-PB01-S01",
            serial_number="R58M12345678",
            temperature_at_entry=52.0,
            entered_at=now,
        )

        assert item.device_id == "device-001"
        assert item.temperature_at_entry == 52.0
        assert item.current_temperature is None
        assert item.check_count == 0
        assert item.is_ready is False


class TestCooldownQueueStatus:
    """CooldownQueueStatus 스키마 테스트"""

    def test_empty_status(self):
        """빈 상태"""
        status = CooldownQueueStatus()

        assert status.total_devices == 0
        assert status.ready_devices == 0
        assert status.cooling_devices == 0
        assert status.avg_temperature is None
        assert status.items == []


# =========================================
# 통합 시나리오 테스트
# =========================================

class TestTemperatureManagementIntegration:
    """온도 관리 통합 테스트"""

    def test_full_flow(self):
        """전체 흐름: 온도 체크 → 필터링 → 쿨다운 → 복귀"""
        config = TemperatureConfig(
            warning_threshold=40.0,
            critical_threshold=45.0,
            overheat_threshold=50.0,
            cooldown_target_temp=38.0,
        )

        gate = TemperatureGate(config)
        queue = CooldownQueue(config)

        # 디바이스 3개: 정상, 경고, 과열
        devices = []
        for i, temp in enumerate([35.0, 42.0, 52.0]):
            device = MagicMock(spec=DeviceInfo)
            device.id = f"device-{i}"
            device.battery_temp = temp
            device.hierarchy_id = f"WS01-PB01-S0{i}"
            device.serial_number = f"R58M0000000{i}"
            devices.append(device)

        # 1. 필터링
        executable, needs_cooldown, results = gate.filter_devices(devices)

        assert len(executable) == 2  # 정상 + 경고
        assert len(needs_cooldown) == 1  # 과열

        # 2. 과열 디바이스 쿨다운 대기열 추가
        for device in needs_cooldown:
            result = next(r for r in results if r.device.id == device.id)
            queue.add(device, result.temperature)

        assert len(queue) == 1

        # 3. 온도 업데이트 (쿨다운 진행)
        queue.update_temperature("device-2", 45.0)
        assert queue.get_ready_devices() == []

        queue.update_temperature("device-2", 37.0)
        assert len(queue.get_ready_devices()) == 1

        # 4. 복귀
        ready = queue.pop_ready_devices()
        assert len(ready) == 1
        assert len(queue) == 0

    def test_dynamic_interval_with_multiple_warnings(self):
        """여러 경고 디바이스의 평균 온도로 간격 조정"""
        config = TemperatureConfig(
            warning_threshold=40.0,
            interval_increase_per_degree=10,
            max_interval_increase=120,
        )
        gate = TemperatureGate(config)

        # 경고 디바이스들: 41, 42, 43 → 평균 42도, 2도 초과
        check_results = []
        for temp in [41.0, 42.0, 43.0]:
            check_results.append(
                TemperatureCheckResult(
                    device=MagicMock(),
                    temperature=temp,
                    status=TemperatureStatus.WARNING,
                    can_execute=True,
                    needs_cooldown=False,
                )
            )

        interval = gate.calculate_dynamic_interval(60, check_results)

        # 60 + (42 - 40) × 10 = 80
        assert interval == 80
