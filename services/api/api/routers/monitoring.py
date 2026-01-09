"""
DoAi.Me 모니터링 라우터

엔드포인트:
- GET /metrics - Prometheus 메트릭 (텍스트)
- GET /api/monitoring/health - 상세 헬스체크
- GET /api/monitoring/summary - 시스템 요약
- GET /api/monitoring/alerts - 알림 목록
- POST /api/monitoring/alerts - 알림 전송
"""

import platform
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from loguru import logger
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel

from shared.monitoring import (
    ComponentHealth,
    HealthChecker,
    HealthStatus,
    check_disk,
    check_memory,
)
from shared.monitoring.metrics import (
    active_agents,
    agent_tasks_total,
    device_status,
    queue_size,
    system_info,
)

# =============================================================================
# Router 설정
# =============================================================================

router = APIRouter(tags=["Monitoring"])

# =============================================================================
# 전역 헬스체커 인스턴스
# =============================================================================

health_checker = HealthChecker()

# 기본 헬스체크 등록
health_checker.register("memory", check_memory)
health_checker.register("disk", check_disk)


# =============================================================================
# Pydantic 모델
# =============================================================================


class AlertRequest(BaseModel):
    """알림 전송 요청"""

    level: str = "info"  # info, warning, error, critical
    title: str
    message: str
    source: str = "api"
    metadata: Optional[Dict[str, Any]] = None


class AlertResponse(BaseModel):
    """알림 응답"""

    success: bool
    alert_id: Optional[str] = None
    message: str


class HealthDetail(BaseModel):
    """상세 헬스 정보"""

    component: str
    status: str
    message: Optional[str] = None
    latency_ms: float


class HealthResponse(BaseModel):
    """헬스체크 응답"""

    status: str
    timestamp: str
    uptime_seconds: float
    components: List[HealthDetail]


class SystemSummary(BaseModel):
    """시스템 요약"""

    api_version: str
    python_version: str
    platform: str
    timestamp: str
    uptime_seconds: float
    health_status: str
    active_nodes: int
    active_devices: int
    queue_depth: int


# =============================================================================
# 서버 시작 시간 기록
# =============================================================================

_server_start_time = time.time()


def _get_uptime() -> float:
    """서버 업타임 (초)"""
    return time.time() - _server_start_time


# =============================================================================
# 엔드포인트
# =============================================================================


@router.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics():
    """
    Prometheus 메트릭 엔드포인트

    Prometheus가 스크래핑하는 표준 /metrics 엔드포인트
    텍스트 포맷으로 모든 메트릭 반환
    """
    # 시스템 정보 업데이트
    system_info.info(
        {
            "version": "2.0.0",
            "environment": "production",
            "python_version": platform.python_version(),
            "platform": platform.system(),
        }
    )

    return PlainTextResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


@router.get("/api/monitoring/health", response_model=HealthResponse)
async def detailed_health():
    """
    상세 헬스체크

    모든 컴포넌트의 상세 건강 상태 반환
    - memory: 메모리 사용량
    - disk: 디스크 사용량
    - (추가 가능: supabase, laixi, etc.)
    """
    results = await health_checker.check_all()

    components = []
    for name, health in results.items():
        components.append(
            HealthDetail(
                component=name,
                status=health.status.value,
                message=health.message,
                latency_ms=health.latency_ms,
            )
        )

    # 전체 상태 결정
    overall_status = "healthy"
    for health in results.values():
        if health.status == HealthStatus.UNHEALTHY:
            overall_status = "unhealthy"
            break
        elif health.status == HealthStatus.DEGRADED and overall_status == "healthy":
            overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=_get_uptime(),
        components=components,
    )


@router.get("/api/monitoring/summary", response_model=SystemSummary)
async def system_summary():
    """
    시스템 요약 정보

    대시보드용 간략한 시스템 상태 요약
    """
    # 헬스체크 실행
    results = await health_checker.check_all()
    overall_status = "healthy"
    for health in results.values():
        if health.status == HealthStatus.UNHEALTHY:
            overall_status = "unhealthy"
            break
        elif health.status == HealthStatus.DEGRADED and overall_status == "healthy":
            overall_status = "degraded"

    # TODO: Supabase에서 실제 값 조회
    active_nodes = 0
    active_devices = 0
    queue_depth = 0

    try:
        # 메트릭에서 값 읽기 시도 (설정된 경우)
        pass
    except Exception:
        pass

    return SystemSummary(
        api_version="2.0.0",
        python_version=platform.python_version(),
        platform=f"{platform.system()} {platform.release()}",
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=_get_uptime(),
        health_status=overall_status,
        active_nodes=active_nodes,
        active_devices=active_devices,
        queue_depth=queue_depth,
    )


@router.get("/api/monitoring/alerts")
async def list_alerts(
    level: Optional[str] = Query(None, description="필터: info, warning, error, critical"),
    limit: int = Query(50, ge=1, le=200, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    알림 목록 조회

    최근 알림 내역 조회 (Supabase에서)
    """
    # TODO: Supabase monitoring_alerts 테이블에서 조회
    # 현재는 빈 목록 반환

    return {
        "alerts": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
        "message": "Alert history not yet implemented - requires monitoring_alerts table",
    }


@router.post("/api/monitoring/alerts", response_model=AlertResponse)
async def send_alert(request: AlertRequest):
    """
    알림 전송

    Slack/Discord로 알림 전송 및 기록
    """
    try:
        from shared.monitoring.runbook import AlertLevel, AlertManager

        # AlertLevel 매핑
        level_map = {
            "info": AlertLevel.INFO,
            "warning": AlertLevel.WARNING,
            "error": AlertLevel.ERROR,
            "critical": AlertLevel.CRITICAL,
        }

        alert_level = level_map.get(request.level.lower(), AlertLevel.INFO)

        # AlertManager 인스턴스 생성 (webhook URL은 환경변수에서)
        import os

        slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")

        if not slack_webhook and not discord_webhook:
            logger.warning("No webhook URLs configured for alerts")
            return AlertResponse(
                success=False,
                message="No webhook URLs configured. Set SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL",
            )

        manager = AlertManager(
            slack_webhook_url=slack_webhook,
            discord_webhook_url=discord_webhook,
        )

        # 알림 전송
        if slack_webhook:
            await manager.send_slack(
                level=alert_level,
                title=request.title,
                message=request.message,
                fields=request.metadata,
            )

        if discord_webhook:
            await manager.send_discord(
                level=alert_level,
                title=request.title,
                message=request.message,
                fields=request.metadata,
            )

        # TODO: Supabase에 알림 기록 저장

        logger.info(f"Alert sent: [{request.level}] {request.title}")

        return AlertResponse(
            success=True,
            message=f"Alert sent successfully via {'Slack and Discord' if slack_webhook and discord_webhook else 'Slack' if slack_webhook else 'Discord'}",
        )

    except Exception as e:
        logger.error(f"Failed to send alert: {e}")
        return AlertResponse(success=False, message=f"Failed to send alert: {str(e)}")


@router.get("/api/monitoring/network")
async def network_health():
    """
    네트워크 건강 상태

    VLAN, AP, DHCP 상태 요약
    """
    try:
        from shared.monitoring.network import NetworkHealthMonitor

        monitor = NetworkHealthMonitor()
        summary = monitor.get_health_summary()

        return {
            "status": summary["overall_status"],
            "vlans": summary.get("vlans", {}),
            "access_points": summary.get("access_points", {}),
            "dhcp": summary.get("dhcp", {}),
            "issues": summary.get("issues", []),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get network health: {e}")
        return {
            "status": "unknown",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
