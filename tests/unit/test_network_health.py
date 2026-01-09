"""
네트워크 헬스 단위 테스트

PR #3: 네트워크 헬스 대시보드
- NetworkHealthChecker 테스트
- VLAN/AP/DHCP 관리 테스트
- 알림 생성 테스트
"""

import pytest
from datetime import datetime, timezone, timedelta

# 테스트 대상 임포트
from shared.schemas.network import (
    NetworkStatus,
    APStatus as APStatusEnum,
    DHCPStatus,
    VLANConfig,
    VLANStatus,
    VLANDeviceDistribution,
    APConfig,
    APStatus,
    APClientInfo,
    DHCPPoolConfig,
    DHCPPoolStatus,
    NetworkHealthConfig,
    NetworkHealthSummary,
    NetworkHealthSnapshot,
)

from shared.monitoring.network import (
    NetworkHealthChecker,
    DeviceNetworkInfo,
    NetworkAlert,
    get_network_health_checker,
    reset_network_health_checker,
    DEFAULT_VLAN_CONFIGS,
    DEFAULT_AP_CONFIGS,
)


# =========================================
# Schema Enum 테스트
# =========================================

class TestNetworkStatus:
    """NetworkStatus Enum 테스트"""

    def test_values(self):
        assert NetworkStatus.HEALTHY.value == "healthy"
        assert NetworkStatus.WARNING.value == "warning"
        assert NetworkStatus.CRITICAL.value == "critical"
        assert NetworkStatus.DOWN.value == "down"


class TestAPStatusEnum:
    """APStatus Enum 테스트"""

    def test_values(self):
        assert APStatusEnum.ONLINE.value == "online"
        assert APStatusEnum.OFFLINE.value == "offline"
        assert APStatusEnum.OVERLOADED.value == "overloaded"
        assert APStatusEnum.DEGRADED.value == "degraded"


class TestDHCPStatus:
    """DHCPStatus Enum 테스트"""

    def test_values(self):
        assert DHCPStatus.NORMAL.value == "normal"
        assert DHCPStatus.WARNING.value == "warning"
        assert DHCPStatus.CRITICAL.value == "critical"
        assert DHCPStatus.EXHAUSTED.value == "exhausted"


# =========================================
# VLANConfig 테스트
# =========================================

class TestVLANConfig:
    """VLANConfig 스키마 테스트"""

    def test_create_vlan_config(self):
        config = VLANConfig(
            vlan_id=10,
            name="Test-VLAN",
            subnet="192.168.10.0/24",
            gateway="192.168.10.1",
            dhcp_pool_start="192.168.10.10",
            dhcp_pool_end="192.168.10.250",
            dhcp_pool_size=240,
        )

        assert config.vlan_id == 10
        assert config.name == "Test-VLAN"
        assert config.dhcp_pool_size == 240


class TestVLANStatus:
    """VLANStatus 스키마 테스트"""

    def test_create_vlan_status(self):
        status = VLANStatus(
            vlan_id=10,
            name="Test-VLAN",
        )

        assert status.vlan_id == 10
        assert status.status == NetworkStatus.HEALTHY
        assert status.total_devices == 0

    def test_calculate_dhcp_usage(self):
        status = VLANStatus(
            vlan_id=10,
            name="Test-VLAN",
            dhcp_used=180,
            dhcp_pool_size=240,
        )

        usage = status.calculate_dhcp_usage()

        assert usage == 75.0
        assert status.dhcp_usage_percent == 75.0


# =========================================
# APConfig 테스트
# =========================================

class TestAPConfig:
    """APConfig 스키마 테스트"""

    def test_create_ap_config(self):
        config = APConfig(
            name="Test-AP",
            mac_address="00:11:22:33:44:55",
            ip_address="192.168.1.10",
            max_clients=50,
        )

        assert config.name == "Test-AP"
        assert config.max_clients == 50


class TestAPStatus:
    """APStatus 스키마 테스트"""

    def test_create_ap_status(self):
        status = APStatus(
            ap_id="ap-1",
            name="Test-AP",
        )

        assert status.ap_id == "ap-1"
        assert status.connected_clients == 0

    def test_calculate_usage(self):
        status = APStatus(
            ap_id="ap-1",
            name="Test-AP",
            connected_clients=35,
            max_clients=50,
        )

        usage = status.calculate_usage()

        assert usage == 70.0
        assert status.client_usage_percent == 70.0


