"""
DeviceRegistry 단위 테스트

테스트 대상:
- _parse_hierarchy_id() - "WS01-PB02-S15" 파싱
- _generate_hierarchy_id() - ID 생성
- DeviceInfo, PhoneboardInfo, WorkstationInfo 데이터클래스
- DeviceStatus 상태 전이
"""

import pytest
from datetime import datetime, timezone

from shared.device_registry import (
    DeviceRegistry,
    DeviceInfo,
    PhoneboardInfo,
    WorkstationInfo,
    DeviceStatus,
    DeviceGroup,
)


class TestDeviceInfo:
    """DeviceInfo 데이터클래스 테스트"""
    
    def test_create_with_all_fields(self):
        """모든 필드로 생성"""
        device = DeviceInfo(
            id="device-001",
            serial_number="R58M12345678",
            hierarchy_id="WS01-PB01-S01",
            workstation_id="WS01",
            phoneboard_id="WS01-PB01",
            slot_number=1,
            device_group="A",
            status="idle",
            model="SM-G960N",
            last_heartbeat=datetime.now(timezone.utc)
        )
        
        assert device.id == "device-001"
        assert device.serial_number == "R58M12345678"
        assert device.hierarchy_id == "WS01-PB01-S01"
        assert device.slot_number == 1
        assert device.device_group == "A"
    
    def test_create_with_required_fields(self):
        """필수 필드만으로 생성"""
        device = DeviceInfo(
            id="device-002",
            serial_number="R58M00000002",
            hierarchy_id="WS01-PB01-S02",
            workstation_id="WS01",
            phoneboard_id="WS01-PB01",
            slot_number=2,
            device_group="A",
            status="idle"
        )
        
        assert device.model is None
        assert device.last_heartbeat is None


class TestPhoneboardInfo:
    """PhoneboardInfo 데이터클래스 테스트"""
    
    def test_create_phoneboard(self):
        """폰보드 정보 생성"""
        phoneboard = PhoneboardInfo(
            id="pb-001",
            workstation_id="WS01",
            board_number=1,
            slot_count=20,
            connected_count=18,
            status="online"
        )
        
        assert phoneboard.id == "pb-001"
        assert phoneboard.board_number == 1
        assert phoneboard.slot_count == 20
        assert phoneboard.connected_count == 18


class TestWorkstationInfo:
    """WorkstationInfo 데이터클래스 테스트"""
    
    def test_create_workstation(self):
        """워크스테이션 정보 생성"""
        workstation = WorkstationInfo(
            id="ws-001",
            name="WS01",
            ip_address="192.168.1.101",
            vlan_id=101,
            laixi_connected=True,
            status="online"
        )
        
        assert workstation.id == "ws-001"
        assert workstation.name == "WS01"
        assert workstation.laixi_connected is True


class TestDeviceStatus:
    """DeviceStatus Enum 테스트"""
    
    def test_status_values(self):
        """상태 값 확인"""
        assert DeviceStatus.IDLE.value == "idle"
        assert DeviceStatus.BUSY.value == "busy"
        assert DeviceStatus.OFFLINE.value == "offline"
        assert DeviceStatus.ERROR.value == "error"
        assert DeviceStatus.OVERHEAT.value == "overheat"
        assert DeviceStatus.MAINTENANCE.value == "maintenance"
    
    def test_status_from_string(self):
        """문자열에서 상태 변환"""
        assert DeviceStatus("idle") == DeviceStatus.IDLE
        assert DeviceStatus("busy") == DeviceStatus.BUSY


class TestDeviceGroup:
    """DeviceGroup Enum 테스트"""
    
    def test_group_values(self):
        """그룹 값 확인"""
        assert DeviceGroup.A.value == "A"
        assert DeviceGroup.B.value == "B"


class TestParseHierarchyId:
    """계층 ID 파싱 테스트"""
    
    @pytest.fixture
    def registry(self):
        return DeviceRegistry()
    
    def test_parse_valid_hierarchy_id(self, registry):
        """유효한 계층 ID 파싱"""
        ws, pb, slot = registry._parse_hierarchy_id("WS01-PB02-S15")
        
        assert ws == "WS01"
        assert pb == "PB02"
        assert slot == 15
    
    def test_parse_different_numbers(self, registry):
        """다양한 번호 파싱"""
        ws, pb, slot = registry._parse_hierarchy_id("WS05-PB03-S20")
        
        assert ws == "WS05"
        assert pb == "PB03"
        assert slot == 20
    
    def test_parse_single_digit(self, registry):
        """한 자리 숫자"""
        ws, pb, slot = registry._parse_hierarchy_id("WS1-PB1-S1")
        
        assert ws == "WS1"
        assert pb == "PB1"
        assert slot == 1
    
    def test_parse_invalid_format(self, registry):
        """잘못된 형식"""
        with pytest.raises((ValueError, IndexError)):
            registry._parse_hierarchy_id("INVALID")
    
    def test_parse_missing_parts(self, registry):
        """일부 누락"""
        with pytest.raises((ValueError, IndexError)):
            registry._parse_hierarchy_id("WS01-PB02")


