"""
네트워크 헬스 스키마 정의

PR #3: 네트워크 헬스 대시보드
- VLAN별 디바이스 분포 모니터링
- AP별 연결 수 추적
- DHCP 사용률 경고 임계값 설정

환경:
- TP-Link ER-7412 (라우터)
- SG3210XMP-MK2 (DHCP 서버)
- EAP-673 ×6 (무선 AP)
- 6 VLANs, 1 SSID
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid


# =========================================
# Enums
# =========================================

class NetworkStatus(str, Enum):
    """네트워크 상태"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    DOWN = "down"


class APStatusValue(str, Enum):
    """AP 상태 값"""
    ONLINE = "online"
    OFFLINE = "offline"
    OVERLOADED = "overloaded"
    DEGRADED = "degraded"


class DHCPStatus(str, Enum):
    """DHCP 상태"""
    NORMAL = "normal"
    WARNING = "warning"  # 70% 이상
    CRITICAL = "critical"  # 90% 이상
    EXHAUSTED = "exhausted"  # 100%


# =========================================
# VLAN 관련 스키마
# =========================================

class VLANConfig(BaseModel):
    """VLAN 설정"""
    vlan_id: int = Field(..., ge=1, le=4094, description="VLAN ID")
    name: str = Field(..., max_length=50, description="VLAN 이름")
    subnet: str = Field(..., description="서브넷 (예: 192.168.10.0/24)")
    gateway: str = Field(..., description="게이트웨이 IP")
    dhcp_pool_start: str = Field(..., description="DHCP 풀 시작 IP")
    dhcp_pool_end: str = Field(..., description="DHCP 풀 끝 IP")
    dhcp_pool_size: int = Field(..., ge=1, description="DHCP 풀 크기")
    description: Optional[str] = None


class VLANStatus(BaseModel):
    """VLAN 상태"""
    vlan_id: int
    name: str
    status: NetworkStatus = NetworkStatus.HEALTHY

    # 디바이스 수
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0

    # DHCP 사용률
    dhcp_used: int = 0
    dhcp_pool_size: int = 0
    dhcp_usage_percent: float = 0.0

    # 트래픽 (옵션)
    bytes_in: Optional[int] = None
    bytes_out: Optional[int] = None

    last_updated: datetime = Field(default_factory=datetime.utcnow)

    def calculate_dhcp_usage(self) -> float:
        """DHCP 사용률 계산"""
        if self.dhcp_pool_size > 0:
            self.dhcp_usage_percent = (self.dhcp_used / self.dhcp_pool_size) * 100
        return self.dhcp_usage_percent


class VLANDeviceDistribution(BaseModel):
    """VLAN별 디바이스 분포"""
    vlan_id: int
    vlan_name: str
    device_count: int
    percentage: float = 0.0
    devices: List[str] = Field(default_factory=list)  # 디바이스 ID 목록


# =========================================
# AP 관련 스키마
# =========================================

class APConfig(BaseModel):
    """AP 설정"""
    ap_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., max_length=50, description="AP 이름 (예: EAP-673-1)")
    mac_address: str = Field(..., description="MAC 주소")
    ip_address: str = Field(..., description="IP 주소")
    location: Optional[str] = Field(None, description="물리적 위치")
    max_clients: int = Field(default=50, ge=1, description="최대 연결 수")
    supported_vlans: List[int] = Field(default_factory=list, description="지원 VLAN 목록")


class APStatus(BaseModel):
    """AP 상태"""
    ap_id: str
    name: str
    status: APStatusValue = APStatusValue.ONLINE

    # 연결 정보
    connected_clients: int = 0
    max_clients: int = 50
    client_usage_percent: float = 0.0

    # 시그널/채널
    channel: Optional[int] = None
    signal_strength_dbm: Optional[int] = None  # dBm
    noise_floor_dbm: Optional[int] = None

    # 트래픽
    tx_bytes: Optional[int] = None
    rx_bytes: Optional[int] = None
    tx_packets: Optional[int] = None
    rx_packets: Optional[int] = None

    # 에러
    tx_errors: int = 0
    rx_errors: int = 0

    # 업타임
    uptime_seconds: Optional[int] = None
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    def calculate_usage(self) -> float:
        """클라이언트 사용률 계산"""
        if self.max_clients > 0:
            self.client_usage_percent = (self.connected_clients / self.max_clients) * 100
        return self.client_usage_percent


class APClientInfo(BaseModel):
    """AP에 연결된 클라이언트 정보"""
    ap_id: str
    ap_name: str
    connected_clients: int
    client_device_ids: List[str] = Field(default_factory=list)


# =========================================
# DHCP 관련 스키마
# =========================================

class DHCPPoolConfig(BaseModel):
    """DHCP 풀 설정"""
    pool_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    vlan_id: int
    start_ip: str
    end_ip: str
    pool_size: int
    lease_time_seconds: int = Field(default=86400, description="리스 타임 (초)")

    # 경고 임계값
    warning_threshold_percent: float = Field(default=70.0, ge=0, le=100)
    critical_threshold_percent: float = Field(default=90.0, ge=0, le=100)


