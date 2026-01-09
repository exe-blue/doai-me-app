"""
네트워크 헬스 모니터링 모듈

PR #3: 네트워크 헬스 대시보드
- VLAN별 디바이스 분포 모니터링
- AP별 연결 수 추적
- DHCP 사용률 경고 임계값 설정

Usage:
    from shared.monitoring.network import (
        NetworkHealthChecker,
        get_network_health_checker,
    )

    checker = get_network_health_checker()
    summary = await checker.get_health_summary()
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional
import ipaddress

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.schemas.network import (
    NetworkStatus,
    APStatusValue,
    DHCPStatus,
    VLANConfig,
    VLANStatus,
    VLANDeviceDistribution,
    APConfig,
    APStatus,
    APClientInfo,
    DHCPPoolConfig,
    DHCPPoolStatus,
    DHCPLease,
    NetworkHealthConfig,
    NetworkHealthSummary,
    NetworkHealthSnapshot,
    NetworkAlertCreate,
)


# =========================================
# 기본 설정 (DoAi.Me 환경)
# =========================================

DEFAULT_VLAN_CONFIGS = [
    VLANConfig(
        vlan_id=1,
        name="VLAN-1-Management",
        subnet="192.168.1.0/24",
        gateway="192.168.1.1",
        dhcp_pool_start="192.168.1.100",
        dhcp_pool_end="192.168.1.200",
        dhcp_pool_size=100,
        description="관리 네트워크",
    ),
    VLANConfig(
        vlan_id=10,
        name="VLAN-10-Devices-A",
        subnet="192.168.10.0/24",
        gateway="192.168.10.1",
        dhcp_pool_start="192.168.10.10",
        dhcp_pool_end="192.168.10.250",
        dhcp_pool_size=240,
        description="디바이스 A 그룹",
    ),
    VLANConfig(
        vlan_id=20,
        name="VLAN-20-Devices-B",
        subnet="192.168.20.0/24",
        gateway="192.168.20.1",
        dhcp_pool_start="192.168.20.10",
        dhcp_pool_end="192.168.20.250",
        dhcp_pool_size=240,
        description="디바이스 B 그룹",
    ),
    VLANConfig(
        vlan_id=30,
        name="VLAN-30-Devices-C",
        subnet="192.168.30.0/24",
        gateway="192.168.30.1",
        dhcp_pool_start="192.168.30.10",
        dhcp_pool_end="192.168.30.250",
        dhcp_pool_size=240,
        description="디바이스 C 그룹",
    ),
    VLANConfig(
        vlan_id=40,
        name="VLAN-40-Workstations",
        subnet="192.168.40.0/24",
        gateway="192.168.40.1",
        dhcp_pool_start="192.168.40.10",
        dhcp_pool_end="192.168.40.50",
        dhcp_pool_size=40,
        description="워크스테이션",
    ),
    VLANConfig(
        vlan_id=50,
        name="VLAN-50-IoT",
        subnet="192.168.50.0/24",
        gateway="192.168.50.1",
        dhcp_pool_start="192.168.50.10",
        dhcp_pool_end="192.168.50.100",
        dhcp_pool_size=90,
        description="IoT 디바이스",
    ),
]

DEFAULT_AP_CONFIGS = [
    APConfig(
        ap_id="ap-1",
        name="EAP-673-1",
        mac_address="00:11:22:33:44:01",
        ip_address="192.168.1.11",
        location="서버실-A",
        max_clients=50,
        supported_vlans=[1, 10, 20],
    ),
    APConfig(
        ap_id="ap-2",
        name="EAP-673-2",
        mac_address="00:11:22:33:44:02",
        ip_address="192.168.1.12",
        location="서버실-B",
        max_clients=50,
        supported_vlans=[1, 10, 20],
    ),
    APConfig(
        ap_id="ap-3",
        name="EAP-673-3",
        mac_address="00:11:22:33:44:03",
        ip_address="192.168.1.13",
        location="작업실-A",
        max_clients=50,
        supported_vlans=[20, 30],
    ),
    APConfig(
        ap_id="ap-4",
        name="EAP-673-4",
        mac_address="00:11:22:33:44:04",
        ip_address="192.168.1.14",
        location="작업실-B",
        max_clients=50,
        supported_vlans=[20, 30],
    ),
    APConfig(
        ap_id="ap-5",
        name="EAP-673-5",
        mac_address="00:11:22:33:44:05",
        ip_address="192.168.1.15",
        location="작업실-C",
        max_clients=50,
        supported_vlans=[30, 40],
    ),
    APConfig(
        ap_id="ap-6",
        name="EAP-673-6",
        mac_address="00:11:22:33:44:06",
        ip_address="192.168.1.16",
        location="관리실",
        max_clients=50,
        supported_vlans=[40, 50],
    ),
]


# =========================================
# 데이터 클래스
# =========================================

@dataclass
class DeviceNetworkInfo:
    """디바이스 네트워크 정보"""
    device_id: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    vlan_id: Optional[int] = None
    ap_id: Optional[str] = None
    is_connected: bool = False
    last_seen: Optional[datetime] = None


@dataclass
class NetworkAlert:
    """네트워크 알림"""
    alert_type: str
    severity: str  # info, warning, critical
    title: str
    message: str
    source: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)


# =========================================
# NetworkHealthChecker
# =========================================

class NetworkHealthChecker:
    """
    네트워크 헬스 체커

    VLAN, AP, DHCP 상태를 모니터링하고 알림 생성
    """

    def __init__(
        self,
        config: Optional[NetworkHealthConfig] = None,
        vlan_configs: Optional[List[VLANConfig]] = None,
        ap_configs: Optional[List[APConfig]] = None,
    ):
        self.config = config or NetworkHealthConfig()
        self._vlan_configs = {v.vlan_id: v for v in (vlan_configs or DEFAULT_VLAN_CONFIGS)}
        self._ap_configs = {a.ap_id: a for a in (ap_configs or DEFAULT_AP_CONFIGS)}

        # 상태 캐시
        self._vlan_statuses: Dict[int, VLANStatus] = {}
        self._ap_statuses: Dict[str, APStatus] = {}
        self._dhcp_statuses: Dict[int, DHCPPoolStatus] = {}
        self._device_network_info: Dict[str, DeviceNetworkInfo] = {}

        # 알림
        self._alerts: List[NetworkAlert] = []
        self._last_alert_time: Dict[str, datetime] = {}

        # 콜백
        self._on_alert_callbacks: List[Callable] = []

        # 초기화
        self._initialize_statuses()

    def _initialize_statuses(self):
        """상태 초기화"""
        for vlan_id, config in self._vlan_configs.items():
            self._vlan_statuses[vlan_id] = VLANStatus(
                vlan_id=vlan_id,
                name=config.name,
                dhcp_pool_size=config.dhcp_pool_size,
            )
            self._dhcp_statuses[vlan_id] = DHCPPoolStatus(
                pool_id=f"dhcp-vlan-{vlan_id}",
                name=f"DHCP-VLAN-{vlan_id}",
                vlan_id=vlan_id,
                pool_size=config.dhcp_pool_size,
                warning_threshold=self.config.dhcp_warning_threshold,
                critical_threshold=self.config.dhcp_critical_threshold,
            )

        for ap_id, config in self._ap_configs.items():
            self._ap_statuses[ap_id] = APStatus(
                ap_id=ap_id,
                name=config.name,
                max_clients=config.max_clients,
            )

    # =========================================
    # VLAN 관리
    # =========================================

    def get_vlan_config(self, vlan_id: int) -> Optional[VLANConfig]:
        """VLAN 설정 조회"""
        return self._vlan_configs.get(vlan_id)

    def get_vlan_status(self, vlan_id: int) -> Optional[VLANStatus]:
        """VLAN 상태 조회"""
        return self._vlan_statuses.get(vlan_id)

    def get_all_vlan_statuses(self) -> List[VLANStatus]:
        """모든 VLAN 상태 조회"""
        return list(self._vlan_statuses.values())

    def update_vlan_device_count(
        self,
        vlan_id: int,
        total: int,
        online: int,
    ) -> Optional[VLANStatus]:
        """VLAN 디바이스 수 업데이트"""
        status = self._vlan_statuses.get(vlan_id)
        if not status:
            return None

        status.total_devices = total
        status.online_devices = online
        status.offline_devices = total - online
        status.last_updated = datetime.now(timezone.utc)

        # 상태 결정
        if status.total_devices == 0:
            status.status = NetworkStatus.WARNING
        elif status.offline_devices > status.total_devices * 0.5:
            status.status = NetworkStatus.CRITICAL
        elif status.offline_devices > status.total_devices * 0.2:
            status.status = NetworkStatus.WARNING
        else:
            status.status = NetworkStatus.HEALTHY

        return status

    def get_vlan_device_distribution(
        self,
        devices: List[DeviceNetworkInfo],
    ) -> List[VLANDeviceDistribution]:
        """VLAN별 디바이스 분포 계산"""
        distribution: Dict[int, List[str]] = {}

        for device in devices:
            if device.vlan_id:
                if device.vlan_id not in distribution:
                    distribution[device.vlan_id] = []
                distribution[device.vlan_id].append(device.device_id)

        total_devices = len(devices)
        result = []

        for vlan_id, device_ids in distribution.items():
            config = self._vlan_configs.get(vlan_id)
            result.append(VLANDeviceDistribution(
                vlan_id=vlan_id,
                vlan_name=config.name if config else f"VLAN-{vlan_id}",
                device_count=len(device_ids),
                percentage=(len(device_ids) / total_devices * 100) if total_devices > 0 else 0,
                devices=device_ids,
            ))

        return sorted(result, key=lambda x: x.device_count, reverse=True)

    # =========================================
    # AP 관리
    # =========================================

    def get_ap_config(self, ap_id: str) -> Optional[APConfig]:
        """AP 설정 조회"""
        return self._ap_configs.get(ap_id)

    def get_ap_status(self, ap_id: str) -> Optional[APStatus]:
        """AP 상태 조회"""
        return self._ap_statuses.get(ap_id)

    def get_all_ap_statuses(self) -> List[APStatus]:
        """모든 AP 상태 조회"""
        return list(self._ap_statuses.values())

    def update_ap_status(
        self,
        ap_id: str,
        connected_clients: int,
        is_online: bool = True,
        channel: Optional[int] = None,
        signal_strength_dbm: Optional[int] = None,
    ) -> Optional[APStatus]:
        """AP 상태 업데이트"""
        status = self._ap_statuses.get(ap_id)
        if not status:
            return None

        status.connected_clients = connected_clients
        status.calculate_usage()

        if channel:
            status.channel = channel
        if signal_strength_dbm:
            status.signal_strength_dbm = signal_strength_dbm

        status.last_seen = datetime.now(timezone.utc)
        status.last_updated = datetime.now(timezone.utc)

        # 상태 결정
        if not is_online:
            status.status = APStatusValue.OFFLINE
            self._create_alert(
                alert_type="ap_offline",
                severity="critical",
                title=f"AP Offline: {status.name}",
                message=f"AP {status.name} is offline",
                source=ap_id,
            )
        elif status.client_usage_percent >= self.config.ap_client_critical_threshold:
            status.status = APStatusValue.OVERLOADED
            self._create_alert(
                alert_type="ap_overloaded",
                severity="warning",
                title=f"AP Overloaded: {status.name}",
                message=f"AP {status.name} has {connected_clients} clients ({status.client_usage_percent:.1f}%)",
                source=ap_id,
            )
        elif status.client_usage_percent >= self.config.ap_client_warning_threshold:
            status.status = APStatusValue.DEGRADED
        else:
            status.status = APStatusValue.ONLINE

        return status

    def get_ap_client_distribution(self) -> List[APClientInfo]:
        """AP별 클라이언트 분포"""
        result = []
        for ap_id, status in self._ap_statuses.items():
            clients = [
                d.device_id for d in self._device_network_info.values()
                if d.ap_id == ap_id
            ]
            result.append(APClientInfo(
                ap_id=ap_id,
                ap_name=status.name,
                connected_clients=status.connected_clients,
                client_device_ids=clients,
            ))
        return sorted(result, key=lambda x: x.connected_clients, reverse=True)

    # =========================================
    # DHCP 관리
    # =========================================

    def get_dhcp_status(self, vlan_id: int) -> Optional[DHCPPoolStatus]:
        """DHCP 풀 상태 조회"""
        return self._dhcp_statuses.get(vlan_id)

    def get_all_dhcp_statuses(self) -> List[DHCPPoolStatus]:
        """모든 DHCP 풀 상태 조회"""
        return list(self._dhcp_statuses.values())

    def update_dhcp_usage(
        self,
        vlan_id: int,
        used_addresses: int,
        active_leases: int = 0,
    ) -> Optional[DHCPPoolStatus]:
        """DHCP 사용량 업데이트"""
        status = self._dhcp_statuses.get(vlan_id)
        if not status:
            return None

        status.used_addresses = used_addresses
        status.active_leases = active_leases
        old_status = status.status
        status.calculate_status()
        status.last_updated = datetime.now(timezone.utc)

        # 상태 변경 시 알림
        if status.status != old_status:
            if status.status == DHCPStatus.CRITICAL:
                self._create_alert(
                    alert_type="dhcp_critical",
                    severity="critical",
                    title=f"DHCP Critical: VLAN {vlan_id}",
                    message=f"DHCP pool usage at {status.usage_percent:.1f}%",
                    source=f"vlan-{vlan_id}",
                    metadata={"usage_percent": status.usage_percent},
                )
            elif status.status == DHCPStatus.WARNING:
                self._create_alert(
                    alert_type="dhcp_warning",
                    severity="warning",
                    title=f"DHCP Warning: VLAN {vlan_id}",
                    message=f"DHCP pool usage at {status.usage_percent:.1f}%",
                    source=f"vlan-{vlan_id}",
                    metadata={"usage_percent": status.usage_percent},
                )
            elif status.status == DHCPStatus.EXHAUSTED:
                self._create_alert(
                    alert_type="dhcp_exhausted",
                    severity="critical",
                    title=f"DHCP Exhausted: VLAN {vlan_id}",
                    message="DHCP pool is completely exhausted!",
                    source=f"vlan-{vlan_id}",
                )

        # VLAN 상태도 업데이트
        vlan_status = self._vlan_statuses.get(vlan_id)
        if vlan_status:
            vlan_status.dhcp_used = used_addresses
            vlan_status.calculate_dhcp_usage()

        return status

    def estimate_ip_from_vlan(self, vlan_id: int) -> Optional[str]:
        """VLAN에서 사용 가능한 IP 추정"""
        config = self._vlan_configs.get(vlan_id)
        if not config:
            return None

        try:
            network = ipaddress.ip_network(config.subnet, strict=False)
            start = ipaddress.ip_address(config.dhcp_pool_start)
            used_ips = {
                ipaddress.ip_address(d.ip_address)
                for d in self._device_network_info.values()
                if d.ip_address and d.vlan_id == vlan_id
            }

            for ip in network.hosts():
                if ip >= start and ip not in used_ips:
                    return str(ip)
        except Exception as e:
            logger.error(f"IP estimation failed: {e}")

        return None

    # =========================================
    # 디바이스 네트워크 정보
    # =========================================

    def register_device(
        self,
        device_id: str,
        ip_address: Optional[str] = None,
        mac_address: Optional[str] = None,
        vlan_id: Optional[int] = None,
        ap_id: Optional[str] = None,
    ) -> DeviceNetworkInfo:
        """디바이스 네트워크 정보 등록"""
        info = DeviceNetworkInfo(
            device_id=device_id,
            ip_address=ip_address,
            mac_address=mac_address,
            vlan_id=vlan_id,
            ap_id=ap_id,
            is_connected=True,
            last_seen=datetime.now(timezone.utc),
        )
        self._device_network_info[device_id] = info
        return info

    def update_device_connection(
        self,
        device_id: str,
        is_connected: bool,
    ) -> Optional[DeviceNetworkInfo]:
        """디바이스 연결 상태 업데이트"""
        info = self._device_network_info.get(device_id)
        if info:
            info.is_connected = is_connected
            if is_connected:
                info.last_seen = datetime.now(timezone.utc)
        return info

    def get_device_network_info(self, device_id: str) -> Optional[DeviceNetworkInfo]:
        """디바이스 네트워크 정보 조회"""
        return self._device_network_info.get(device_id)

    def get_all_device_network_info(self) -> List[DeviceNetworkInfo]:
        """모든 디바이스 네트워크 정보 조회"""
        return list(self._device_network_info.values())

    # =========================================
    # 헬스 체크
    # =========================================

    async def get_health_summary(self) -> NetworkHealthSummary:
        """네트워크 헬스 요약 조회"""
        summary = NetworkHealthSummary()

        # VLAN 요약
        summary.total_vlans = len(self._vlan_statuses)
        for status in self._vlan_statuses.values():
            if status.status == NetworkStatus.HEALTHY:
                summary.healthy_vlans += 1
            elif status.status == NetworkStatus.WARNING:
                summary.warning_vlans += 1
            elif status.status in (NetworkStatus.CRITICAL, NetworkStatus.DOWN):
                summary.critical_vlans += 1

            summary.total_devices += status.total_devices
            summary.online_devices += status.online_devices
            summary.offline_devices += status.offline_devices

        # AP 요약
        summary.total_aps = len(self._ap_statuses)
        for status in self._ap_statuses.values():
            if status.status == APStatusValue.ONLINE:
                summary.online_aps += 1
            elif status.status == APStatusValue.OFFLINE:
                summary.offline_aps += 1
            elif status.status == APStatusValue.OVERLOADED:
                summary.overloaded_aps += 1

        # DHCP 요약
        summary.total_dhcp_pools = len(self._dhcp_statuses)
        for status in self._dhcp_statuses.values():
            if status.status == DHCPStatus.NORMAL:
                summary.dhcp_normal += 1
            elif status.status == DHCPStatus.WARNING:
                summary.dhcp_warning += 1
            elif status.status in (DHCPStatus.CRITICAL, DHCPStatus.EXHAUSTED):
                summary.dhcp_critical += 1

        # 세부 상태
        summary.vlan_statuses = list(self._vlan_statuses.values())
        summary.ap_statuses = list(self._ap_statuses.values())
        summary.dhcp_statuses = list(self._dhcp_statuses.values())

        # 이슈 수집
        summary.issues = self._collect_issues()

        # 전체 상태 계산
        summary.calculate_overall_status()
        summary.last_updated = datetime.now(timezone.utc)

        return summary

    def _collect_issues(self) -> List[str]:
        """이슈 수집"""
        issues = []

        # DHCP 이슈
        for status in self._dhcp_statuses.values():
            if status.status == DHCPStatus.EXHAUSTED:
                issues.append(f"DHCP pool exhausted for VLAN {status.vlan_id}")
            elif status.status == DHCPStatus.CRITICAL:
                issues.append(f"DHCP pool critical ({status.usage_percent:.1f}%) for VLAN {status.vlan_id}")

        # AP 이슈
        for status in self._ap_statuses.values():
            if status.status == APStatusValue.OFFLINE:
                issues.append(f"AP {status.name} is offline")
            elif status.status == APStatusValue.OVERLOADED:
                issues.append(f"AP {status.name} is overloaded ({status.connected_clients} clients)")

        # VLAN 이슈
        for status in self._vlan_statuses.values():
            if status.status == NetworkStatus.CRITICAL:
                issues.append(f"VLAN {status.vlan_id} has critical issues ({status.offline_devices} offline)")

        return issues

    async def create_snapshot(self) -> NetworkHealthSnapshot:
        """헬스 스냅샷 생성"""
        summary = await self.get_health_summary()

        return NetworkHealthSnapshot(
            overall_status=summary.overall_status,
            total_devices=summary.total_devices,
            online_devices=summary.online_devices,
            vlan_data={
                str(v.vlan_id): {
                    "name": v.name,
                    "status": v.status.value,
                    "total_devices": v.total_devices,
                    "online_devices": v.online_devices,
                    "dhcp_usage_percent": v.dhcp_usage_percent,
                }
                for v in self._vlan_statuses.values()
            },
            ap_data={
                a.ap_id: {
                    "name": a.name,
                    "status": a.status.value if isinstance(a.status, APStatusValue) else a.status,
                    "connected_clients": a.connected_clients,
                    "client_usage_percent": a.client_usage_percent,
                }
                for a in self._ap_statuses.values()
            },
            dhcp_data={
                str(d.vlan_id): {
                    "status": d.status.value,
                    "usage_percent": d.usage_percent,
                    "used_addresses": d.used_addresses,
                    "available_addresses": d.available_addresses,
                }
                for d in self._dhcp_statuses.values()
            },
            issues=summary.issues,
        )

    # =========================================
    # 알림
    # =========================================

    def _create_alert(
        self,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[NetworkAlert]:
        """알림 생성 (쿨다운 적용)"""
        alert_key = f"{alert_type}:{source}"

        # 쿨다운 확인
        last_time = self._last_alert_time.get(alert_key)
        if last_time:
            elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
            if elapsed < self.config.alert_cooldown_seconds:
                return None

        alert = NetworkAlert(
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            source=source,
            metadata=metadata or {},
        )

        self._alerts.append(alert)
        self._last_alert_time[alert_key] = alert.created_at

        # 콜백 실행
        for callback in self._on_alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")

        logger.warning(f"Network alert: [{severity}] {title}")
        return alert

    def on_alert(self, callback: Callable[[NetworkAlert], None]) -> None:
        """알림 콜백 등록"""
        self._on_alert_callbacks.append(callback)

    def get_recent_alerts(self, hours: int = 24) -> List[NetworkAlert]:
        """최근 알림 조회"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        return [a for a in self._alerts if a.created_at >= cutoff]

    def clear_alerts(self) -> int:
        """알림 초기화"""
        count = len(self._alerts)
        self._alerts.clear()
        return count

    # =========================================
    # 유틸리티
    # =========================================

    def get_status_dict(self) -> Dict[str, Any]:
        """전체 상태 딕셔너리"""
        return {
            "vlans": {
                str(k): {
                    "name": v.name,
                    "status": v.status.value,
                    "devices": v.total_devices,
                    "online": v.online_devices,
                }
                for k, v in self._vlan_statuses.items()
            },
            "aps": {
                k: {
                    "name": v.name,
                    "status": v.status.value if isinstance(v.status, APStatusValue) else v.status,
                    "clients": v.connected_clients,
                }
                for k, v in self._ap_statuses.items()
            },
            "dhcp": {
                str(k): {
                    "status": v.status.value,
                    "usage_percent": v.usage_percent,
                }
                for k, v in self._dhcp_statuses.items()
            },
            "alerts": len(self._alerts),
        }


# =========================================
# 싱글톤
# =========================================

_network_health_checker: Optional[NetworkHealthChecker] = None


def get_network_health_checker() -> NetworkHealthChecker:
    """NetworkHealthChecker 싱글톤"""
    global _network_health_checker
    if _network_health_checker is None:
        _network_health_checker = NetworkHealthChecker()
    return _network_health_checker


def reset_network_health_checker() -> None:
    """싱글톤 리셋 (테스트용)"""
    global _network_health_checker
    _network_health_checker = None