# =========================================
# DHCPPoolStatus 테스트
# =========================================

class TestDHCPPoolStatus:
    """DHCPPoolStatus 스키마 테스트"""

    def test_create_dhcp_status(self):
        status = DHCPPoolStatus(
            pool_id="test-pool",
            name="Test Pool",
            vlan_id=10,
            pool_size=240,
        )

        assert status.vlan_id == 10
        assert status.status == DHCPStatus.NORMAL

    def test_calculate_status_normal(self):
        status = DHCPPoolStatus(
            pool_id="test",
            name="Test",
            vlan_id=10,
            pool_size=100,
            used_addresses=50,
        )

        result = status.calculate_status()

        assert result == DHCPStatus.NORMAL
        assert status.usage_percent == 50.0
        assert status.available_addresses == 50

    def test_calculate_status_warning(self):
        status = DHCPPoolStatus(
            pool_id="test",
            name="Test",
            vlan_id=10,
            pool_size=100,
            used_addresses=75,
            warning_threshold=70.0,
        )

        result = status.calculate_status()

        assert result == DHCPStatus.WARNING

    def test_calculate_status_critical(self):
        status = DHCPPoolStatus(
            pool_id="test",
            name="Test",
            vlan_id=10,
            pool_size=100,
            used_addresses=95,
            critical_threshold=90.0,
        )

        result = status.calculate_status()

        assert result == DHCPStatus.CRITICAL

    def test_calculate_status_exhausted(self):
        status = DHCPPoolStatus(
            pool_id="test",
            name="Test",
            vlan_id=10,
            pool_size=100,
            used_addresses=100,
        )

        result = status.calculate_status()

        assert result == DHCPStatus.EXHAUSTED


# =========================================
# NetworkHealthSummary 테스트
# =========================================

class TestNetworkHealthSummary:
    """NetworkHealthSummary 스키마 테스트"""

    def test_create_summary(self):
        summary = NetworkHealthSummary()

        assert summary.overall_status == NetworkStatus.HEALTHY
        assert summary.total_vlans == 0

    def test_calculate_overall_status_healthy(self):
        summary = NetworkHealthSummary(
            total_vlans=6,
            healthy_vlans=6,
            total_aps=6,
            online_aps=6,
            dhcp_normal=6,
        )

        result = summary.calculate_overall_status()

        assert result == NetworkStatus.HEALTHY

    def test_calculate_overall_status_warning(self):
        summary = NetworkHealthSummary(
            total_vlans=6,
            healthy_vlans=5,
            warning_vlans=1,
        )

        result = summary.calculate_overall_status()

        assert result == NetworkStatus.WARNING

    def test_calculate_overall_status_critical(self):
        summary = NetworkHealthSummary(
            total_vlans=6,
            critical_vlans=1,
        )

        result = summary.calculate_overall_status()

        assert result == NetworkStatus.CRITICAL

    def test_calculate_overall_status_ap_offline(self):
        summary = NetworkHealthSummary(
            total_aps=6,
            online_aps=5,
            offline_aps=1,
        )

        result = summary.calculate_overall_status()

        assert result == NetworkStatus.CRITICAL


# =========================================
# NetworkHealthChecker 초기화 테스트
# =========================================

class TestNetworkHealthCheckerInit:
    """NetworkHealthChecker 초기화 테스트"""

    def test_init_default(self):
        checker = NetworkHealthChecker()

        assert checker.config is not None
        assert len(checker._vlan_configs) == len(DEFAULT_VLAN_CONFIGS)
        assert len(checker._ap_configs) == len(DEFAULT_AP_CONFIGS)

    def test_init_custom_config(self):
        config = NetworkHealthConfig(
            dhcp_warning_threshold=60.0,
            dhcp_critical_threshold=80.0,
        )
        checker = NetworkHealthChecker(config=config)

        assert checker.config.dhcp_warning_threshold == 60.0
        assert checker.config.dhcp_critical_threshold == 80.0

    def test_init_custom_vlans(self):
        custom_vlans = [
            VLANConfig(
                vlan_id=100,
                name="Custom-VLAN",
                subnet="10.0.0.0/24",
                gateway="10.0.0.1",
                dhcp_pool_start="10.0.0.10",
                dhcp_pool_end="10.0.0.100",
                dhcp_pool_size=90,
            )
        ]
        checker = NetworkHealthChecker(vlan_configs=custom_vlans)

        assert len(checker._vlan_configs) == 1
        assert 100 in checker._vlan_configs