class DHCPPoolStatus(BaseModel):
    """DHCP 풀 상태"""
    pool_id: str
    name: str
    vlan_id: int
    status: DHCPStatus = DHCPStatus.NORMAL

    # 사용량
    pool_size: int
    used_addresses: int = 0
    available_addresses: int = 0
    usage_percent: float = 0.0

    # 임계값
    warning_threshold: float = 70.0
    critical_threshold: float = 90.0

    # 리스 정보
    active_leases: int = 0
    expired_leases: int = 0

    last_updated: datetime = Field(default_factory=datetime.utcnow)

    def calculate_status(self) -> DHCPStatus:
        """DHCP 상태 계산"""
        if self.pool_size > 0:
            self.usage_percent = (self.used_addresses / self.pool_size) * 100
            self.available_addresses = self.pool_size - self.used_addresses

        if self.usage_percent >= 100:
            self.status = DHCPStatus.EXHAUSTED
        elif self.usage_percent >= self.critical_threshold:
            self.status = DHCPStatus.CRITICAL
        elif self.usage_percent >= self.warning_threshold:
            self.status = DHCPStatus.WARNING
        else:
            self.status = DHCPStatus.NORMAL

        return self.status


class DHCPLease(BaseModel):
    """DHCP 리스 정보"""
    ip_address: str
    mac_address: str
    hostname: Optional[str] = None
    device_id: Optional[str] = None
    vlan_id: int
    lease_start: datetime
    lease_end: datetime
    is_active: bool = True


# =========================================
# 네트워크 헬스 종합 스키마
# =========================================

class NetworkHealthConfig(BaseModel):
    """네트워크 헬스 설정"""
    # DHCP 경고 임계값
    dhcp_warning_threshold: float = Field(default=70.0, ge=0, le=100)
    dhcp_critical_threshold: float = Field(default=90.0, ge=0, le=100)

    # AP 경고 임계값
    ap_client_warning_threshold: float = Field(default=70.0, ge=0, le=100)
    ap_client_critical_threshold: float = Field(default=90.0, ge=0, le=100)

    # 체크 간격
    health_check_interval_seconds: int = Field(default=60, ge=10, le=600)

    # 알림 설정
    enable_slack_alerts: bool = True
    enable_discord_alerts: bool = True
    alert_cooldown_seconds: int = Field(default=300, ge=60, le=3600)


class NetworkHealthSummary(BaseModel):
    """네트워크 헬스 요약"""
    overall_status: NetworkStatus = NetworkStatus.HEALTHY

    # VLAN 요약
    total_vlans: int = 0
    healthy_vlans: int = 0
    warning_vlans: int = 0
    critical_vlans: int = 0

    # AP 요약
    total_aps: int = 0
    online_aps: int = 0
    offline_aps: int = 0
    overloaded_aps: int = 0

    # DHCP 요약
    total_dhcp_pools: int = 0
    dhcp_normal: int = 0
    dhcp_warning: int = 0
    dhcp_critical: int = 0

    # 디바이스 요약
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0

    # 세부 상태
    vlan_statuses: List[VLANStatus] = Field(default_factory=list)
    ap_statuses: List[APStatus] = Field(default_factory=list)
    dhcp_statuses: List[DHCPPoolStatus] = Field(default_factory=list)

    # 이슈
    issues: List[str] = Field(default_factory=list)

    last_updated: datetime = Field(default_factory=datetime.utcnow)

    def calculate_overall_status(self) -> NetworkStatus:
        """전체 상태 계산"""
        # Critical 조건
        if (self.critical_vlans > 0 or
            self.offline_aps > 0 or
            self.dhcp_critical > 0):
            self.overall_status = NetworkStatus.CRITICAL
        # Warning 조건
        elif (self.warning_vlans > 0 or
              self.overloaded_aps > 0 or
              self.dhcp_warning > 0):
            self.overall_status = NetworkStatus.WARNING
        else:
            self.overall_status = NetworkStatus.HEALTHY

        return self.overall_status


class NetworkHealthSnapshot(BaseModel):
    """네트워크 헬스 스냅샷 (DB 저장용)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # 요약 데이터
    overall_status: NetworkStatus
    total_devices: int
    online_devices: int

    # VLAN 데이터
    vlan_data: Dict[str, Any] = Field(default_factory=dict)

    # AP 데이터
    ap_data: Dict[str, Any] = Field(default_factory=dict)

    # DHCP 데이터
    dhcp_data: Dict[str, Any] = Field(default_factory=dict)

    # 이슈
    issues: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)


# =========================================
# API 응답 스키마
# =========================================

class NetworkHealthResponse(BaseModel):
    """네트워크 헬스 API 응답"""
    status: NetworkStatus
    summary: NetworkHealthSummary
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class VLANListResponse(BaseModel):
    """VLAN 목록 응답"""
    total: int
    vlans: List[VLANStatus]


class APListResponse(BaseModel):
    """AP 목록 응답"""
    total: int
    online: int
    offline: int
    aps: List[APStatus]


class DHCPPoolListResponse(BaseModel):
    """DHCP 풀 목록 응답"""
    total: int
    normal: int
    warning: int
    critical: int
    pools: List[DHCPPoolStatus]


class NetworkAlertCreate(BaseModel):
    """네트워크 알림 생성"""
    alert_type: str  # dhcp_warning, ap_offline, vlan_issue
    severity: str  # info, warning, critical
    title: str
    message: str
    source: str  # vlan_id, ap_id, pool_id
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NetworkAlertResponse(NetworkAlertCreate):
    """네트워크 알림 응답"""
    id: str
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    created_at: datetime
