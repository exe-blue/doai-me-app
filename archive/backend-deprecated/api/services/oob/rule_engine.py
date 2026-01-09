"""
DoAi.Me OOB - Rule Engine
Threshold 기반 장애 감지 및 복구 결정

Strategos Security Design v1
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Callable

from .health_collector import NodeHealth, NodeMetrics, ConnectionStatus

logger = logging.getLogger(__name__)


class FailureLevel(str, Enum):
    """장애 수준"""
    NONE = "none"          # 정상
    P1_WARNING = "p1"      # 경고 - 관찰 필요
    P0_CRITICAL = "p0"     # 긴급 - 즉시 복구 필요


class RecoveryAction(str, Enum):
    """복구 액션 타입"""
    NONE = "none"
    SOFT = "soft"          # ADB 재시작, 에이전트 재시작
    RESTART = "restart"    # 서비스 전체 재시작, USB 스택 리프레시
    BOX_RESET = "box"      # 박스 전원 제어 (최후 수단)


@dataclass
class ThresholdConfig:
    """Threshold 설정 (운영하면서 튜닝)"""
    
    # P0 장애 (즉시 복구)
    heartbeat_timeout_sec: float = 45.0
    heartbeat_consecutive_failures: int = 2
    
    device_loss_threshold_pct: float = 0.10  # 10% 이상 감소
    device_loss_consecutive_failures: int = 3
    device_loss_window_sec: int = 90
    
    adb_failure_consecutive: int = 2
    unauthorized_threshold: int = 3
    unauthorized_consecutive: int = 2
    
    # P1 경고 (관찰)
    device_warning_threshold_pct: float = 0.03  # 3% 이상 감소
    device_warning_duration_sec: int = 300  # 5분 지속
    ws_disconnect_warning_sec: int = 30
    
    # 복구 쿨다운 (분)
    soft_cooldown_min: int = 3
    restart_cooldown_min: int = 15
    box_cooldown_min: int = 30
    
    # 에스컬레이션 타임아웃 (분)
    soft_to_restart_timeout_min: int = 5
    restart_to_box_timeout_min: int = 5


@dataclass
class RuleEngineResult:
    """규칙 엔진 결과"""
    node_id: str
    failure_level: FailureLevel
    recommended_action: RecoveryAction
    reasons: List[str]
    can_execute: bool  # 쿨다운 통과 여부
    cooldown_remaining_sec: Optional[int] = None
    evaluated_at: datetime = None
    
    def __post_init__(self):
        if self.evaluated_at is None:
            self.evaluated_at = datetime.utcnow()


class RuleEngine:
    """
    Threshold 기반 장애 감지 및 복구 결정 엔진
    
    역할:
    - 노드 메트릭을 threshold와 비교
    - 장애 수준 결정 (P0/P1/None)
    - 복구 액션 추천
    - 쿨다운 관리
    """
    
    def __init__(self, config: Optional[ThresholdConfig] = None):
        self.config = config or ThresholdConfig()
        self._last_recovery: dict = {}  # node_id -> {action, timestamp}
    
    def evaluate(self, node: NodeHealth) -> RuleEngineResult:
        """
        노드 상태 평가 및 복구 결정
        
        Returns:
            RuleEngineResult: 평가 결과 및 추천 액션
        """
        reasons = []
        failure_level = FailureLevel.NONE
        recommended_action = RecoveryAction.NONE
        
        # === P0 체크 (즉시 복구 필요) ===
        
        # 1. 하트비트 타임아웃
        heartbeat_failures = node.get_consecutive_failures(
            lambda m: m.node_heartbeat_age_sec > self.config.heartbeat_timeout_sec
        )
        if heartbeat_failures >= self.config.heartbeat_consecutive_failures:
            failure_level = FailureLevel.P0_CRITICAL
            reasons.append(f"Heartbeat timeout ({heartbeat_failures} consecutive)")
        
        # 2. 디바이스 급감
        device_loss_failures = node.get_consecutive_failures(
            lambda m: m.device_loss_pct >= self.config.device_loss_threshold_pct
        )
        if device_loss_failures >= self.config.device_loss_consecutive_failures:
            failure_level = FailureLevel.P0_CRITICAL
            reasons.append(f"Device loss >={self.config.device_loss_threshold_pct*100}% ({device_loss_failures} consecutive)")
        
        # 3. ADB 서버 이상
        adb_failures = node.get_consecutive_failures(
            lambda m: not m.adb_server_ok
        )
        if adb_failures >= self.config.adb_failure_consecutive:
            failure_level = FailureLevel.P0_CRITICAL
            reasons.append(f"ADB server failure ({adb_failures} consecutive)")
        
        # 4. Unauthorized 폭증
        unauthorized_failures = node.get_consecutive_failures(
            lambda m: m.unauthorized_count >= self.config.unauthorized_threshold
        )
        if unauthorized_failures >= self.config.unauthorized_consecutive:
            failure_level = FailureLevel.P0_CRITICAL
            reasons.append(f"Too many unauthorized devices ({node.metrics.unauthorized_count})")
        
        # === P1 체크 (경고) ===
        if failure_level == FailureLevel.NONE:
            # 디바이스 경미한 감소 지속
            if node.metrics.device_loss_pct >= self.config.device_warning_threshold_pct:
                # 히스토리에서 지속 시간 확인
                duration = self._calculate_condition_duration(
                    node, 
                    lambda m: m.device_loss_pct >= self.config.device_warning_threshold_pct
                )
                if duration >= self.config.device_warning_duration_sec:
                    failure_level = FailureLevel.P1_WARNING
                    reasons.append(f"Device loss >={self.config.device_warning_threshold_pct*100}% for {duration}s")
            
            # WebSocket 연결 끊김
            if not node.metrics.ws_connected:
                failure_level = FailureLevel.P1_WARNING
                reasons.append("WebSocket disconnected")
        
        # === 복구 액션 결정 ===
        if failure_level == FailureLevel.P0_CRITICAL:
            recommended_action = self._determine_recovery_action(node)
        
        # === 쿨다운 체크 ===
        can_execute, cooldown_remaining = self._check_cooldown(
            node.node_id, 
            recommended_action
        )
        
        result = RuleEngineResult(
            node_id=node.node_id,
            failure_level=failure_level,
            recommended_action=recommended_action,
            reasons=reasons,
            can_execute=can_execute,
            cooldown_remaining_sec=cooldown_remaining
        )
        
        if failure_level != FailureLevel.NONE:
            logger.warning(
                f"Node {node.node_id}: {failure_level.value} - {', '.join(reasons)} "
                f"-> {recommended_action.value} (can_execute={can_execute})"
            )
        
        return result
    
    def _determine_recovery_action(self, node: NodeHealth) -> RecoveryAction:
        """
        에스컬레이션 경로에 따라 복구 액션 결정
        
        Step 1: Soft Recovery (ADB/에이전트 재시작)
        Step 2: Service Restart (전체 서비스 재시작)
        Step 3: Box Power Control (전원 제어)
        """
        last_recovery = self._last_recovery.get(node.node_id)
        
        if not last_recovery:
            # 첫 복구 -> Soft
            return RecoveryAction.SOFT
        
        elapsed = datetime.utcnow() - last_recovery['timestamp']
        last_action = last_recovery['action']
        
        # Soft 후 5분 내 회복 실패 -> Restart
        if last_action == RecoveryAction.SOFT:
            if elapsed < timedelta(minutes=self.config.soft_to_restart_timeout_min):
                return RecoveryAction.RESTART
            else:
                # 시간 지남, 다시 Soft부터
                return RecoveryAction.SOFT
        
        # Restart 후 5분 내 회복 실패 -> Box
        if last_action == RecoveryAction.RESTART:
            if elapsed < timedelta(minutes=self.config.restart_to_box_timeout_min):
                if node.metrics.box_tcp_ok:
                    return RecoveryAction.BOX_RESET
                else:
                    logger.warning(f"Box TCP not available for {node.node_id}, staying at RESTART")
                    return RecoveryAction.RESTART
            else:
                # 시간 지남, 다시 Soft부터
                return RecoveryAction.SOFT
        
        # Box 후에는 시간 지나야 다시 시도
        if last_action == RecoveryAction.BOX_RESET:
            return RecoveryAction.SOFT
        
        return RecoveryAction.SOFT
    
    def _check_cooldown(
        self, 
        node_id: str, 
        action: RecoveryAction
    ) -> tuple[bool, Optional[int]]:
        """쿨다운 체크"""
        if action == RecoveryAction.NONE:
            return True, None
        
        last_recovery = self._last_recovery.get(node_id)
        if not last_recovery:
            return True, None
        
        # 액션별 쿨다운
        cooldown_map = {
            RecoveryAction.SOFT: self.config.soft_cooldown_min,
            RecoveryAction.RESTART: self.config.restart_cooldown_min,
            RecoveryAction.BOX_RESET: self.config.box_cooldown_min,
        }
        
        cooldown_minutes = cooldown_map.get(action, 3)
        elapsed = datetime.utcnow() - last_recovery['timestamp']
        cooldown_delta = timedelta(minutes=cooldown_minutes)
        
        if elapsed < cooldown_delta:
            remaining = int((cooldown_delta - elapsed).total_seconds())
            return False, remaining
        
        return True, None
    
    def _calculate_condition_duration(
        self, 
        node: NodeHealth, 
        condition: Callable[[NodeMetrics], bool]
    ) -> int:
        """조건이 지속된 시간(초) 계산"""
        if not node.metrics_history:
            return 0
        
        # 최근부터 역순으로 조건 만족 체크
        duration_start = None
        for metrics in reversed(node.metrics_history):
            if condition(metrics):
                duration_start = metrics.collected_at
            else:
                break
        
        if duration_start:
            return int((datetime.utcnow() - duration_start).total_seconds())
        return 0
    
    def record_recovery_attempt(
        self, 
        node_id: str, 
        action: RecoveryAction
    ):
        """복구 시도 기록"""
        self._last_recovery[node_id] = {
            'action': action,
            'timestamp': datetime.utcnow()
        }
        logger.info(f"Recovery attempt recorded: {node_id} -> {action.value}")
    
    def reset_escalation(self, node_id: str):
        """에스컬레이션 리셋 (회복 성공 시)"""
        if node_id in self._last_recovery:
            del self._last_recovery[node_id]
            logger.info(f"Escalation reset for {node_id}")