# =========================================
# VLAN 관리 테스트
# =========================================

class TestVLANManagement:
    """VLAN 관리 테스트"""

    def test_get_vlan_config(self):
        checker = NetworkHealthChecker()

        config = checker.get_vlan_config(10)

        assert config is not None
        assert config.vlan_id == 10

    def test_get_vlan_config_not_found(self):
        checker = NetworkHealthChecker()

        config = checker.get_vlan_config(999)

        assert config is None

    def test_get_vlan_status(self):
        checker = NetworkHealthChecker()

        status = checker.get_vlan_status(10)

        assert status is not None
        assert status.vlan_id == 10

    def test_get_all_vlan_statuses(self):
        checker = NetworkHealthChecker()

        statuses = checker.get_all_vlan_statuses()

        assert len(statuses) == len(DEFAULT_VLAN_CONFIGS)

    def test_update_vlan_device_count(self):
        checker = NetworkHealthChecker()

        status = checker.update_vlan_device_count(10, total=50, online=45)

        assert status is not None
        assert status.total_devices == 50
        assert status.online_devices == 45
        assert status.offline_devices == 5
        assert status.status == NetworkStatus.HEALTHY

    def test_update_vlan_device_count_warning(self):
        checker = NetworkHealthChecker()

        status = checker.update_vlan_device_count(10, total=50, online=35)

        assert status.status == NetworkStatus.WARNING

    def test_update_vlan_device_count_critical(self):
        checker = NetworkHealthChecker()

        status = checker.update_vlan_device_count(10, total=50, online=20)

        assert status.status == NetworkStatus.CRITICAL

    def test_get_vlan_device_distribution(self):
        checker = NetworkHealthChecker()

        devices = [
            DeviceNetworkInfo(device_id="d1", vlan_id=10),
            DeviceNetworkInfo(device_id="d2", vlan_id=10),
            DeviceNetworkInfo(device_id="d3", vlan_id=20),
        ]

        distribution = checker.get_vlan_device_distribution(devices)

        assert len(distribution) == 2
        assert distribution[0].device_count == 2  # VLAN 10
        assert distribution[1].device_count == 1  # VLAN 20


# =========================================
# AP 관리 테스트
# =========================================

class TestAPManagement:
    """AP 관리 테스트"""

    def test_get_ap_config(self):
        checker = NetworkHealthChecker()

        config = checker.get_ap_config("ap-1")

        assert config is not None
        assert config.name == "EAP-673-1"

    def test_get_ap_status(self):
        checker = NetworkHealthChecker()

        status = checker.get_ap_status("ap-1")

        assert status is not None

    def test_get_all_ap_statuses(self):
        checker = NetworkHealthChecker()

        statuses = checker.get_all_ap_statuses()

        assert len(statuses) == len(DEFAULT_AP_CONFIGS)

    def test_update_ap_status_online(self):
        checker = NetworkHealthChecker()

        status = checker.update_ap_status("ap-1", connected_clients=20)

        assert status is not None
        assert status.connected_clients == 20
        assert status.status == APStatusEnum.ONLINE

    def test_update_ap_status_degraded(self):
        checker = NetworkHealthChecker()

        status = checker.update_ap_status("ap-1", connected_clients=38)  # 76%

        assert status.status == APStatusEnum.DEGRADED

    def test_update_ap_status_overloaded(self):
        checker = NetworkHealthChecker()

        status = checker.update_ap_status("ap-1", connected_clients=48)  # 96%

        assert status.status == APStatusEnum.OVERLOADED

    def test_update_ap_status_offline(self):
        checker = NetworkHealthChecker()

        status = checker.update_ap_status("ap-1", connected_clients=0, is_online=False)

        assert status.status == APStatusEnum.OFFLINE


# =========================================
# DHCP 관리 테스트
# =========================================

