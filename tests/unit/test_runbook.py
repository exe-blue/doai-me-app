"""
런북 자동화 단위 테스트

PR #5: 장애 대응 런북 자동화
- AlertManager 테스트
- IncidentTracker 테스트
- RunbookExecutor 테스트
- L1 자동 실행 조건 테스트
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

# 테스트 대상 임포트
from shared.monitoring.runbook import (
    # Enums
    AlertLevel,
    RecoveryLevel,
    IncidentStatus,
    ActionResult,
    # Dataclasses
    AlertConfig,
    TimelineEvent,
    Incident,
    RunbookAction,
    RunbookResult,
    L1TriggerCondition,
    # Classes
    AlertManager,
    IncidentTracker,
    RunbookExecutor,
    # Singletons
    get_alert_manager,
    get_incident_tracker,
    get_runbook_executor,
    reset_runbook_module,
)


# =========================================
# Enum 테스트
# =========================================

class TestAlertLevel:
    """AlertLevel Enum 테스트"""

    def test_alert_levels(self):
        """알림 레벨 값 확인"""
        assert AlertLevel.INFO.value == "info"
        assert AlertLevel.WARNING.value == "warning"
        assert AlertLevel.ERROR.value == "error"
        assert AlertLevel.CRITICAL.value == "critical"


class TestRecoveryLevel:
    """RecoveryLevel Enum 테스트"""

    def test_recovery_levels(self):
        """복구 레벨 값 확인"""
        assert RecoveryLevel.L1.value == "L1"
        assert RecoveryLevel.L2.value == "L2"
        assert RecoveryLevel.L3.value == "L3"


class TestIncidentStatus:
    """IncidentStatus Enum 테스트"""

    def test_incident_statuses(self):
        """인시던트 상태 값 확인"""
        assert IncidentStatus.DETECTED.value == "detected"
        assert IncidentStatus.INVESTIGATING.value == "investigating"
        assert IncidentStatus.RECOVERING.value == "recovering"
        assert IncidentStatus.RESOLVED.value == "resolved"
        assert IncidentStatus.ESCALATED.value == "escalated"


class TestActionResult:
    """ActionResult Enum 테스트"""

    def test_action_results(self):
        """작업 결과 값 확인"""
        assert ActionResult.SUCCESS.value == "success"
        assert ActionResult.FAILED.value == "failed"
        assert ActionResult.TIMEOUT.value == "timeout"
        assert ActionResult.SKIPPED.value == "skipped"


# =========================================
# AlertConfig 테스트
# =========================================

class TestAlertConfig:
    """AlertConfig 데이터클래스 테스트"""

    def test_default_values(self):
        """기본값 확인"""
        config = AlertConfig()

        assert config.slack_webhook is None
        assert config.discord_webhook is None
        assert config.enable_slack is True
        assert config.enable_discord is True
        assert config.mention_on_critical is True
        assert config.timeout_seconds == 10

    def test_custom_values(self):
        """커스텀 값 설정"""
        config = AlertConfig(
            slack_webhook="https://hooks.slack.com/test",
            discord_webhook="https://discord.com/test",
            enable_slack=False,
            timeout_seconds=30,
        )

        assert config.slack_webhook == "https://hooks.slack.com/test"
        assert config.discord_webhook == "https://discord.com/test"
        assert config.enable_slack is False
        assert config.timeout_seconds == 30


# =========================================
# TimelineEvent 테스트
# =========================================

class TestTimelineEvent:
    """TimelineEvent 데이터클래스 테스트"""

    def test_create_event(self):
        """이벤트 생성"""
        now = datetime.now(timezone.utc)
        event = TimelineEvent(
            timestamp=now,
            event_type="test_event",
            message="Test message",
        )

        assert event.timestamp == now
        assert event.event_type == "test_event"
        assert event.message == "Test message"
        assert event.level == AlertLevel.INFO
        assert event.metadata == {}

    def test_to_dict(self):
        """딕셔너리 변환"""
        now = datetime.now(timezone.utc)
        event = TimelineEvent(
            timestamp=now,
            event_type="test",
            message="Test",
            level=AlertLevel.WARNING,
            metadata={"key": "value"},
        )

        result = event.to_dict()

        assert "timestamp" in result
        assert result["event_type"] == "test"
        assert result["message"] == "Test"
        assert result["level"] == "warning"
        assert result["metadata"] == {"key": "value"}


# =========================================
# Incident 테스트
# =========================================

class TestIncident:
    """Incident 데이터클래스 테스트"""

    def test_create_incident(self):
        """인시던트 생성"""
        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test Incident",
            description="Test description",
            status=IncidentStatus.DETECTED,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
        )

        assert incident.id == "INC-001"
        assert incident.title == "Test Incident"
        assert incident.status == IncidentStatus.DETECTED
        assert incident.level == RecoveryLevel.L1

    def test_add_event(self):
        """타임라인 이벤트 추가"""
        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test",
            description="Test",
            status=IncidentStatus.DETECTED,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
        )

        event = incident.add_event("test_event", "Test message", AlertLevel.WARNING)

        assert len(incident.timeline) == 1
        assert incident.timeline[0] == event
        assert event.event_type == "test_event"
        assert event.level == AlertLevel.WARNING

    def test_resolve(self):
        """인시던트 해결"""
        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test",
            description="Test",
            status=IncidentStatus.RECOVERING,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
        )

        incident.resolve("Fixed the issue", "Root cause found")

        assert incident.status == IncidentStatus.RESOLVED
        assert incident.resolved_at is not None
        assert incident.resolution == "Fixed the issue"
        assert incident.root_cause == "Root cause found"
        assert len(incident.timeline) == 1

    def test_escalate(self):
        """인시던트 에스컬레이션"""
        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test",
            description="Test",
            status=IncidentStatus.RECOVERING,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
        )

        incident.escalate(RecoveryLevel.L2, "L1 failed")

        assert incident.status == IncidentStatus.ESCALATED
        assert incident.level == RecoveryLevel.L2
        assert len(incident.timeline) == 1
        assert "L1" in incident.timeline[0].message
        assert "L2" in incident.timeline[0].message

    def test_duration(self):
        """인시던트 지속 시간"""
        created = datetime.now(timezone.utc) - timedelta(hours=1)
        resolved = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test",
            description="Test",
            status=IncidentStatus.RESOLVED,
            level=RecoveryLevel.L1,
            created_at=created,
            updated_at=resolved,
            resolved_at=resolved,
        )

        duration = incident.duration

        assert duration is not None
        # 약 1시간
        assert 3500 < duration.total_seconds() < 3700

    def test_to_dict(self):
        """딕셔너리 변환"""
        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test",
            description="Test",
            status=IncidentStatus.DETECTED,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
            affected_services=["api", "worker"],
        )

        result = incident.to_dict()

        assert result["id"] == "INC-001"
        assert result["status"] == "detected"
        assert result["level"] == "L1"
        assert result["affected_services"] == ["api", "worker"]


# =========================================
# RunbookAction 테스트
# =========================================

class TestRunbookAction:
    """RunbookAction 데이터클래스 테스트"""

    def test_create_action(self):
        """작업 생성"""
        action = RunbookAction(
            name="Test Action",
            description="Test description",
            level=RecoveryLevel.L1,
            command="systemctl restart test",
            timeout_seconds=60,
        )

        assert action.name == "Test Action"
        assert action.level == RecoveryLevel.L1
        assert action.command == "systemctl restart test"
        assert action.timeout_seconds == 60
        assert action.requires_approval is False
        assert action.auto_execute is False


class TestRunbookResult:
    """RunbookResult 데이터클래스 테스트"""

    def test_create_result(self):
        """결과 생성"""
        action = RunbookAction(
            name="Test",
            description="Test",
            level=RecoveryLevel.L1,
        )
        started = datetime.now(timezone.utc)

        result = RunbookResult(
            action=action,
            result=ActionResult.SUCCESS,
            started_at=started,
        )

        assert result.action == action
        assert result.result == ActionResult.SUCCESS

    def test_duration_ms(self):
        """실행 시간 계산"""
        action = RunbookAction(
            name="Test",
            description="Test",
            level=RecoveryLevel.L1,
        )
        started = datetime.now(timezone.utc)
        completed = started + timedelta(seconds=1.5)

        result = RunbookResult(
            action=action,
            result=ActionResult.SUCCESS,
            started_at=started,
            completed_at=completed,
        )

        assert result.duration_ms == 1500


# =========================================
# AlertManager 테스트
# =========================================

class TestAlertManager:
    """AlertManager 클래스 테스트"""

    def test_init_default(self):
        """기본 초기화"""
        manager = AlertManager()

        assert manager.config is not None
        assert manager._session is None

    def test_init_with_config(self):
        """설정으로 초기화"""
        config = AlertConfig(
            slack_webhook="https://hooks.slack.com/test"
        )
        manager = AlertManager(config=config)

        assert manager.config.slack_webhook == "https://hooks.slack.com/test"

    def test_get_level_emoji(self):
        """레벨별 이모지"""
        manager = AlertManager()

        assert manager._get_level_emoji(AlertLevel.INFO) == "ℹ️"
        assert manager._get_level_emoji(AlertLevel.WARNING) == "⚠️"
        assert manager._get_level_emoji(AlertLevel.ERROR) == "❌"
        assert manager._get_level_emoji(AlertLevel.CRITICAL) == "🔴"

    def test_get_level_color(self):
        """레벨별 색상"""
        manager = AlertManager()

        assert manager._get_level_color(AlertLevel.INFO) == "#36a64f"
        assert manager._get_level_color(AlertLevel.WARNING) == "#ff9800"
        assert manager._get_level_color(AlertLevel.ERROR) == "#f44336"
        assert manager._get_level_color(AlertLevel.CRITICAL) == "#d32f2f"

    @pytest.mark.asyncio
    async def test_send_slack_disabled(self):
        """Slack 비활성화 시"""
        config = AlertConfig(enable_slack=False)
        manager = AlertManager(config=config)

        result = await manager.send_slack("Test", "Test message")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_slack_no_webhook(self):
        """Slack 웹훅 없을 때"""
        config = AlertConfig(slack_webhook=None)
        manager = AlertManager(config=config)

        result = await manager.send_slack("Test", "Test message")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_discord_disabled(self):
        """Discord 비활성화 시"""
        config = AlertConfig(enable_discord=False)
        manager = AlertManager(config=config)

        result = await manager.send_discord("Test", "Test message")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_discord_no_webhook(self):
        """Discord 웹훅 없을 때"""
        config = AlertConfig(discord_webhook=None)
        manager = AlertManager(config=config)

        result = await manager.send_discord("Test", "Test message")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_alert_both_disabled(self):
        """모든 알림 비활성화"""
        config = AlertConfig(enable_slack=False, enable_discord=False)
        manager = AlertManager(config=config)

        result = await manager.send_alert("Test", "Test message")

        assert result["slack"] is False
        assert result["discord"] is False

    @pytest.mark.asyncio
    async def test_send_incident_alert(self):
        """인시던트 알림 전송"""
        config = AlertConfig(enable_slack=False, enable_discord=False)
        manager = AlertManager(config=config)

        now = datetime.now(timezone.utc)
        incident = Incident(
            id="INC-001",
            title="Test Incident",
            description="Test",
            status=IncidentStatus.DETECTED,
            level=RecoveryLevel.L1,
            created_at=now,
            updated_at=now,
        )

        result = await manager.send_incident_alert(incident)

        assert "slack" in result
        assert "discord" in result


# =========================================
# IncidentTracker 테스트
# =========================================

class TestIncidentTracker:
    """IncidentTracker 클래스 테스트"""

    def test_init(self):
        """초기화"""
        tracker = IncidentTracker()

        assert tracker.alert_manager is None
        assert tracker._incidents == {}
        assert tracker._incident_counter == 0

    def test_generate_id(self):
        """인시던트 ID 생성"""
        tracker = IncidentTracker()

        id1 = tracker._generate_id()
        id2 = tracker._generate_id()

        assert id1.startswith("INC-")
        assert id1 != id2
        assert tracker._incident_counter == 2

    @pytest.mark.asyncio
    async def test_create_incident(self):
        """인시던트 생성"""
        tracker = IncidentTracker()

        incident = await tracker.create_incident(
            title="Test Incident",
            description="Test description",
            level=RecoveryLevel.L1,
            affected_services=["api"],
            send_alert=False,
        )

        assert incident.title == "Test Incident"
        assert incident.status == IncidentStatus.DETECTED
        assert incident.level == RecoveryLevel.L1
        assert "api" in incident.affected_services
        assert len(incident.timeline) == 1  # detected 이벤트

    @pytest.mark.asyncio
    async def test_get_incident(self):
        """인시던트 조회"""
        tracker = IncidentTracker()
        incident = await tracker.create_incident(
            title="Test",
            description="Test",
            send_alert=False,
        )

        found = tracker.get_incident(incident.id)

        assert found is not None
        assert found.id == incident.id

    @pytest.mark.asyncio
    async def test_get_incident_not_found(self):
        """존재하지 않는 인시던트 조회"""
        tracker = IncidentTracker()

        found = tracker.get_incident("NOT-EXIST")

        assert found is None

    @pytest.mark.asyncio
    async def test_get_active_incidents(self):
        """활성 인시던트 목록"""
        tracker = IncidentTracker()

        inc1 = await tracker.create_incident("Active 1", "Test", send_alert=False)
        inc2 = await tracker.create_incident("Active 2", "Test", send_alert=False)
        inc3 = await tracker.create_incident("Resolved", "Test", send_alert=False)
        inc3.resolve("Fixed")

        active = tracker.get_active_incidents()

        assert len(active) == 2
        assert inc1 in active
        assert inc2 in active

    @pytest.mark.asyncio
    async def test_get_recent_incidents(self):
        """최근 인시던트 목록"""
        tracker = IncidentTracker()

        await tracker.create_incident("Recent", "Test", send_alert=False)

        recent = tracker.get_recent_incidents(hours=1)

        assert len(recent) == 1

    @pytest.mark.asyncio
    async def test_update_incident(self):
        """인시던트 업데이트"""
        tracker = IncidentTracker()
        incident = await tracker.create_incident("Test", "Test", send_alert=False)

        updated = await tracker.update_incident(
            incident.id,
            status=IncidentStatus.INVESTIGATING,
            event_type="investigate",
            event_message="Investigating the issue",
        )

        assert updated is not None
        assert updated.status == IncidentStatus.INVESTIGATING
        assert len(updated.timeline) == 2

    @pytest.mark.asyncio
    async def test_resolve_incident(self):
        """인시던트 해결"""
        tracker = IncidentTracker()
        incident = await tracker.create_incident("Test", "Test", send_alert=False)

        resolved = await tracker.resolve_incident(
            incident.id,
            resolution="Fixed the bug",
            root_cause="Memory leak",
            send_alert=False,
        )

        assert resolved is not None
        assert resolved.status == IncidentStatus.RESOLVED
        assert resolved.resolution == "Fixed the bug"
        assert resolved.root_cause == "Memory leak"

    @pytest.mark.asyncio
    async def test_escalate_incident(self):
        """인시던트 에스컬레이션"""
        tracker = IncidentTracker()
        incident = await tracker.create_incident(
            "Test",
            "Test",
            level=RecoveryLevel.L1,
            send_alert=False,
        )

        escalated = await tracker.escalate_incident(
            incident.id,
            new_level=RecoveryLevel.L2,
            reason="L1 failed to resolve",
            send_alert=False,
        )

        assert escalated is not None
        assert escalated.level == RecoveryLevel.L2
        assert escalated.status == IncidentStatus.ESCALATED


# =========================================
# RunbookExecutor 테스트
# =========================================

class TestRunbookExecutor:
    """RunbookExecutor 클래스 테스트"""

    def test_init(self):
        """초기화"""
        executor = RunbookExecutor()

        assert executor.alert_manager is not None
        assert executor.incident_tracker is not None
        assert executor._health_check_failures == 0

    def test_default_l1_conditions(self):
        """기본 L1 조건"""
        conditions = RunbookExecutor.DEFAULT_L1_CONDITIONS

        assert "health_check_failed" in conditions
        assert conditions["health_check_failed"]["threshold"] == 3
        assert "high_error_rate" in conditions
        assert conditions["high_error_rate"]["threshold"] == 0.1
        assert "api_response_slow" in conditions
        assert conditions["api_response_slow"]["threshold"] == 5.0

    def test_record_health_check_failure(self):
        """헬스 체크 실패 기록"""
        executor = RunbookExecutor()

        count = executor.record_health_check_failure()
        assert count == 1

        count = executor.record_health_check_failure()
        assert count == 2

    def test_reset_health_check_failures(self):
        """헬스 체크 실패 리셋"""
        executor = RunbookExecutor()
        executor.record_health_check_failure()
        executor.record_health_check_failure()

        executor.reset_health_check_failures()

        assert executor._health_check_failures == 0

    def test_should_trigger_l1_below_threshold(self):
        """L1 트리거 - 임계값 미만"""
        executor = RunbookExecutor()
        executor.record_health_check_failure()
        executor.record_health_check_failure()

        result = executor.should_trigger_l1()

        assert result is False

    def test_should_trigger_l1_at_threshold(self):
        """L1 트리거 - 임계값 도달"""
        executor = RunbookExecutor()
        for _ in range(3):
            executor.record_health_check_failure()

        result = executor.should_trigger_l1()

        assert result is True

    def test_should_trigger_l1_cooldown(self):
        """L1 트리거 - 쿨다운 중"""
        executor = RunbookExecutor()
        executor._last_l1_execution = datetime.now(timezone.utc)
        for _ in range(5):
            executor.record_health_check_failure()

        result = executor.should_trigger_l1()

        assert result is False

    def test_register_l1_condition(self):
        """L1 조건 등록"""
        executor = RunbookExecutor()

        async def check_fn():
            return True

        executor.register_l1_condition(
            name="test_condition",
            check_fn=check_fn,
            description="Test condition",
            cooldown_seconds=60,
        )

        assert "test_condition" in executor._l1_conditions
        assert executor._l1_conditions["test_condition"].description == "Test condition"

    @pytest.mark.asyncio
    async def test_check_l1_conditions_no_conditions(self):
        """L1 조건 체크 - 조건 없음"""
        executor = RunbookExecutor()

        result = await executor.check_l1_conditions()

        assert result is None

    @pytest.mark.asyncio
    async def test_check_l1_conditions_triggered(self):
        """L1 조건 체크 - 조건 트리거"""
        executor = RunbookExecutor()

        async def always_true():
            return True

        executor.register_l1_condition(
            name="always_trigger",
            check_fn=always_true,
        )

        result = await executor.check_l1_conditions()

        assert result == "always_trigger"

    @pytest.mark.asyncio
    async def test_check_l1_conditions_not_triggered(self):
        """L1 조건 체크 - 조건 미트리거"""
        executor = RunbookExecutor()

        async def always_false():
            return False

        executor.register_l1_condition(
            name="never_trigger",
            check_fn=always_false,
        )

        result = await executor.check_l1_conditions()

        assert result is None

    @pytest.mark.asyncio
    async def test_check_l1_conditions_disabled(self):
        """L1 조건 체크 - 비활성화된 조건"""
        executor = RunbookExecutor()

        async def always_true():
            return True

        executor.register_l1_condition(
            name="disabled_condition",
            check_fn=always_true,
        )
        executor._l1_conditions["disabled_condition"].enabled = False

        result = await executor.check_l1_conditions()

        assert result is None

    @pytest.mark.asyncio
    async def test_execute_l1_soft_reset(self):
        """L1 Soft Reset 실행"""
        executor = RunbookExecutor()
        executor.record_health_check_failure()
        executor.record_health_check_failure()
        executor.record_health_check_failure()

        result = await executor.execute_l1_soft_reset(
            service="test-service",
            reason="Test reason",
        )

        assert result.result == ActionResult.SUCCESS
        assert result.action.name == "L1 Soft Reset"
        assert result.action.level == RecoveryLevel.L1
        assert result.completed_at is not None
        assert result.duration_ms is not None
        assert executor._health_check_failures == 0  # 리셋됨

    @pytest.mark.asyncio
    async def test_execute_l1_soft_reset_creates_incident(self):
        """L1 Soft Reset이 인시던트 생성"""
        executor = RunbookExecutor()

        await executor.execute_l1_soft_reset(service="api")

        active_incidents = executor.incident_tracker.get_active_incidents()
        # L1이 성공하면 인시던트가 해결되어 활성 목록에 없음
        recent_incidents = executor.incident_tracker.get_recent_incidents(hours=1)
        assert len(recent_incidents) >= 1

    def test_get_l1_execution_history(self):
        """L1 실행 이력 조회"""
        executor = RunbookExecutor()

        history = executor.get_l1_execution_history()

        assert isinstance(history, list)

    def test_get_runbook_status(self):
        """런북 상태 조회"""
        executor = RunbookExecutor()
        executor.record_health_check_failure()

        status = executor.get_runbook_status()

        assert status["health_check_failures"] == 1
        assert status["l1_cooldown_active"] is False
        assert status["last_l1_execution"] is None
        assert status["l1_execution_count"] == 0


# =========================================
# 싱글톤 테스트
# =========================================

class TestSingletons:
    """싱글톤 함수 테스트"""

    def test_get_alert_manager_singleton(self):
        """AlertManager 싱글톤"""
        reset_runbook_module()

        manager1 = get_alert_manager()
        manager2 = get_alert_manager()

        assert manager1 is manager2

    def test_get_incident_tracker_singleton(self):
        """IncidentTracker 싱글톤"""
        reset_runbook_module()

        tracker1 = get_incident_tracker()
        tracker2 = get_incident_tracker()

        assert tracker1 is tracker2

    def test_get_runbook_executor_singleton(self):
        """RunbookExecutor 싱글톤"""
        reset_runbook_module()

        executor1 = get_runbook_executor()
        executor2 = get_runbook_executor()

        assert executor1 is executor2

    def test_reset_runbook_module(self):
        """모듈 리셋"""
        manager1 = get_alert_manager()
        reset_runbook_module()
        manager2 = get_alert_manager()

        assert manager1 is not manager2


# =========================================
# L1TriggerCondition 테스트
# =========================================

class TestL1TriggerCondition:
    """L1TriggerCondition 테스트"""

    def test_create_condition(self):
        """조건 생성"""
        async def check():
            return True

        condition = L1TriggerCondition(
            name="test",
            description="Test condition",
            check_fn=check,
            cooldown_seconds=120,
            max_attempts=5,
        )

        assert condition.name == "test"
        assert condition.cooldown_seconds == 120
        assert condition.max_attempts == 5
        assert condition.enabled is True
        assert condition.trigger_count == 0

    def test_default_values(self):
        """기본값 확인"""
        async def check():
            return True

        condition = L1TriggerCondition(
            name="test",
            description="Test",
            check_fn=check,
        )

        assert condition.cooldown_seconds == 300
        assert condition.max_attempts == 3


# =========================================
# 통합 시나리오 테스트
# =========================================

class TestIntegrationScenarios:
    """통합 시나리오 테스트"""

    @pytest.mark.asyncio
    async def test_full_incident_lifecycle(self):
        """인시던트 전체 수명주기"""
        reset_runbook_module()
        tracker = IncidentTracker()

        # 1. 인시던트 생성
        incident = await tracker.create_incident(
            title="API Server Down",
            description="API server not responding",
            level=RecoveryLevel.L1,
            affected_services=["api"],
            send_alert=False,
        )
        assert incident.status == IncidentStatus.DETECTED

        # 2. 조사 시작
        await tracker.update_incident(
            incident.id,
            status=IncidentStatus.INVESTIGATING,
            event_type="investigate",
            event_message="Started investigation",
        )
        assert incident.status == IncidentStatus.INVESTIGATING

        # 3. 복구 시작
        await tracker.update_incident(
            incident.id,
            status=IncidentStatus.RECOVERING,
            event_type="recover",
            event_message="Started recovery",
        )
        assert incident.status == IncidentStatus.RECOVERING

        # 4. 해결
        await tracker.resolve_incident(
            incident.id,
            resolution="Restarted API server",
            root_cause="Memory exhaustion",
            send_alert=False,
        )
        assert incident.status == IncidentStatus.RESOLVED
        assert len(incident.timeline) == 4

    @pytest.mark.asyncio
    async def test_l1_to_l2_escalation(self):
        """L1 → L2 에스컬레이션"""
        reset_runbook_module()
        tracker = IncidentTracker()

        # L1 인시던트 생성
        incident = await tracker.create_incident(
            title="Service Failure",
            description="Service not responding",
            level=RecoveryLevel.L1,
            send_alert=False,
        )

        # L2로 에스컬레이션
        await tracker.escalate_incident(
            incident.id,
            new_level=RecoveryLevel.L2,
            reason="L1 recovery failed",
            send_alert=False,
        )

        assert incident.level == RecoveryLevel.L2
        assert incident.status == IncidentStatus.ESCALATED

    @pytest.mark.asyncio
    async def test_automatic_l1_trigger(self):
        """자동 L1 트리거"""
        reset_runbook_module()
        executor = RunbookExecutor()

        # 헬스 체크 3회 실패
        for _ in range(3):
            executor.record_health_check_failure()

        assert executor.should_trigger_l1() is True

        # L1 실행
        result = await executor.execute_l1_soft_reset(
            service="api",
            reason="3 consecutive health check failures",
        )

        assert result.result == ActionResult.SUCCESS
        assert executor.should_trigger_l1() is False  # 쿨다운
