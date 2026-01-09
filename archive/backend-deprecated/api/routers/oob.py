"""
DoAi.Me OOB (Out-of-Band) API Router
원격 복구 및 박스 제어 API

Strategos Security Design v1
"""

import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from ..services.oob import (
    HealthCollector,
    NodeHealth,
    RuleEngine,
    RecoveryAction,
    RecoveryDispatcher,
    BoxClient,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/oob", tags=["OOB Management"])

# === 싱글톤 인스턴스 ===
_health_collector: Optional[HealthCollector] = None
_rule_engine: Optional[RuleEngine] = None
_recovery_dispatcher: Optional[RecoveryDispatcher] = None


def get_health_collector() -> HealthCollector:
    global _health_collector
    if _health_collector is None:
        _health_collector = HealthCollector()
    return _health_collector


def get_rule_engine() -> RuleEngine:
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = RuleEngine()
    return _rule_engine


def get_recovery_dispatcher() -> RecoveryDispatcher:
    global _recovery_dispatcher
    if _recovery_dispatcher is None:
        _recovery_dispatcher = RecoveryDispatcher()
    return _recovery_dispatcher


# === Request/Response Models ===

class NodeMetricsUpdate(BaseModel):
    """노드 메트릭 업데이트 요청"""
    node_id: str
    device_count: int = 0
    laixi_connected: bool = False
    unauthorized_count: int = 0
    uptime_sec: int = 0
    laixi_restarts: int = 0
    box_tcp_ok: bool = False


class NodeHealthResponse(BaseModel):
    """노드 건강 상태 응답"""
    node_id: str
    status: str
    tailscale_ip: Optional[str] = None
    device_count_adb: int = 0
    device_count_expected: int = 0
    device_loss_pct: float = 0.0
    adb_server_ok: bool = False
    unauthorized_count: int = 0
    heartbeat_age_sec: float = 0.0
    recovery_count_soft: int = 0
    recovery_count_restart: int = 0
    recovery_count_box: int = 0
    last_recovery_at: Optional[str] = None


class RecoveryRequest(BaseModel):
    """복구 실행 요청"""
    node_id: str
    action: str = Field(..., description="soft, restart, or box")
    dry_run: bool = False
    slot_number: Optional[int] = None  # box 복구 시 특정 슬롯


class RecoveryResponse(BaseModel):
    """복구 실행 응답"""
    node_id: str
    action: str
    status: str
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    error_message: Optional[str] = None
    duration_sec: float = 0.0


class BoxTestRequest(BaseModel):
    """박스 프로토콜 테스트 요청"""
    box_ip: str
    box_port: int = 56666
    test_command: str = "AA 01 88 84 01 00 DD"


class BoxCommandRequest(BaseModel):
    """박스 명령 실행 요청"""
    box_ip: str
    box_port: int = 56666
    command: str = Field(..., description="all_power_on, all_power_off, power_cycle, slot_power_on, slot_power_off")
    slot_number: Optional[int] = None


class EvaluationResponse(BaseModel):
    """노드 상태 평가 응답"""
    node_id: str
    failure_level: str
    recommended_action: str
    reasons: List[str]
    can_execute: bool
    cooldown_remaining_sec: Optional[int] = None


# === Health Endpoints ===

@router.post("/metrics", response_model=NodeHealthResponse)
async def update_node_metrics(update: NodeMetricsUpdate):
    """
    노드 메트릭 업데이트 (NodeRunner HEARTBEAT에서 호출)
    """
    collector = get_health_collector()
    node = await collector.update_node_metrics(
        node_id=update.node_id,
        metrics_data=update.model_dump()
    )
    
    return NodeHealthResponse(
        node_id=node.node_id,
        status=node.status.value,
        tailscale_ip=node.tailscale_ip,
        device_count_adb=node.metrics.device_count_adb,
        device_count_expected=node.metrics.device_count_expected,
        device_loss_pct=node.metrics.device_loss_pct,
        adb_server_ok=node.metrics.adb_server_ok,
        unauthorized_count=node.metrics.unauthorized_count,
        heartbeat_age_sec=node.metrics.node_heartbeat_age_sec,
        recovery_count_soft=node.recovery_count_soft,
        recovery_count_restart=node.recovery_count_restart,
        recovery_count_box=node.recovery_count_box,
        last_recovery_at=node.last_recovery_at.isoformat() if node.last_recovery_at else None
    )


@router.get("/nodes", response_model=List[NodeHealthResponse])
async def get_all_nodes():
    """모든 노드 건강 상태 조회"""
    collector = get_health_collector()
    nodes = collector.get_all_nodes()
    
    return [
        NodeHealthResponse(
            node_id=node.node_id,
            status=node.status.value,
            tailscale_ip=node.tailscale_ip,
            device_count_adb=node.metrics.device_count_adb,
            device_count_expected=node.metrics.device_count_expected,
            device_loss_pct=node.metrics.device_loss_pct,
            adb_server_ok=node.metrics.adb_server_ok,
            unauthorized_count=node.metrics.unauthorized_count,
            heartbeat_age_sec=node.metrics.node_heartbeat_age_sec,
            recovery_count_soft=node.recovery_count_soft,
            recovery_count_restart=node.recovery_count_restart,
            recovery_count_box=node.recovery_count_box,
            last_recovery_at=node.last_recovery_at.isoformat() if node.last_recovery_at else None
        )
        for node in nodes.values()
    ]


@router.get("/nodes/{node_id}", response_model=NodeHealthResponse)
async def get_node_health(node_id: str):
    """특정 노드 건강 상태 조회"""
    collector = get_health_collector()
    node = collector.get_node(node_id)
    
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    return NodeHealthResponse(
        node_id=node.node_id,
        status=node.status.value,
        tailscale_ip=node.tailscale_ip,
        device_count_adb=node.metrics.device_count_adb,
        device_count_expected=node.metrics.device_count_expected,
        device_loss_pct=node.metrics.device_loss_pct,
        adb_server_ok=node.metrics.adb_server_ok,
        unauthorized_count=node.metrics.unauthorized_count,
        heartbeat_age_sec=node.metrics.node_heartbeat_age_sec,
        recovery_count_soft=node.recovery_count_soft,
        recovery_count_restart=node.recovery_count_restart,
        recovery_count_box=node.recovery_count_box,
        last_recovery_at=node.last_recovery_at.isoformat() if node.last_recovery_at else None
    )


# === Evaluation Endpoints ===

@router.get("/evaluate/{node_id}", response_model=EvaluationResponse)
async def evaluate_node(node_id: str):
    """
    노드 상태 평가 및 복구 추천
    
    RuleEngine을 통해 threshold 판단 및 복구 액션 결정
    """
    collector = get_health_collector()
    rule_engine = get_rule_engine()
    
    node = collector.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    result = rule_engine.evaluate(node)
    
    return EvaluationResponse(
        node_id=result.node_id,
        failure_level=result.failure_level.value,
        recommended_action=result.recommended_action.value,
        reasons=result.reasons,
        can_execute=result.can_execute,
        cooldown_remaining_sec=result.cooldown_remaining_sec
    )


@router.get("/unhealthy", response_model=List[EvaluationResponse])
async def get_unhealthy_nodes():
    """비정상 노드 목록 및 평가 결과"""
    collector = get_health_collector()
    rule_engine = get_rule_engine()
    
    unhealthy = collector.get_unhealthy_nodes()
    
    return [
        EvaluationResponse(
            node_id=result.node_id,
            failure_level=result.failure_level.value,
            recommended_action=result.recommended_action.value,
            reasons=result.reasons,
            can_execute=result.can_execute,
            cooldown_remaining_sec=result.cooldown_remaining_sec
        )
        for node in unhealthy
        for result in [rule_engine.evaluate(node)]
    ]


# === Recovery Endpoints ===

@router.post("/recover", response_model=RecoveryResponse)
async def execute_recovery(
    request: RecoveryRequest,
    background_tasks: BackgroundTasks
):
    """
    복구 실행
    
    Actions:
    - soft: ADB/에이전트 재시작
    - restart: 서비스 전체 재시작
    - box: 박스 전원 제어 (최후 수단)
    """
    collector = get_health_collector()
    rule_engine = get_rule_engine()
    dispatcher = get_recovery_dispatcher()
    
    node = collector.get_node(request.node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {request.node_id} not found")
    
    if not node.tailscale_ip:
        raise HTTPException(
            status_code=400, 
            detail=f"Node {request.node_id} has no Tailscale IP configured"
        )
    
    # 액션 매핑
    action_map = {
        "soft": RecoveryAction.SOFT,
        "restart": RecoveryAction.RESTART,
        "box": RecoveryAction.BOX_RESET
    }
    action = action_map.get(request.action)
    if not action:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid action: {request.action}. Must be soft, restart, or box"
        )
    
    # 쿨다운 체크
    can_execute = await collector.can_execute_recovery(
        node_id=request.node_id,
        recovery_type=request.action,
        cooldown_minutes={
            "soft": 3,
            "restart": 15,
            "box": 30
        }.get(request.action, 3)
    )
    
    if not can_execute and not request.dry_run:
        raise HTTPException(
            status_code=429,
            detail=f"Recovery cooldown active for node {request.node_id}"
        )
    
    # 노드별 박스 IP 조회 (노드 설정에서 가져옴)
    box_ip = node.box_ip if hasattr(node, 'box_ip') and node.box_ip else None
    if action == RecoveryAction.BOX_RESET and not box_ip:
        raise HTTPException(
            status_code=400,
            detail=f"Box IP not configured for node {request.node_id}. Please set box_ip in node configuration."
        )
    
    # 복구 실행
    if action == RecoveryAction.BOX_RESET and request.slot_number is not None:
        # 박스 슬롯별 복구
        result = await dispatcher.execute_box_reset(
            node_id=request.node_id,
            box_ip=box_ip,
            box_port=56666,
            slot_number=request.slot_number
        )
    elif action == RecoveryAction.BOX_RESET:
        # 박스 전체 복구
        result = await dispatcher.execute_box_reset(
            node_id=request.node_id,
            box_ip=box_ip,
            box_port=56666
        )
    else:
        # SSH 복구 (soft/restart)
        result = await dispatcher.execute_recovery(
            node_id=request.node_id,
            tailscale_ip=node.tailscale_ip,
            action=action,
            dry_run=request.dry_run
        )
    
    # 복구 기록
    if not request.dry_run:
        await collector.record_recovery(request.node_id, request.action)
        rule_engine.record_recovery_attempt(request.node_id, action)
    
    return RecoveryResponse(
        node_id=result.node_id,
        action=result.action.value,
        status=result.status.value,
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        error_message=result.error_message,
        duration_sec=result.duration_sec
    )


@router.get("/recovery/history", response_model=List[RecoveryResponse])
async def get_recovery_history(node_id: Optional[str] = None, limit: int = 20):
    """복구 히스토리 조회"""
    dispatcher = get_recovery_dispatcher()
    history = dispatcher.get_history(node_id=node_id, limit=limit)
    
    return [
        RecoveryResponse(
            node_id=r.node_id,
            action=r.action.value,
            status=r.status.value,
            exit_code=r.exit_code,
            stdout=r.stdout,
            stderr=r.stderr,
            error_message=r.error_message,
            duration_sec=r.duration_sec
        )
        for r in history
    ]


# === Box Control Endpoints ===

@router.post("/box/test")
async def test_box_protocol(request: BoxTestRequest):
    """
    박스 프로토콜 테스트 (30분 안에 확정하기 위한 테스트)
    
    tcpdump 대신 Python으로 직접 테스트
    """
    result = await BoxClient.discover_protocol(
        host=request.box_ip,
        port=request.box_port,
        test_command=request.test_command
    )
    return result


@router.post("/box/command")
async def execute_box_command(request: BoxCommandRequest):
    """
    박스 명령 직접 실행
    
    Commands:
    - all_power_on: 전체 전원 ON
    - all_power_off: 전체 전원 OFF
    - power_cycle: 전체 전원 순환 (OFF -> 5초 -> ON)
    - slot_power_on: 특정 슬롯 전원 ON (slot_number 필요)
    - slot_power_off: 특정 슬롯 전원 OFF (slot_number 필요)
    """
    client = BoxClient(request.box_ip, request.box_port)
    
    success = False
    message = ""
    
    try:
        if request.command == "all_power_on":
            success = await client.power_on_all()
            message = "All power ON command sent"
        
        elif request.command == "all_power_off":
            success = await client.power_off_all()
            message = "All power OFF command sent"
        
        elif request.command == "power_cycle":
            success = await client.power_cycle_all()
            message = "Power cycle completed"
        
        elif request.command == "slot_power_on":
            if request.slot_number is None:
                raise HTTPException(status_code=400, detail="slot_number required")
            success = await client.slot_power_on(request.slot_number)
            message = f"Slot {request.slot_number} power ON command sent"
        
        elif request.command == "slot_power_off":
            if request.slot_number is None:
                raise HTTPException(status_code=400, detail="slot_number required")
            success = await client.slot_power_off(request.slot_number)
            message = f"Slot {request.slot_number} power OFF command sent"
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown command: {request.command}")
        
        return {
            "success": success,
            "command": request.command,
            "message": message,
            "box_ip": request.box_ip,
            "box_port": request.box_port
        }
        
    except Exception as e:
        logger.exception(f"Box command error: {request.command}")
        return {
            "success": False,
            "command": request.command,
            "error": str(e),
            "box_ip": request.box_ip,
            "box_port": request.box_port
        }


@router.get("/box/connection-test")
async def test_box_connection(box_ip: str, box_port: int = 56666):
    """박스 TCP 연결 테스트"""
    client = BoxClient(box_ip, box_port)
    connected = await client.test_connection()
    
    return {
        "connected": connected,
        "box_ip": box_ip,
        "box_port": box_port
    }