class TestDHCPManagement:
    """DHCP 관리 테스트"""

    def test_get_dhcp_status(self):
        checker = NetworkHealthChecker()

        status = checker.get_dhcp_status(10)

        assert status is not None
        assert status.vlan_id == 10

    def test_get_all_dhcp_statuses(self):
        checker = NetworkHealthChecker()

        statuses = checker.get_all_dhcp_statuses()

        assert len(statuses) == len(DEFAULT_VLAN_CONFIGS)

    def test_update_dhcp_usage_normal(self):
        checker = NetworkHealthChecker()

        status = checker.update_dhcp_usage(10, used_addresses=100)

        assert status is not None
        assert status.used_addresses == 100
        assert status.status == DHCPStatus.NORMAL

    def test_update_dhcp_usage_warning(self):
        checker = NetworkHealthChecker()

        status = checker.update_dhcp_usage(10, used_addresses=180)  # 75%

        assert status.status == DHCPStatus.WARNING

    def test_update_dhcp_usage_critical(self):
        checker = NetworkHealthChecker()

        status = checker.update_dhcp_usage(10, used_addresses=220)  # 91%

        assert status.status == DHCPStatus.CRITICAL


# =========================================
# 디바이스 네트워크 정보 테스트
# =========================================

class TestDeviceNetworkInfo:
    """디바이스 네트워크 정보 테스트"""

    def test_register_device(self):
        checker = NetworkHealthChecker()

        info = checker.register_device(
            device_id="test-device",
            ip_address="192.168.10.100",
            vlan_id=10,
            ap_id="ap-1",
        )

        assert info.device_id == "test-device"
        assert info.is_connected is True

    def test_update_device_connection(self):
        checker = NetworkHealthChecker()
        checker.register_device("test-device")

        info = checker.update_device_connection("test-device", is_connected=False)

        assert info is not None
        assert info.is_connected is False

    def test_get_device_network_info(self):
        checker = NetworkHealthChecker()
        checker.register_device("test-device", ip_address="192.168.10.100")

        info = checker.get_device_network_info("test-device")

        assert info is not None
        assert info.ip_address == "192.168.10.100"

    def test_get_all_device_network_info(self):
        checker = NetworkHealthChecker()
        checker.register_device("d1")
        checker.register_device("d2")

        infos = checker.get_all_device_network_info()

        assert len(infos) == 2


# =========================================
# 헬스 체크 테스트
# =========================================

class TestHealthCheck:
    """헬스 체크 테스트"""

    @pytest.mark.asyncio
    async def test_get_health_summary(self):
        checker = NetworkHealthChecker()

        summary = await checker.get_health_summary()

        assert summary is not None
        assert summary.total_vlans == len(DEFAULT_VLAN_CONFIGS)
        assert summary.total_aps == len(DEFAULT_AP_CONFIGS)

    @pytest.mark.asyncio
    async def test_get_health_summary_with_data(self):
        checker = NetworkHealthChecker()
        checker.update_vlan_device_count(10, total=50, online=45)
        checker.update_ap_status("ap-1", connected_clients=20)

        summary = await checker.get_health_summary()

        assert summary.total_devices >= 50
        assert summary.online_devices >= 45

    @pytest.mark.asyncio
    async def test_create_snapshot(self):
        checker = NetworkHealthChecker()
        checker.update_vlan_device_count(10, total=30, online=25)

        snapshot = await checker.create_snapshot()

        assert snapshot is not None
        assert snapshot.total_devices >= 30
        assert "10" in snapshot.vlan_data


# =========================================
# 알림 테스트
# =========================================

class TestAlerts:
    """알림 테스트"""

    def test_alert_on_ap_offline(self):
        checker = NetworkHealthChecker()

        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)

        alerts = checker.get_recent_alerts(hours=1)
        assert len(alerts) >= 1
        assert any(a.alert_type == "ap_offline" for a in alerts)

    def test_alert_on_dhcp_critical(self):
        checker = NetworkHealthChecker()

        checker.update_dhcp_usage(10, used_addresses=220)

        alerts = checker.get_recent_alerts(hours=1)
        assert any(a.alert_type in ("dhcp_critical", "dhcp_warning") for a in alerts)

    def test_alert_cooldown(self):
        checker = NetworkHealthChecker()
        checker.config.alert_cooldown_seconds = 300

        # 첫 번째 알림
        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)
        initial_count = len(checker.get_recent_alerts())

        # 같은 알림 다시 시도 (쿨다운 내)
        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)
        final_count = len(checker.get_recent_alerts())

        # 쿨다운으로 인해 알림 수가 같아야 함
        assert final_count == initial_count

    def test_on_alert_callback(self):
        checker = NetworkHealthChecker()
        received_alerts = []

        def callback(alert):
            received_alerts.append(alert)

        checker.on_alert(callback)
        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)

        assert len(received_alerts) >= 1

    def test_clear_alerts(self):
        checker = NetworkHealthChecker()
        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)

        count = checker.clear_alerts()

        assert count >= 1
        assert len(checker.get_recent_alerts()) == 0


