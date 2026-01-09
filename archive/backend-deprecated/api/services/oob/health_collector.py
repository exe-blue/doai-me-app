"""
DoAi.Me OOB - Health Collector
노드 상태 메트릭 수집 및 관리

Strategos Security Design v1
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ConnectionStatus(str, Enum):
    """노드 연결 상태"""
    CONNECTED = "connected"
    DEGRADED = "degraded"  # 일부 기능 이상
    DISCONNECTED = "disconnected"
    UNKNOWN = "unknown"


@dataclass
class NodeMetrics:
    """노드 메트릭 데이터"""
    # 필수 메트릭 (Strategos 명세)
    node_heartbeat_age_sec: float = 0.0
    device_count_adb: int = 0
    device_count_expected: int = 0
    adb_server_ok: bool = False
    unauthorized_count: int = 0
    ws_connected: bool = False
    box_tcp_ok: bool = False
    
    # 확장 메트릭
    uptime_sec: int = 0
    laixi_connected: bool = False
    laixi_restarts: int = 0
    cpu_usage_pct: float = 0.0
    memory_usage_pct: float = 0.0
    
    # 타임스탬프
    collected_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def device_loss_pct(self) -> float:
        """디바이스 손실률 계산"""
        if self.device_count_expected == 0:
            return 0.0
        return 1.0 - (self.device_count_adb / self.device_count_expected)
    
    @property
    def is_healthy(self) -> bool:
        """기본 건강 상태 체크"""
        return (
            self.adb_server_ok and
            self.unauthorized_count < 3 and
            self.device_loss_pct < 0.1  # 10% 미만 손실
        )


@dataclass
class NodeHealth:
    """노드 건강 상태 전체"""
    node_id: str
    status: ConnectionStatus = ConnectionStatus.UNKNOWN
    metrics: NodeMetrics = field(default_factory=NodeMetrics)
    
    # 히스토리 (최근 N개 메트릭)
    metrics_history: List[NodeMetrics] = field(default_factory=list)
    max_history: int = 20  # 최근 20개 유지
    
    # 복구 상태
    last_recovery_at: Optional[datetime] = None
    recovery_count_soft: int = 0
    recovery_count_restart: int = 0
    recovery_count_box: int = 0
    
    # Tailscale 정보
    tailscale_ip: Optional[str] = None
    tailscale_online: bool = False
    
    def update_metrics(self, metrics: NodeMetrics):
        """메트릭 업데이트 및 히스토리 관리"""
        self.metrics = metrics
        self.metrics_history.append(metrics)
        
        # 히스토리 크기 제한
        if len(self.metrics_history) > self.max_history:
            self.metrics_history = self.metrics_history[-self.max_history:]
        
        # 상태 업데이트
        self._update_status()
    
    def _update_status(self):
        """연결 상태 계산"""
        if self.metrics.node_heartbeat_age_sec > 60:
            self.status = ConnectionStatus.DISCONNECTED
        elif not self.metrics.is_healthy:
            self.status = ConnectionStatus.DEGRADED
        else:
            self.status = ConnectionStatus.CONNECTED
    
    def get_consecutive_failures(self, check_fn) -> int:
        """연속 실패 횟수 계산 (최근 메트릭 기준)"""
        count = 0
        for metrics in reversed(self.metrics_history):
            if check_fn(metrics):
                count += 1
            else:
                break
        return count


class HealthCollector:
    """
    노드 상태 수집기
    
    역할:
    - 각 노드의 건강 상태 메트릭 수집
    - 히스토리 관리
    - RuleEngine에 데이터 제공
    """
    
    def __init__(self, supabase_client=None):
        self._nodes: Dict[str, NodeHealth] = {}
        self._supabase = supabase_client
        self._lock = asyncio.Lock()
        
        # 설정
        self.heartbeat_timeout_sec = 45  # 하트비트 타임아웃
        self.metrics_retention_hours = 24  # 메트릭 보관 시간
    
    def _register_node_unsafe(
        self, 
        node_id: str, 
        expected_devices: int = 0,
        tailscale_ip: Optional[str] = None
    ) -> NodeHealth:
        """노드 등록 (락 없이 - 호출자가 락을 보유해야 함)"""
        if node_id not in self._nodes:
            self._nodes[node_id] = NodeHealth(
                node_id=node_id,
                tailscale_ip=tailscale_ip
            )
            self._nodes[node_id].metrics.device_count_expected = expected_devices
            logger.info(f"Node registered: {node_id} (expected: {expected_devices} devices)")
        return self._nodes[node_id]

    async def register_node(
        self, 
        node_id: str, 
        expected_devices: int = 0,
        tailscale_ip: Optional[str] = None
    ) -> NodeHealth:
        """노드 등록 (외부 호출용 - 락 획득)"""
        async with self._lock:
            return self._register_node_unsafe(node_id, expected_devices, tailscale_ip)
    
    async def update_node_metrics(
        self, 
        node_id: str, 
        metrics_data: dict
    ) -> NodeHealth:
        """
        노드 메트릭 업데이트
        
        Args:
            node_id: 노드 ID
            metrics_data: 메트릭 딕셔너리 (NodeRunner HEARTBEAT에서 수신)
        """
        async with self._lock:
            # 노드가 없으면 자동 등록 (락 없는 버전 사용하여 데드락 방지)
            if node_id not in self._nodes:
                self._register_node_unsafe(node_id)
            
            node = self._nodes[node_id]
            
            # 메트릭 파싱
            metrics = NodeMetrics(
                node_heartbeat_age_sec=0.0,  # 방금 받음
                device_count_adb=metrics_data.get('device_count', 0),
                device_count_expected=node.metrics.device_count_expected or metrics_data.get('device_count', 0),
                adb_server_ok=metrics_data.get('laixi_connected', False),
                unauthorized_count=metrics_data.get('unauthorized_count', 0),
                ws_connected=True,
                box_tcp_ok=metrics_data.get('box_tcp_ok', False),
                uptime_sec=metrics_data.get('uptime_sec', 0),
                laixi_connected=metrics_data.get('laixi_connected', False),
                laixi_restarts=metrics_data.get('laixi_restarts', 0),
                collected_at=datetime.utcnow()
            )
            
            node.update_metrics(metrics)
            node.tailscale_online = True
            
            logger.debug(f"Metrics updated for {node_id}: devices={metrics.device_count_adb}, adb_ok={metrics.adb_server_ok}")
            
            return node
    
    async def mark_heartbeat_timeout(self, node_id: str):
        """하트비트 타임아웃 처리"""
        async with self._lock:
            if node_id in self._nodes:
                node = self._nodes[node_id]
                # 마지막 메트릭의 age 증가
                if node.metrics_history:
                    elapsed = (datetime.utcnow() - node.metrics.collected_at).total_seconds()
                    node.metrics.node_heartbeat_age_sec = elapsed
                    node._update_status()
    
    def get_node(self, node_id: str) -> Optional[NodeHealth]:
        """노드 상태 조회"""
        return self._nodes.get(node_id)
    
    def get_all_nodes(self) -> Dict[str, NodeHealth]:
        """모든 노드 상태 조회"""
        return self._nodes.copy()
    
    def get_unhealthy_nodes(self) -> List[NodeHealth]:
        """비정상 노드 목록"""
        return [
            node for node in self._nodes.values()
            if node.status != ConnectionStatus.CONNECTED
        ]
    
    async def record_recovery(
        self, 
        node_id: str, 
        recovery_type: str  # 'soft', 'restart', 'box'
    ):
        """복구 실행 기록"""
        async with self._lock:
            if node_id in self._nodes:
                node = self._nodes[node_id]
                node.last_recovery_at = datetime.utcnow()
                
                if recovery_type == 'soft':
                    node.recovery_count_soft += 1
                elif recovery_type == 'restart':
                    node.recovery_count_restart += 1
                elif recovery_type == 'box':
                    node.recovery_count_box += 1
                
                logger.info(f"Recovery recorded for {node_id}: type={recovery_type}")
    
    async def can_execute_recovery(
        self, 
        node_id: str, 
        recovery_type: str,
        cooldown_minutes: int
    ) -> bool:
        """복구 실행 가능 여부 (쿨다운 체크)"""
        async with self._lock:
            node = self._nodes.get(node_id)
            if not node or not node.last_recovery_at:
                return True
            
            last_recovery_at = node.last_recovery_at
        
        # 락 해제 후 시간 계산 (락 보유 시간 최소화)
        elapsed = datetime.utcnow() - last_recovery_at
        return elapsed > timedelta(minutes=cooldown_minutes)
    
    async def sync_from_database(self):
        """
        DB에서 노드 정보 동기화
        (노드 목록, 기대 디바이스 수, Tailscale IP 등)
        """
        if not self._supabase:
            logger.warning("Supabase client not configured, skipping DB sync")
            return
        
        try:
            # nodes 테이블에서 정보 조회
            result = self._supabase.table('nodes').select(
                'node_id, name, capacity, tailscale_ip, status_v2'
            ).execute()
            
            for node_data in result.data or []:
                node_id = node_data.get('node_id')
                if node_id:
                    await self.register_node(
                        node_id=node_id,
                        expected_devices=node_data.get('capacity', 0),
                        tailscale_ip=node_data.get('tailscale_ip')
                    )
            
            logger.info(f"Synced {len(result.data or [])} nodes from database")
            
        except Exception as e:
            logger.error(f"Failed to sync nodes from database: {e}")
    
    async def persist_metrics(self, node_id: str):
        """메트릭을 DB에 저장 (선택적)"""
        if not self._supabase:
            return
        
        node = self._nodes.get(node_id)
        if not node:
            return
        
        try:
            self._supabase.table('node_health_logs').insert({
                'node_id': node_id,
                'status': node.status.value,
                'device_count_adb': node.metrics.device_count_adb,
                'device_count_expected': node.metrics.device_count_expected,
                'adb_server_ok': node.metrics.adb_server_ok,
                'unauthorized_count': node.metrics.unauthorized_count,
                'collected_at': node.metrics.collected_at.isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to persist metrics for {node_id}: {e}")

