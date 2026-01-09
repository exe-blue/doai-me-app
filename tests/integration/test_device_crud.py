"""
Device CRUD 통합 테스트

Supabase 연결이 필요합니다.
테스트 전 SUPABASE_URL, SUPABASE_KEY 환경변수가 설정되어야 합니다.
"""

import os
import pytest
from datetime import datetime, timezone, timedelta

from shared.device_registry import (
    DeviceRegistry,
    DeviceInfo,
    DeviceStatus,
    DeviceGroup,
)


pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL"),
    reason="SUPABASE_URL 환경변수 필요"
)
class TestDeviceCRUD:
    """Device CRUD 테스트"""
    
    @pytest.fixture
    def registry(self, supabase_client):
        """DeviceRegistry 인스턴스"""
        return DeviceRegistry()
    
    @pytest.fixture
    def test_serial(self):
        """테스트용 시리얼 번호"""
        return f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    @pytest.mark.asyncio
    async def test_register_device(self, registry, test_serial):
        """디바이스 등록"""
        try:
            result = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=1,
                model="SM-G960N"
            )
            
            assert result is not None
            assert result.serial_number == test_serial
            assert result.hierarchy_id == "WS01-PB01-S01"
            
            # 정리
            await registry.remove_device(result.id)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_device(self, registry, test_serial):
        """디바이스 조회"""
        try:
            # 등록
            created = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=2
            )
            
            # 조회
            fetched = await registry.get_device(created.id)
            
            assert fetched is not None
            assert fetched.id == created.id
            assert fetched.serial_number == test_serial
            
            # 정리
            await registry.remove_device(created.id)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_device_by_serial(self, registry, test_serial):
        """시리얼 번호로 조회"""
        try:
            created = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=3
            )
            
            fetched = await registry.get_device_by_serial(test_serial)
            
            assert fetched is not None
            assert fetched.serial_number == test_serial
            
            await registry.remove_device(created.id)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_update_device_status(self, registry, test_serial):
        """디바이스 상태 업데이트"""
        try:
            created = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=4
            )
            
            # 상태 변경
            updated = await registry.update_device_status(
                device_id=created.id,
                status=DeviceStatus.BUSY
            )
            
            assert updated.status == "busy"
            
            await registry.remove_device(created.id)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_update_heartbeat(self, registry, test_serial):
        """하트비트 갱신"""
        try:
            created = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=5
            )
            
            # 하트비트 갱신
            updated = await registry.update_heartbeat(created.id)
            
            assert updated.last_heartbeat is not None
            
            await registry.remove_device(created.id)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise


@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL"),
    reason="SUPABASE_URL 환경변수 필요"
)
class TestDeviceQuery:
    """디바이스 조회 테스트"""
    
    @pytest.fixture
    def registry(self, supabase_client):
        return DeviceRegistry()
    
    @pytest.mark.asyncio
    async def test_get_devices_by_workstation(self, registry):
        """워크스테이션별 디바이스 조회"""
        try:
            devices = await registry.get_devices_by_workstation("WS01")
            
            # 결과가 리스트여야 함
            assert isinstance(devices, list)
            
            # 모든 디바이스가 WS01 소속이어야 함
            for device in devices:
                assert device.workstation_id == "WS01"
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_devices_by_phoneboard(self, registry):
        """폰보드별 디바이스 조회"""
        try:
            devices = await registry.get_devices_by_phoneboard("WS01-PB01")
            
            assert isinstance(devices, list)
            
            for device in devices:
                assert device.phoneboard_id == "WS01-PB01"
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_idle_devices(self, registry):
        """Idle 상태 디바이스 조회"""
        try:
            devices = await registry.get_devices_by_status(DeviceStatus.IDLE)
            
            assert isinstance(devices, list)
            
            for device in devices:
                assert device.status == "idle"
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_devices_by_group(self, registry):
        """그룹별 디바이스 조회"""
        try:
            group_a = await registry.get_devices_by_group(DeviceGroup.A)
            group_b = await registry.get_devices_by_group(DeviceGroup.B)
            
            assert isinstance(group_a, list)
            assert isinstance(group_b, list)
            
            for device in group_a:
                assert device.device_group == "A"
            
            for device in group_b:
                assert device.device_group == "B"
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_offline_devices(self, registry):
        """오프라인 디바이스 감지"""
        try:
            # 5분 이상 하트비트 없는 디바이스
            threshold = timedelta(minutes=5)
            offline = await registry.get_offline_devices(threshold)
            
            assert isinstance(offline, list)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise


@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL"),
    reason="SUPABASE_URL 환경변수 필요"
)
class TestDeviceHierarchy:
    """디바이스 계층 구조 테스트"""
    
    @pytest.fixture
    def registry(self, supabase_client):
        return DeviceRegistry()
    
    @pytest.mark.asyncio
    async def test_get_workstations(self, registry):
        """워크스테이션 목록 조회"""
        try:
            workstations = await registry.get_workstations()
            
            assert isinstance(workstations, list)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("workstations 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_phoneboards(self, registry):
        """폰보드 목록 조회"""
        try:
            phoneboards = await registry.get_phoneboards("WS01")
            
            assert isinstance(phoneboards, list)
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("phoneboards 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_device_count(self, registry):
        """디바이스 수 조회"""
        try:
            count = await registry.get_device_count()
            
            assert isinstance(count, int)
            assert count >= 0
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_idle_device_count(self, registry):
        """Idle 디바이스 수 조회"""
        try:
            count = await registry.get_idle_device_count()
            
            assert isinstance(count, int)
            assert count >= 0
        except Exception as e:
            if "does not exist" in str(e):
                pytest.skip("devices 테이블이 없습니다")
            raise


@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL"),
    reason="SUPABASE_URL 환경변수 필요"
)
class TestYouTubeLoginStatus:
    """YouTube 로그인 상태 테스트"""
    
    @pytest.fixture
    def registry(self, supabase_client):
        return DeviceRegistry()
    
    @pytest.mark.asyncio
    async def test_update_youtube_login_status(self, registry):
        """YouTube 로그인 상태 업데이트"""
        test_serial = f"YTLOGIN{datetime.now().strftime('%H%M%S')}"
        
        try:
            created = await registry.register_device(
                serial_number=test_serial,
                workstation_id="WS01",
                phoneboard_id="WS01-PB01",
                slot_number=10
            )
            
            # 로그인 상태 업데이트
            updated = await registry.update_youtube_login_status(
                device_id=created.id,
                logged_in=True,
                account_email="test@example.com"
            )
            
            assert updated.youtube_logged_in is True
            assert updated.youtube_account_email == "test@example.com"
            
            await registry.remove_device(created.id)
        except Exception as e:
            if "does not exist" in str(e) or "youtube_logged_in" in str(e):
                pytest.skip("YouTube 로그인 컬럼이 없습니다")
            raise
    
    @pytest.mark.asyncio
    async def test_get_logged_in_devices(self, registry):
        """로그인된 디바이스 조회"""
        try:
            devices = await registry.get_youtube_logged_in_devices()
            
            assert isinstance(devices, list)
            
            for device in devices:
                assert device.youtube_logged_in is True
        except Exception as e:
            if "does not exist" in str(e) or "youtube_logged_in" in str(e):
                pytest.skip("YouTube 로그인 컬럼이 없습니다")
            raise
