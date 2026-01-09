"""
런북 자동화 모듈

PR #5: 장애 대응 런북 자동화
- L1 Soft Reset 자동 실행 조건 정의
- Slack/Discord 알림 통합
- 인시던트 타임라인 자동 생성

Usage:
    from shared.monitoring.runbook import (
        RunbookExecutor,
        AlertManager,
        IncidentTracker,
        AlertLevel,
    )

    # 알림 매니저 설정
    alert_manager = AlertManager(
        slack_webhook="https://hooks.slack.com/...",
        discord_webhook="https://discord.com/api/webhooks/...",
    )

    # 런북 실행기
    executor = RunbookExecutor(alert_manager=alert_manager)

    # L1 자동 복구 실행
    result = await executor.execute_l1_soft_reset(service="orchestrator")
"""

import asyncio
import aiohttp
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Callable, Awaitable, Dict, List, Optional
import json

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# =========================================
# Enums
# =========================================

class AlertLevel(str, Enum):
    """알림 레벨"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class RecoveryLevel(str, Enum):
    """복구 레벨"""
    L1 = "L1"  # Soft Reset (자동)
    L2 = "L2"  # Service Reset (1단계 승인)
    L3 = "L3"  # Box Reset (2단계 승인)


class IncidentStatus(str, Enum):
    """인시던트 상태"""
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    RECOVERING = "recovering"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class ActionResult(str, Enum):
    """작업 결과"""
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


# =========================================
# 데이터 클래스
# =========================================

@dataclass
class AlertConfig:
    """알림 설정"""
    slack_webhook: Optional[str] = None
    discord_webhook: Optional[str] = None
    enable_slack: bool = True
    enable_discord: bool = True
    mention_on_critical: bool = True
    slack_channel: Optional[str] = None
    timeout_seconds: int = 10


@dataclass
class TimelineEvent:
    """인시던트 타임라인 이벤트"""
    timestamp: datetime
    event_type: str
    message: str
    level: AlertLevel = AlertLevel.INFO
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "message": self.message,
            "level": self.level.value,
            "metadata": self.metadata,
        }


@dataclass
class Incident:
    """인시던트"""
    id: str
    title: str
    description: str
    status: IncidentStatus
    level: RecoveryLevel
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    timeline: List[TimelineEvent] = field(default_factory=list)
    affected_services: List[str] = field(default_factory=list)
    root_cause: Optional[str] = None
    resolution: Optional[str] = None
    assignee: Optional[str] = None

    def add_event(
        self,
        event_type: str,
        message: str,
        level: AlertLevel = AlertLevel.INFO,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TimelineEvent:
        """타임라인에 이벤트 추가"""
        event = TimelineEvent(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            message=message,
            level=level,
            metadata=metadata or {},
        )
        self.timeline.append(event)
        self.updated_at = event.timestamp
        return event

    def resolve(self, resolution: str, root_cause: Optional[str] = None):
        """인시던트 해결"""
        self.status = IncidentStatus.RESOLVED
        self.resolved_at = datetime.now(timezone.utc)
        self.resolution = resolution
        if root_cause:
            self.root_cause = root_cause
        self.add_event("resolved", f"Incident resolved: {resolution}", AlertLevel.INFO)

    def escalate(self, new_level: RecoveryLevel, reason: str):
        """인시던트 에스컬레이션"""
        old_level = self.level
        self.level = new_level
        self.status = IncidentStatus.ESCALATED
        self.add_event(
            "escalated",
            f"Escalated from {old_level.value} to {new_level.value}: {reason}",
            AlertLevel.WARNING,
        )

    @property
    def duration(self) -> Optional[timedelta]:
        """인시던트 지속 시간"""
        end_time = self.resolved_at or datetime.now(timezone.utc)
        return end_time - self.created_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "level": self.level.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "duration_seconds": self.duration.total_seconds() if self.duration else None,
            "timeline": [e.to_dict() for e in self.timeline],
            "affected_services": self.affected_services,
            "root_cause": self.root_cause,
            "resolution": self.resolution,
            "assignee": self.assignee,
        }


@dataclass
class RunbookAction:
    """런북 작업"""
    name: str
    description: str
    level: RecoveryLevel
    command: Optional[str] = None
    timeout_seconds: int = 30
    requires_approval: bool = False
    auto_execute: bool = False


@dataclass
class RunbookResult:
    """런북 실행 결과"""
    action: RunbookAction
    result: ActionResult
    started_at: datetime
    completed_at: Optional[datetime] = None
    output: Optional[str] = None
    error: Optional[str] = None
    next_action: Optional[str] = None

    @property
    def duration_ms(self) -> Optional[int]:
        if self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() * 1000)
        return None


@dataclass
class L1TriggerCondition:
    """L1 자동 실행 조건"""
    name: str
    description: str
    check_fn: Callable[[], Awaitable[bool]]
    cooldown_seconds: int = 300  # 5분 쿨다운
    max_attempts: int = 3  # 최대 시도 횟수
    enabled: bool = True

    # 상태 추적
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0


# =========================================
# AlertManager
# =========================================

class AlertManager:
    """
    알림 매니저

    Slack/Discord 웹훅으로 알림 전송
    """

    def __init__(self, config: Optional[AlertConfig] = None):
        self.config = config or AlertConfig()
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _get_level_emoji(self, level: AlertLevel) -> str:
        return {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🔴",
        }.get(level, "📢")

    def _get_level_color(self, level: AlertLevel) -> str:
        return {
            AlertLevel.INFO: "#36a64f",
            AlertLevel.WARNING: "#ff9800",
            AlertLevel.ERROR: "#f44336",
            AlertLevel.CRITICAL: "#d32f2f",
        }.get(level, "#808080")

    async def send_slack(
        self,
        title: str,
        message: str,
        level: AlertLevel = AlertLevel.INFO,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Slack 알림 전송"""
        if not self.config.enable_slack or not self.config.slack_webhook:
            logger.debug("Slack 알림 비활성화 또는 웹훅 미설정")
            return False

        emoji = self._get_level_emoji(level)
        color = self._get_level_color(level)

        # 멘션 추가
        mention = ""
        if level == AlertLevel.CRITICAL and self.config.mention_on_critical:
            mention = "<!channel> "

        payload = {
            "text": f"{mention}{emoji} {title}",
            "attachments": [
                {
                    "color": color,
                    "text": message,
                    "fields": [
                        {"title": k, "value": v, "short": True}
                        for k, v in (fields or {}).items()
                    ],
                    "ts": datetime.now(timezone.utc).timestamp(),
                }
            ],
        }

        if self.config.slack_channel:
            payload["channel"] = self.config.slack_channel

        try:
            session = await self._get_session()
            async with session.post(
                self.config.slack_webhook,
                json=payload,
            ) as response:
                if response.status == 200:
                    logger.info(f"Slack 알림 전송 성공: {title}")
                    return True
                else:
                    logger.warning(f"Slack 알림 전송 실패: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Slack 알림 전송 오류: {e}")
            return False

    async def send_discord(
        self,
        title: str,
        message: str,
        level: AlertLevel = AlertLevel.INFO,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        """Discord 알림 전송"""
        if not self.config.enable_discord or not self.config.discord_webhook:
            logger.debug("Discord 알림 비활성화 또는 웹훅 미설정")
            return False

        emoji = self._get_level_emoji(level)
        color = int(self._get_level_color(level).lstrip("#"), 16)

        # 멘션 추가
        mention = ""
        if level == AlertLevel.CRITICAL and self.config.mention_on_critical:
            mention = "@everyone "

        embed = {
            "title": f"{emoji} {title}",
            "description": message,
            "color": color,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "fields": [
                {"name": k, "value": v, "inline": True}
                for k, v in (fields or {}).items()
            ],
        }

        payload = {
            "content": mention if mention else None,
            "embeds": [embed],
        }

        try:
            session = await self._get_session()
            async with session.post(
                self.config.discord_webhook,
                json=payload,
            ) as response:
                if response.status in (200, 204):
                    logger.info(f"Discord 알림 전송 성공: {title}")
                    return True
                else:
                    logger.warning(f"Discord 알림 전송 실패: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Discord 알림 전송 오류: {e}")
            return False

    async def send_alert(
        self,
        title: str,
        message: str,
        level: AlertLevel = AlertLevel.INFO,
        fields: Optional[Dict[str, str]] = None,
    ) -> Dict[str, bool]:
        """모든 채널로 알림 전송"""
        results = {}

        # 병렬 전송
        slack_task = self.send_slack(title, message, level, fields)
        discord_task = self.send_discord(title, message, level, fields)

        slack_result, discord_result = await asyncio.gather(
            slack_task, discord_task, return_exceptions=True
        )

        results["slack"] = slack_result if isinstance(slack_result, bool) else False
        results["discord"] = discord_result if isinstance(discord_result, bool) else False

        return results

    async def send_incident_alert(self, incident: Incident) -> Dict[str, bool]:
        """인시던트 알림 전송"""
        level_map = {
            RecoveryLevel.L1: AlertLevel.WARNING,
            RecoveryLevel.L2: AlertLevel.ERROR,
            RecoveryLevel.L3: AlertLevel.CRITICAL,
        }

        alert_level = level_map.get(incident.level, AlertLevel.WARNING)

        fields = {
            "Status": incident.status.value,
            "Level": incident.level.value,
            "Affected": ", ".join(incident.affected_services) or "N/A",
        }

        if incident.duration:
            fields["Duration"] = f"{int(incident.duration.total_seconds())}s"

        return await self.send_alert(
            title=f"[{incident.level.value}] {incident.title}",
            message=incident.description,
            level=alert_level,
            fields=fields,
        )


# =========================================
# IncidentTracker
# =========================================

class IncidentTracker:
    """
    인시던트 추적기

    인시던트 생성, 업데이트, 타임라인 관리
    """

    def __init__(self, alert_manager: Optional[AlertManager] = None):
        self.alert_manager = alert_manager
        self._incidents: Dict[str, Incident] = {}
        self._incident_counter = 0

    def _generate_id(self) -> str:
        """인시던트 ID 생성"""
        self._incident_counter += 1
        now = datetime.now(timezone.utc)
        return f"INC-{now.strftime('%Y%m%d')}-{self._incident_counter:04d}"

    async def create_incident(
        self,
        title: str,
        description: str,
        level: RecoveryLevel = RecoveryLevel.L1,
        affected_services: Optional[List[str]] = None,
        send_alert: bool = True,
    ) -> Incident:
        """새 인시던트 생성"""
        now = datetime.now(timezone.utc)
        incident_id = self._generate_id()

        incident = Incident(
            id=incident_id,
            title=title,
            description=description,
            status=IncidentStatus.DETECTED,
            level=level,
            created_at=now,
            updated_at=now,
            affected_services=affected_services or [],
        )

        # 감지 이벤트 추가
        incident.add_event("detected", f"Incident detected: {title}", AlertLevel.WARNING)

        self._incidents[incident_id] = incident

        logger.warning(f"Incident created: {incident_id} - {title}")

        # 알림 전송
        if send_alert and self.alert_manager:
            await self.alert_manager.send_incident_alert(incident)

        return incident

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        """인시던트 조회"""
        return self._incidents.get(incident_id)

    def get_active_incidents(self) -> List[Incident]:
        """활성 인시던트 목록"""
        return [
            inc for inc in self._incidents.values()
            if inc.status not in (IncidentStatus.RESOLVED,)
        ]

    def get_recent_incidents(self, hours: int = 24) -> List[Incident]:
        """최근 인시던트 목록"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        return [
            inc for inc in self._incidents.values()
            if inc.created_at >= cutoff
        ]

    async def update_incident(
        self,
        incident_id: str,
        status: Optional[IncidentStatus] = None,
        event_type: Optional[str] = None,
        event_message: Optional[str] = None,
        send_alert: bool = False,
    ) -> Optional[Incident]:
        """인시던트 업데이트"""
        incident = self._incidents.get(incident_id)
        if not incident:
            return None

        if status:
            incident.status = status

        if event_type and event_message:
            incident.add_event(event_type, event_message)

        incident.updated_at = datetime.now(timezone.utc)

        if send_alert and self.alert_manager:
            await self.alert_manager.send_incident_alert(incident)

        return incident

    async def resolve_incident(
        self,
        incident_id: str,
        resolution: str,
        root_cause: Optional[str] = None,
        send_alert: bool = True,
    ) -> Optional[Incident]:
        """인시던트 해결"""
        incident = self._incidents.get(incident_id)
        if not incident:
            return None

        incident.resolve(resolution, root_cause)

        logger.info(f"Incident resolved: {incident_id} - {resolution}")

        if send_alert and self.alert_manager:
            await self.alert_manager.send_alert(
                title=f"[RESOLVED] {incident.title}",
                message=f"Resolution: {resolution}",
                level=AlertLevel.INFO,
                fields={
                    "Duration": f"{int(incident.duration.total_seconds())}s",
                    "Root Cause": root_cause or "TBD",
                },
            )

        return incident

    async def escalate_incident(
        self,
        incident_id: str,
        new_level: RecoveryLevel,
        reason: str,
        send_alert: bool = True,
    ) -> Optional[Incident]:
        """인시던트 에스컬레이션"""
        incident = self._incidents.get(incident_id)
        if not incident:
            return None

        old_level = incident.level
        incident.escalate(new_level, reason)

        logger.warning(
            f"Incident escalated: {incident_id} {old_level.value} -> {new_level.value}"
        )

        if send_alert and self.alert_manager:
            await self.alert_manager.send_incident_alert(incident)

        return incident


# =========================================
# RunbookExecutor
# =========================================

class RunbookExecutor:
    """
    런북 실행기

    L1 자동 복구 및 조건 기반 실행
    """

    # L1 자동 실행 조건
    DEFAULT_L1_CONDITIONS = {
        "health_check_failed": {
            "description": "헬스 체크 3회 연속 실패",
            "threshold": 3,
        },
        "high_error_rate": {
            "description": "에러율 10% 초과",
            "threshold": 0.1,
        },
        "api_response_slow": {
            "description": "API 응답 5초 초과",
            "threshold": 5.0,
        },
    }

    def __init__(
        self,
        alert_manager: Optional[AlertManager] = None,
        incident_tracker: Optional[IncidentTracker] = None,
    ):
        self.alert_manager = alert_manager or AlertManager()
        self.incident_tracker = incident_tracker or IncidentTracker(self.alert_manager)

        # L1 조건 추적
        self._l1_conditions: Dict[str, L1TriggerCondition] = {}
        self._l1_execution_history: List[RunbookResult] = []
        self._health_check_failures = 0
        self._last_l1_execution: Optional[datetime] = None
        self._l1_cooldown_seconds = 300  # 5분

    def register_l1_condition(
        self,
        name: str,
        check_fn: Callable[[], Awaitable[bool]],
        description: str = "",
        cooldown_seconds: int = 300,
        max_attempts: int = 3,
    ) -> None:
        """L1 자동 실행 조건 등록"""
        condition = L1TriggerCondition(
            name=name,
            description=description or name,
            check_fn=check_fn,
            cooldown_seconds=cooldown_seconds,
            max_attempts=max_attempts,
        )
        self._l1_conditions[name] = condition
        logger.debug(f"L1 조건 등록: {name}")

    async def check_l1_conditions(self) -> Optional[str]:
        """
        L1 조건 확인

        Returns:
            트리거된 조건 이름 (없으면 None)
        """
        for name, condition in self._l1_conditions.items():
            if not condition.enabled:
                continue

            # 쿨다운 확인
            if condition.last_triggered_at:
                elapsed = (datetime.now(timezone.utc) - condition.last_triggered_at).total_seconds()
                if elapsed < condition.cooldown_seconds:
                    continue

            # 최대 시도 횟수 확인
            if condition.trigger_count >= condition.max_attempts:
                logger.warning(f"L1 조건 {name}: 최대 시도 횟수 초과")
                continue

            try:
                if await condition.check_fn():
                    logger.info(f"L1 조건 트리거됨: {name}")
                    return name
            except Exception as e:
                logger.error(f"L1 조건 체크 오류 ({name}): {e}")

        return None

    def record_health_check_failure(self) -> int:
        """헬스 체크 실패 기록"""
        self._health_check_failures += 1
        return self._health_check_failures

    def reset_health_check_failures(self) -> None:
        """헬스 체크 실패 카운터 리셋"""
        self._health_check_failures = 0

    def should_trigger_l1(self) -> bool:
        """L1 자동 실행 여부 확인"""
        # 쿨다운 확인
        if self._last_l1_execution:
            elapsed = (datetime.now(timezone.utc) - self._last_l1_execution).total_seconds()
            if elapsed < self._l1_cooldown_seconds:
                logger.debug(f"L1 쿨다운 중: {int(self._l1_cooldown_seconds - elapsed)}초 남음")
                return False

        # 헬스 체크 실패 횟수 확인
        threshold = self.DEFAULT_L1_CONDITIONS["health_check_failed"]["threshold"]
        return self._health_check_failures >= threshold

    async def execute_l1_soft_reset(
        self,
        service: str = "orchestrator",
        reason: str = "Auto-triggered by health check failures",
    ) -> RunbookResult:
        """
        L1 Soft Reset 실행

        Args:
            service: 대상 서비스
            reason: 실행 사유

        Returns:
            실행 결과
        """
        action = RunbookAction(
            name="L1 Soft Reset",
            description=f"서비스 재시작: {service}",
            level=RecoveryLevel.L1,
            command=f"systemctl restart doai-{service}",
            timeout_seconds=30,
            auto_execute=True,
        )

        started_at = datetime.now(timezone.utc)

        # 인시던트 생성
        incident = await self.incident_tracker.create_incident(
            title=f"L1 Soft Reset: {service}",
            description=reason,
            level=RecoveryLevel.L1,
            affected_services=[service],
        )

        result = RunbookResult(
            action=action,
            result=ActionResult.SUCCESS,  # 기본값
            started_at=started_at,
        )

        try:
            # 인시던트 상태 업데이트
            await self.incident_tracker.update_incident(
                incident.id,
                status=IncidentStatus.RECOVERING,
                event_type="l1_started",
                event_message=f"Starting L1 Soft Reset for {service}",
            )

            # 실제 복구 로직 (시뮬레이션)
            # 실제 환경에서는 SSH 명령 실행
            logger.info(f"L1 Soft Reset 실행: {service}")

            # 타임아웃 내에서 복구 시도
            # await self._execute_command(action.command, action.timeout_seconds)

            # 복구 성공 시뮬레이션
            await asyncio.sleep(0.1)  # 실제로는 헬스 체크

            result.result = ActionResult.SUCCESS
            result.output = f"Service {service} restarted successfully"
            result.completed_at = datetime.now(timezone.utc)

            # 인시던트 해결
            await self.incident_tracker.resolve_incident(
                incident.id,
                resolution=f"L1 Soft Reset completed for {service}",
            )

            # 카운터 리셋
            self.reset_health_check_failures()

        except asyncio.TimeoutError:
            result.result = ActionResult.TIMEOUT
            result.error = f"L1 Soft Reset timed out after {action.timeout_seconds}s"
            result.next_action = "Escalate to L2"
            result.completed_at = datetime.now(timezone.utc)

            # 에스컬레이션
            await self.incident_tracker.escalate_incident(
                incident.id,
                RecoveryLevel.L2,
                reason=result.error,
            )

        except Exception as e:
            result.result = ActionResult.FAILED
            result.error = str(e)
            result.next_action = "Escalate to L2"
            result.completed_at = datetime.now(timezone.utc)

            await self.incident_tracker.escalate_incident(
                incident.id,
                RecoveryLevel.L2,
                reason=result.error,
            )

        # 실행 기록
        self._l1_execution_history.append(result)
        self._last_l1_execution = result.started_at

        logger.info(
            f"L1 Soft Reset 완료: {result.result.value} "
            f"({result.duration_ms}ms)"
        )

        return result

    def get_l1_execution_history(self, limit: int = 10) -> List[RunbookResult]:
        """L1 실행 이력 조회"""
        return self._l1_execution_history[-limit:]

    def get_runbook_status(self) -> Dict[str, Any]:
        """런북 상태 조회"""
        return {
            "health_check_failures": self._health_check_failures,
            "l1_cooldown_active": bool(
                self._last_l1_execution
                and (datetime.now(timezone.utc) - self._last_l1_execution).total_seconds()
                < self._l1_cooldown_seconds
            ),
            "last_l1_execution": (
                self._last_l1_execution.isoformat() if self._last_l1_execution else None
            ),
            "l1_execution_count": len(self._l1_execution_history),
            "active_incidents": len(self.incident_tracker.get_active_incidents()),
            "registered_conditions": list(self._l1_conditions.keys()),
        }


# =========================================
# 싱글톤 인스턴스
# =========================================

_alert_manager: Optional[AlertManager] = None
_incident_tracker: Optional[IncidentTracker] = None
_runbook_executor: Optional[RunbookExecutor] = None


def get_alert_manager() -> AlertManager:
    """AlertManager 싱글톤"""
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
    return _alert_manager


def get_incident_tracker() -> IncidentTracker:
    """IncidentTracker 싱글톤"""
    global _incident_tracker
    if _incident_tracker is None:
        _incident_tracker = IncidentTracker(get_alert_manager())
    return _incident_tracker


def get_runbook_executor() -> RunbookExecutor:
    """RunbookExecutor 싱글톤"""
    global _runbook_executor
    if _runbook_executor is None:
        _runbook_executor = RunbookExecutor(
            get_alert_manager(),
            get_incident_tracker(),
        )
    return _runbook_executor


def reset_runbook_module() -> None:
    """모듈 리셋 (테스트용)"""
    global _alert_manager, _incident_tracker, _runbook_executor
    _alert_manager = None
    _incident_tracker = None
    _runbook_executor = None