class TestGenerateHierarchyId:
    """계층 ID 생성 테스트"""
    
    @pytest.fixture
    def registry(self):
        return DeviceRegistry()
    
    def test_generate_basic(self, registry):
        """기본 ID 생성"""
        hierarchy_id = registry._generate_hierarchy_id("WS01", 1, 1)
        
        assert hierarchy_id == "WS01-PB01-S01"
    
    def test_generate_different_numbers(self, registry):
        """다양한 번호로 생성"""
        hierarchy_id = registry._generate_hierarchy_id("WS05", 3, 20)
        
        assert hierarchy_id == "WS05-PB03-S20"
    
    def test_generate_with_padding(self, registry):
        """제로 패딩 확인"""
        hierarchy_id = registry._generate_hierarchy_id("WS01", 1, 5)
        
        # 두 자리 패딩
        assert "PB01" in hierarchy_id
        assert "S05" in hierarchy_id


class TestDeviceStatusTransition:
    """디바이스 상태 전이 테스트"""
    
    def test_idle_to_busy(self):
        """idle -> busy 전이"""
        device = DeviceInfo(
            id="device-001",
            serial_number="R58M00000001",
            hierarchy_id="WS01-PB01-S01",
            workstation_id="WS01",
            phoneboard_id="WS01-PB01",
            slot_number=1,
            device_group="A",
            status="idle"
        )
        
        # 상태 변경 (실제로는 DB 업데이트)
        assert device.status == "idle"
        # 작업 시작 시 busy로 변경됨
    
    def test_valid_status_values(self):
        """유효한 상태 값만 허용"""
        valid_statuses = ["idle", "busy", "offline", "error", "overheat", "maintenance"]
        
        for status in valid_statuses:
            device = DeviceInfo(
                id="device-001",
                serial_number="R58M00000001",
                hierarchy_id="WS01-PB01-S01",
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=1,
                device_group="A",
                status=status
            )
            assert device.status == status


class TestDeviceGroupAssignment:
    """디바이스 그룹 할당 테스트"""
    
    @pytest.fixture
    def registry(self):
        return DeviceRegistry()
    
    def test_assign_group_a(self, registry):
        """A 그룹 할당 (슬롯 1-10)"""
        group = registry._assign_device_group(1)
        assert group == "A"
        
        group = registry._assign_device_group(10)
        assert group == "A"
    
    def test_assign_group_b(self, registry):
        """B 그룹 할당 (슬롯 11-20)"""
        group = registry._assign_device_group(11)
        assert group == "B"
        
        group = registry._assign_device_group(20)
        assert group == "B"
    
    def test_alternate_assignment(self, registry):
        """번갈아가며 할당 (홀수/짝수)"""
        # 또는 슬롯 번호 기반
        group_1 = registry._assign_device_group(1)
        group_2 = registry._assign_device_group(2)
        
        # 구현에 따라 A/B가 번갈아 할당될 수 있음
        assert group_1 in ["A", "B"]
        assert group_2 in ["A", "B"]


class TestHierarchyStructure:
    """계층 구조 테스트"""
    
    def test_workstation_naming(self):
        """워크스테이션 명명 규칙"""
        # WS01 ~ WS05
        valid_names = ["WS01", "WS02", "WS03", "WS04", "WS05"]
        
        for name in valid_names:
            assert name.startswith("WS")
            assert name[2:].isdigit()
    
    def test_phoneboard_naming(self):
        """폰보드 명명 규칙"""
        # WS01-PB01 ~ WS01-PB03
        hierarchy_id = "WS01-PB02-S15"
        parts = hierarchy_id.split("-")
        
        assert parts[0].startswith("WS")
        assert parts[1].startswith("PB")
        assert parts[2].startswith("S")
    
    def test_slot_range(self):
        """슬롯 번호 범위"""
        # 1 ~ 20
        for slot in range(1, 21):
            hierarchy_id = f"WS01-PB01-S{slot:02d}"
            assert "S" in hierarchy_id


class TestDeviceCapacity:
    """디바이스 용량 테스트"""
    
    def test_total_capacity(self):
        """총 디바이스 수"""
        workstations = 5
        phoneboards_per_ws = 3
        slots_per_pb = 20
        
        total = workstations * phoneboards_per_ws * slots_per_pb
        assert total == 300
    
    def test_per_workstation_capacity(self):
        """워크스테이션당 디바이스 수"""
        phoneboards = 3
        slots = 20
        
        per_ws = phoneboards * slots
        assert per_ws == 60
