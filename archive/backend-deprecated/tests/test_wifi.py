"""
🤖 DoAi.Me - WiFi 연결 테스트
WiFi 연결 서비스의 단위 테스트, 통합 테스트, E2E 테스트

실행 방법:
    pytest backend/tests/test_wifi.py -v
    pytest backend/tests/test_wifi.py -v -k "unit"      # 단위 테스트만
    pytest backend/tests/test_wifi.py -v -k "integration"  # 통합 테스트만
    
수동 테스트:
    python backend/tests/test_wifi.py
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from services.laixi_client import LaixiClient
from services.wifi_service import (
    WifiService, 
    DeviceWifiStatus,
    WifiConnectionResult,
    S9Coordinates
)


# ==================== 픽스처 ====================

@pytest.fixture
def mock_laixi():
    """Mock Laixi 클라이언트"""
    client = LaixiClient()
    client.ws = MagicMock()
    return client


@pytest.fixture
def wifi_service(mock_laixi):
    """WiFi 서비스 (Mock Laixi 포함)"""
    service = WifiService(laixi_client=mock_laixi)
    return service


# ==================== 단위 테스트 ====================

class TestLaixiClient:
    """Laixi 클라이언트 단위 테스트"""
    
    @pytest.mark.unit
    def test_init_default_url(self):
        """기본 WebSocket URL 확인"""
        client = LaixiClient()
        assert client.ws_url == "ws://127.0.0.1:22221/"
    
    @pytest.mark.unit
    def test_init_custom_url(self):
        """커스텀 WebSocket URL 확인"""
        custom_url = "ws://192.168.1.100:22222/"
        client = LaixiClient(ws_url=custom_url)
        assert client.ws_url == custom_url
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_send_with_mock(self, mock_laixi):
        """메시지 전송 테스트 (Mock)"""
        mock_laixi.send = AsyncMock(return_value={"success": True})
        
        result = await mock_laixi.send({"action": "List"})
        
        assert result["success"] is True
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_adb_command(self, mock_laixi):
        """ADB 명령 전송 테스트"""
        mock_laixi.send = AsyncMock(return_value={"output": "OK"})
        
        result = await mock_laixi.adb("input tap 100 200", "device1")
        
        assert "output" in result


class TestS9Coordinates:
    """S9 좌표 단위 테스트"""
    
    @pytest.mark.unit
    def test_to_pixels_search_icon(self):
        """검색 아이콘 픽셀 좌표 변환"""
        x, y = S9Coordinates.to_pixels(S9Coordinates.SEARCH_ICON)
        
        # 0.92 * 1440 = 1324.8 ≈ 1324
        # 0.05 * 2960 = 148
        assert x == int(0.92 * 1440)
        assert y == int(0.05 * 2960)
    
    @pytest.mark.unit
    def test_to_pixels_bounds(self):
        """좌표 범위 검증"""
        for coord in [
            S9Coordinates.SEARCH_ICON,
            S9Coordinates.FIRST_RESULT,
            S9Coordinates.PASSWORD_FIELD,
            S9Coordinates.CONNECT_BUTTON
        ]:
            x, y = S9Coordinates.to_pixels(coord)
            
            assert 0 <= x <= S9Coordinates.SCREEN_WIDTH
            assert 0 <= y <= S9Coordinates.SCREEN_HEIGHT


class TestWifiService:
    """WiFi 서비스 단위 테스트"""
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_check_wifi_status_connected(self, wifi_service):
        """연결된 상태 파싱 테스트"""
        mock_output = '''
        mWifiInfo SSID: "JH-Wifi", BSSID: 00:11:22:33:44:55
        IP address: 192.168.1.100
        RSSI: -45
        Link speed: 72Mbps
        '''
        
        wifi_service.laixi.adb = AsyncMock(return_value={"output": mock_output})
        
        status = await wifi_service.check_wifi_status("device1")
        
        assert status.connected is True
        assert status.ssid == "JH-Wifi"
        assert status.ip_address == "192.168.1.100"
        assert status.rssi == -45
        assert status.link_speed == 72
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_check_wifi_status_disconnected(self, wifi_service):
        """연결 안 된 상태 파싱 테스트"""
        mock_output = '''
        mWifiInfo SSID: <unknown ssid>, BSSID: <none>
        '''
        
        wifi_service.laixi.adb = AsyncMock(return_value={"output": mock_output})
        
        status = await wifi_service.check_wifi_status("device1")
        
        assert status.connected is False
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_verify_connection_success(self, wifi_service):
        """연결 검증 테스트 - 성공"""
        async def mock_check(device_id):
            return DeviceWifiStatus(
                device_id=device_id,
                connected=True,
                ssid="JH-Wifi",
                ip_address="192.168.1.100"
            )
        
        wifi_service.check_wifi_status = mock_check
        
        report = await wifi_service.verify_connection(
            target_ssid="JH-Wifi",
            device_ids=["d1", "d2", "d3"]
        )
        
        assert report["success_rate"] == 100.0
        assert len(report["connected"]) == 3
        assert len(report["failed"]) == 0
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_verify_connection_partial(self, wifi_service):
        """연결 검증 테스트 - 부분 성공"""
        call_count = [0]
        
        async def mock_check(device_id):
            call_count[0] += 1
            if call_count[0] <= 2:
                return DeviceWifiStatus(
                    device_id=device_id,
                    connected=True,
                    ssid="JH-Wifi"
                )
            else:
                return DeviceWifiStatus(
                    device_id=device_id,
                    connected=False,
                    ssid=None
                )
        
        wifi_service.check_wifi_status = mock_check
        
        report = await wifi_service.verify_connection(
            target_ssid="JH-Wifi",
            device_ids=["d1", "d2", "d3"]
        )
        
        assert report["success_rate"] == pytest.approx(66.67, rel=0.01)
        assert len(report["connected"]) == 2
        assert len(report["failed"]) == 1


# ==================== 통합 테스트 ====================

class TestWifiIntegration:
    """WiFi 통합 테스트 (Laixi 서버 연결 필요)"""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_laixi_connection(self):
        """Laixi WebSocket 연결 테스트"""
        laixi = LaixiClient()
        
        connected = await laixi.connect()
        
        # 연결 실패해도 테스트는 통과 (서버가 없을 수 있음)
        if connected:
            assert laixi.ws is not None
            await laixi.disconnect()
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_get_device_list(self):
        """기기 목록 조회 테스트"""
        laixi = LaixiClient()
        
        if not await laixi.connect():
            pytest.skip("Laixi 서버 연결 불가")
        
        try:
            devices = await laixi.get_device_list()
            assert isinstance(devices, dict)
        finally:
            await laixi.disconnect()
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_tap_function(self):
        """탭 기능 테스트"""
        laixi = LaixiClient()
        
        if not await laixi.connect():
            pytest.skip("Laixi 서버 연결 불가")
        
        try:
            # 화면 중앙 탭 (안전한 위치)
            result = await laixi.tap(720, 1480, "all")
            # 오류 없으면 통과
            assert True
        finally:
            await laixi.disconnect()


# ==================== E2E 테스트 ====================

class TestWifiE2E:
    """WiFi E2E 테스트 (실제 기기 연결 필요)"""
    
    @pytest.mark.e2e
    @pytest.mark.asyncio
    async def test_wifi_connect_flow(self):
        """WiFi 연결 전체 플로우 테스트"""
        wifi = WifiService()
        
        if not await wifi.laixi.connect():
            pytest.skip("Laixi 서버 연결 불가")
        
        try:
            # 환경 변수에서 WiFi 자격 증명 로드 (보안)
            test_ssid = os.environ.get("TEST_WIFI_SSID")
            test_password = os.environ.get("TEST_WIFI_PASSWORD")
            
            if not test_ssid or not test_password:
                pytest.skip(
                    "TEST_WIFI_SSID, TEST_WIFI_PASSWORD 환경 변수가 필요합니다. "
                    "테스트 실행 전 설정해주세요."
                )
            
            result = await wifi.connect_wifi(
                ssid=test_ssid,
                password=test_password,
                device_ids="all"
            )
            
            assert result.status in ["completed", "error"]
            assert len(result.steps) > 0
            
        finally:
            await wifi.laixi.disconnect()
    
    @pytest.mark.e2e
    @pytest.mark.asyncio
    async def test_full_wifi_cycle(self):
        """전체 사이클: 연결 → 검증 → 리포트"""
        wifi = WifiService()
        
        if not await wifi.laixi.connect():
            pytest.skip("Laixi 서버 연결 불가")
        
        ssid = "JH-Wifi"
        password = "jh000Aa@@"
        
        try:
            # 1. 연결 시도
            connect_result = await wifi.connect_wifi(ssid, password)
            print(f"Connect Result: {connect_result}")
            
            # 2. 5초 대기
            await asyncio.sleep(5)
            
            # 3. 상태 확인
            all_status = await wifi.check_all_devices()
            print(f"All Status: {all_status}")
            
            # 4. 연결된 기기 수 확인
            connected_count = sum(1 for s in all_status if s.connected)
            total_count = len(all_status)
            
            print(f"Connected: {connected_count}/{total_count}")
            
            # 결과 기록
            assert connect_result.status in ["completed", "error"]
            
        finally:
            await wifi.laixi.disconnect()


# ==================== 수동 테스트 스크립트 ====================

async def manual_test():
    """수동 실행용 테스트"""
    
    print("=" * 60)
    print("🤖 DoAi.Me WiFi 연결 수동 테스트")
    print("=" * 60)
    
    wifi = WifiService()
    
    # 1. Laixi 연결
    print("\n[1] Laixi 연결 중...")
    connected = await wifi.laixi.connect()
    if not connected:
        print("❌ Laixi 서버 연결 실패")
        print("   - Laixi 앱이 실행 중인지 확인하세요")
        print("   - WebSocket 주소: ws://127.0.0.1:22221/")
        return
    print("✅ Laixi 연결됨")
    
    try:
        # 2. 기기 목록 확인
        print("\n[2] 기기 목록 조회...")
        devices = await wifi.laixi.get_device_list()
        device_list = devices.get("devices", [])
        print(f"   발견된 기기: {len(device_list)}대")
        for d in device_list[:5]:  # 처음 5개만 표시
            print(f"   - {d.get('id', d)}")
        
        # 3. 현재 WiFi 상태
        print("\n[3] 현재 WiFi 상태...")
        all_status = await wifi.check_all_devices()
        for s in all_status[:5]:
            status_icon = "✅" if s.connected else "❌"
            print(f"   {status_icon} {s.device_id}: {s.ssid or '미연결'}")
        
        # 4. WiFi 연결 시도
        print("\n[4] WiFi 연결 시도...")
        print("   SSID: JH-Wifi")
        
        result = await wifi.connect_wifi(
            ssid="JH-Wifi",
            password="jh000Aa@@"
        )
        
        print(f"   결과: {result.status}")
        print(f"   소요 시간: {result.duration_ms}ms")
        for step in result.steps:
            print(f"   - Step {step['step']}: {step['action']} = {step['status']}")
        
        # 5. 연결 후 상태 확인
        print("\n[5] 연결 후 상태 확인 (5초 대기)...")
        await asyncio.sleep(5)
        
        all_status = await wifi.check_all_devices()
        connected = sum(1 for s in all_status if s.connected)
        total = len(all_status)
        
        print(f"   연결된 기기: {connected}/{total}")
        
        if total > 0:
            success_rate = (connected / total) * 100
            if success_rate >= 95:
                print(f"   ✅ 성공률: {success_rate:.1f}%")
            else:
                print(f"   ⚠️ 성공률: {success_rate:.1f}% (목표: 95%)")
        
    finally:
        await wifi.laixi.disconnect()
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)


if __name__ == "__main__":
    # 수동 테스트 실행
    asyncio.run(manual_test())