# =========================================
# 유틸리티 테스트
# =========================================

class TestUtilities:
    """유틸리티 테스트"""

    def test_get_status_dict(self):
        checker = NetworkHealthChecker()

        status_dict = checker.get_status_dict()

        assert "vlans" in status_dict
        assert "aps" in status_dict
        assert "dhcp" in status_dict
        assert "alerts" in status_dict

    def test_estimate_ip_from_vlan(self):
        checker = NetworkHealthChecker()

        ip = checker.estimate_ip_from_vlan(10)

        assert ip is not None
        assert ip.startswith("192.168.10.")


# =========================================
# 싱글톤 테스트
# =========================================

class TestSingleton:
    """싱글톤 테스트"""

    def test_get_network_health_checker_singleton(self):
        reset_network_health_checker()

        checker1 = get_network_health_checker()
        checker2 = get_network_health_checker()

        assert checker1 is checker2

    def test_reset_network_health_checker(self):
        checker1 = get_network_health_checker()
        reset_network_health_checker()
        checker2 = get_network_health_checker()

        assert checker1 is not checker2


# =========================================
# 통합 시나리오 테스트
# =========================================

class TestIntegrationScenarios:
    """통합 시나리오 테스트"""

    @pytest.mark.asyncio
    async def test_full_monitoring_cycle(self):
        """전체 모니터링 사이클"""
        reset_network_health_checker()
        checker = NetworkHealthChecker()

        # 1. 디바이스 등록
        for i in range(30):
            checker.register_device(
                device_id=f"device-{i}",
                ip_address=f"192.168.10.{100 + i}",
                vlan_id=10,
                ap_id=f"ap-{(i % 6) + 1}",
            )

        # 2. VLAN 상태 업데이트
        checker.update_vlan_device_count(10, total=30, online=28)

        # 3. AP 상태 업데이트
        for i in range(1, 7):
            checker.update_ap_status(f"ap-{i}", connected_clients=5)

        # 4. DHCP 상태 업데이트
        checker.update_dhcp_usage(10, used_addresses=30)

        # 5. 헬스 요약 조회
        summary = await checker.get_health_summary()

        assert summary.overall_status == NetworkStatus.HEALTHY
        assert summary.total_devices == 30
        assert summary.online_devices == 28

    @pytest.mark.asyncio
    async def test_degraded_network_scenario(self):
        """성능 저하 시나리오"""
        checker = NetworkHealthChecker()

        # DHCP 경고 상태
        checker.update_dhcp_usage(10, used_addresses=180)  # 75%

        summary = await checker.get_health_summary()

        assert summary.overall_status == NetworkStatus.WARNING
        assert summary.dhcp_warning >= 1

    @pytest.mark.asyncio
    async def test_critical_network_scenario(self):
        """위험 상태 시나리오"""
        checker = NetworkHealthChecker()

        # AP 오프라인
        checker.update_ap_status("ap-1", connected_clients=0, is_online=False)

        summary = await checker.get_health_summary()

        assert summary.overall_status == NetworkStatus.CRITICAL
        assert summary.offline_aps >= 1


# =========================================
# 엣지 케이스 테스트
# =========================================

class TestEdgeCases:
    """엣지 케이스 테스트"""

    def test_empty_vlan_device_distribution(self):
        checker = NetworkHealthChecker()

        distribution = checker.get_vlan_device_distribution([])

        assert len(distribution) == 0

    def test_update_nonexistent_vlan(self):
        checker = NetworkHealthChecker()

        result = checker.update_vlan_device_count(999, total=10, online=5)

        assert result is None

    def test_update_nonexistent_ap(self):
        checker = NetworkHealthChecker()

        result = checker.update_ap_status("nonexistent", connected_clients=10)

        assert result is None

    def test_update_nonexistent_dhcp(self):
        checker = NetworkHealthChecker()

        result = checker.update_dhcp_usage(999, used_addresses=10)

        assert result is None

    def test_device_network_info_not_found(self):
        checker = NetworkHealthChecker()

        result = checker.update_device_connection("nonexistent", is_connected=True)

        assert result is None
