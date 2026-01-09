"""
DoAi.Me 모니터링 라우터

엔드포인트:
- GET /metrics - Prometheus 메트릭 (텍스트)
- GET /api/monitoring/health - 상세 헬스체크
- GET /api/monitoring/summary - 시스템 요약
- GET /api/monitoring/alerts - 알림 목록
- POST /api/monitoring/alerts - 알림 전송
- GET /api/monitoring/logs - 로그 검색
- POST /api/monitoring/logs - 로그 저장
- GET /api/monitoring/logs/stats - 로그 통계
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
    get_log_collector,
    get_log_stats,
    search_logs,
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


async def _on_health_status_change(component, old_status, new_status):
    """
    헬스 상태 변경 시 콜백

    unhealthy/degraded로 변경될 때 알림 및 로그 기록
    """
    from shared.monitoring import HealthStatus

    # 상태가 악화된 경우에만 처리
    if new_status in (HealthStatus.UNHEALTHY, HealthStatus.DEGRADED):
        # 로그 기록
        collector = get_log_collector(source="api")
        level = "error" if new_status == HealthStatus.UNHEALTHY else "warning"

        await collector.log(
            level=level,
            source="api",
            message=f"Health check status changed: {component.name} -> {new_status.value}",
            component="health_checker",
            context={
                "component": component.name,
                "old_status": old_status.value if old_status else None,
                "new_status": new_status.value,
                "message": component.message,
                "details": component.details,
            },
        )

        # 자동 알림은 환경변수로 제어 (기본: 비활성화)
        import os

        if os.getenv("AUTO_ALERT_ON_UNHEALTHY", "false").lower() == "true":
            try:
                from shared.supabase_client import get_client

                client = get_client()
                client.table("monitoring_alerts").insert(
                    {
                        "level": level,
                        "title": f"Health Check Alert: {component.name}",
                        "message": f"Component '{component.name}' status changed to {new_status.value}. {component.message or ''}",
                        "source": "health_checker",
                        "metadata": {
                            "component": component.name,
                            "old_status": old_status.value if old_status else None,
                            "new_status": new_status.value,
                        },
                    }
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to create auto-alert: {e}")

    elif old_status in (HealthStatus.UNHEALTHY, HealthStatus.DEGRADED):
        # 복구된 경우 로그
        collector = get_log_collector(source="api")
        await collector.log(
            level="info",
            source="api",
            message=f"Health check recovered: {component.name} -> {new_status.value}",
            component="health_checker",
            context={
                "component": component.name,
                "old_status": old_status.value,
                "new_status": new_status.value,
            },
        )


health_checker = HealthChecker(on_status_change=_on_health_status_change)

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


class LogRequest(BaseModel):
    """로그 저장 요청"""

    level: str = "info"  # debug, info, warning, error, critical
    message: str
    source: str = "api"
    component: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    node_id: Optional[str] = None
    device_serial: Optional[str] = None
    request_id: Optional[str] = None


class LogResponse(BaseModel):
    """로그 응답"""

    success: bool
    message: str


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
    acknowledged: Optional[bool] = Query(None, description="확인 상태 필터"),
    limit: int = Query(50, ge=1, le=200, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    알림 목록 조회

    최근 알림 내역 조회 (Supabase에서)
    """
    try:
        from shared.supabase_client import get_client

        client = get_client()
        query = client.table("monitoring_alerts").select("*")

        if level:
            query = query.eq("level", level)
        if acknowledged is not None:
            query = query.eq("acknowledged", acknowledged)

        query = query.order("created_at", desc=True).limit(limit).offset(offset)

        result = query.execute()

        return {
            "alerts": result.data or [],
            "count": len(result.data or []),
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Failed to list alerts: {e}")
        return {
            "alerts": [],
            "count": 0,
            "error": str(e),
        }


@router.post("/api/monitoring/alerts", response_model=AlertResponse)
async def send_alert(request: AlertRequest):
    """
    알림 전송

    Slack/Discord로 알림 전송 및 Supabase에 기록
    """
    try:
        from shared.monitoring.runbook import AlertLevel, AlertManager
        from shared.supabase_client import get_client

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

        sent_to_slack = False
        sent_to_discord = False
        slack_response = None
        discord_response = None

        if slack_webhook or discord_webhook:
            manager = AlertManager(
                slack_webhook_url=slack_webhook,
                discord_webhook_url=discord_webhook,
            )

            # 알림 전송
            if slack_webhook:
                try:
                    await manager.send_slack(
                        level=alert_level,
                        title=request.title,
                        message=request.message,
                        fields=request.metadata,
                    )
                    sent_to_slack = True
                    slack_response = {"status": "sent"}
                except Exception as e:
                    slack_response = {"status": "failed", "error": str(e)}

            if discord_webhook:
                try:
                    await manager.send_discord(
                        level=alert_level,
                        title=request.title,
                        message=request.message,
                        fields=request.metadata,
                    )
                    sent_to_discord = True
                    discord_response = {"status": "sent"}
                except Exception as e:
                    discord_response = {"status": "failed", "error": str(e)}

        # Supabase에 알림 기록 저장
        alert_id = None
        try:
            client = get_client()
            result = (
                client.table("monitoring_alerts")
                .insert(
                    {
                        "level": request.level,
                        "title": request.title,
                        "message": request.message,
                        "source": request.source,
                        "metadata": request.metadata or {},
                        "sent_to_slack": sent_to_slack,
                        "sent_to_discord": sent_to_discord,
                        "slack_response": slack_response,
                        "discord_response": discord_response,
                    }
                )
                .execute()
            )

            if result.data and len(result.data) > 0:
                alert_id = result.data[0].get("id")
        except Exception as db_error:
            logger.warning(f"Failed to save alert to DB: {db_error}")

        logger.info(f"Alert sent: [{request.level}] {request.title}")

        channels = []
        if sent_to_slack:
            channels.append("Slack")
        if sent_to_discord:
            channels.append("Discord")

        return AlertResponse(
            success=True,
            alert_id=alert_id,
            message=f"Alert saved{' and sent via ' + ' and '.join(channels) if channels else ''}",
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


# =============================================================================
# 로그 엔드포인트 (M3)
# =============================================================================


@router.get("/api/monitoring/logs")
async def get_logs(
    level: Optional[str] = Query(None, description="필터: debug, info, warning, error, critical"),
    source: Optional[str] = Query(None, description="소스 필터: api, oob, laixi, node-runner"),
    search: Optional[str] = Query(None, description="메시지 검색어"),
    hours: int = Query(24, ge=1, le=168, description="조회 시간 범위 (시간)"),
    limit: int = Query(100, ge=1, le=500, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    로그 검색

    monitoring_logs 테이블에서 로그 조회
    """
    from datetime import timedelta

    try:
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        end_time = datetime.now(timezone.utc)

        logs = await search_logs(
            level=level,
            source=source,
            start_time=start_time,
            end_time=end_time,
            search_text=search,
            limit=limit,
            offset=offset,
        )

        return {
            "logs": logs,
            "count": len(logs),
            "limit": limit,
            "offset": offset,
            "filters": {
                "level": level,
                "source": source,
                "search": search,
                "hours": hours,
            },
        }

    except Exception as e:
        logger.error(f"Failed to search logs: {e}")
        return {
            "logs": [],
            "count": 0,
            "error": str(e),
        }


@router.post("/api/monitoring/logs", response_model=LogResponse)
async def create_log(request: LogRequest):
    """
    로그 저장

    monitoring_logs 테이블에 로그 저장
    """
    try:
        collector = get_log_collector(source=request.source)

        await collector.log(
            level=request.level,
            source=request.source,
            message=request.message,
            component=request.component,
            context=request.context,
            node_id=request.node_id,
            device_serial=request.device_serial,
            request_id=request.request_id,
        )

        return LogResponse(
            success=True,
            message=f"Log [{request.level}] saved successfully",
        )

    except Exception as e:
        logger.error(f"Failed to save log: {e}")
        return LogResponse(
            success=False,
            message=f"Failed to save log: {str(e)}",
        )


@router.get("/api/monitoring/logs/stats")
async def get_logs_stats(
    hours: int = Query(24, ge=1, le=168, description="조회 시간 범위 (시간)"),
):
    """
    로그 통계

    시간 범위 내 레벨별 로그 수 반환
    """
    try:
        stats = await get_log_stats(hours=hours)

        return {
            "stats": stats,
            "hours": hours,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get log stats: {e}")
        return {
            "stats": {},
            "error": str(e),
        }
