"""
🧪 Models 단위 테스트
shared/models/ 테스트
"""

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError


class TestMessageModels:
    """Message 모델 테스트"""

    def test_agent_message_creation(self):
        """AgentMessage 생성"""
        from shared.models import AgentMessage, MessageType, Priority

        message = AgentMessage(
            message_type=MessageType.REQUEST,
            from_agent="orchestrator",
            to_agent="coder",
            payload={"action": "code"},
        )

        assert message.message_id is not None
        assert message.message_type == MessageType.REQUEST
        assert message.from_agent == "orchestrator"
        assert message.to_agent == "coder"
        assert message.priority == Priority.MEDIUM

    def test_agent_message_with_priority(self):
        """우선순위 지정 메시지"""
        from shared.models import AgentMessage, MessageType, Priority

        message = AgentMessage(
            message_type=MessageType.REQUEST,
            from_agent="a",
            to_agent="b",
            payload={},
            priority=Priority.CRITICAL,
        )

        assert message.priority == Priority.CRITICAL

    def test_agent_message_expiry(self):
        """메시지 만료 확인"""
        from shared.models import AgentMessage, MessageType

        # TTL 1초인 메시지
        message = AgentMessage(
            message_type=MessageType.EVENT,
            from_agent="a",
            to_agent="b",
            payload={},
            ttl_seconds=1,
        )

        # 생성 직후에는 만료되지 않음
        assert not message.is_expired()

    def test_agent_message_create_response(self):
        """응답 메시지 생성"""
        from shared.models import AgentMessage, MessageType

        request = AgentMessage(
            message_type=MessageType.REQUEST,
            from_agent="client",
            to_agent="server",
            payload={"query": "test"},
        )

        response = request.create_response({"result": "ok"})

        assert response.from_agent == "server"
        assert response.to_agent == "client"
        assert response.correlation_id == request.message_id
        assert response.message_type == MessageType.RESPONSE

    def test_agent_message_create_error_response(self):
        """에러 응답 생성"""
        from shared.models import AgentMessage, MessageType, Priority

        request = AgentMessage(
            message_type=MessageType.REQUEST,
            from_agent="a",
            to_agent="b",
            payload={},
        )

        error = request.create_error_response("Something went wrong")

        assert error.message_type == MessageType.ERROR
        assert error.priority == Priority.HIGH
        assert error.payload["error"] == "Something went wrong"


class TestTaskModels:
    """Task 모델 테스트"""

    def test_task_creation(self):
        """Task 생성"""
        from shared.models import Task, TaskStatus, TaskType

        task = Task(
            type=TaskType.FEATURE,
            title="새 기능 개발",
            description="사용자 인증 구현",
        )

        assert task.task_id is not None
        assert task.type == TaskType.FEATURE
        assert task.status == TaskStatus.PENDING
        assert task.title == "새 기능 개발"

    def test_task_start(self):
        """Task 시작"""
        from shared.models import Task, TaskStatus, TaskType

        task = Task(type=TaskType.BUGFIX, title="버그 수정")
        task.start()

        assert task.status == TaskStatus.IN_PROGRESS
        assert task.started_at is not None

    def test_task_complete_success(self):
        """Task 완료 (성공)"""
        from shared.models import Task, TaskStatus, TaskType
        from shared.models.task import TaskResult

        task = Task(type=TaskType.FEATURE, title="테스트")
        task.start()
        task.complete(TaskResult(success=True, output={"files": ["main.py"]}))

        assert task.status == TaskStatus.COMPLETED
        assert task.completed_at is not None
        assert task.result.success is True

    def test_task_complete_failure(self):
        """Task 완료 (실패)"""
        from shared.models import Task, TaskStatus, TaskType
        from shared.models.task import TaskResult

        task = Task(type=TaskType.FEATURE, title="테스트")
        task.start()
        task.complete(TaskResult(success=False, error="컴파일 에러"))

        assert task.status == TaskStatus.FAILED
        assert task.result.success is False

    def test_task_cancel(self):
        """Task 취소"""
        from shared.models import Task, TaskStatus, TaskType

        task = Task(type=TaskType.RESEARCH, title="리서치")
        task.cancel("우선순위 변경")

        assert task.status == TaskStatus.CANCELLED
        assert task.metadata["cancel_reason"] == "우선순위 변경"

    def test_task_is_terminal(self):
        """종료 상태 확인"""
        from shared.models import Task, TaskStatus, TaskType

        task = Task(type=TaskType.FEATURE, title="테스트")
        assert not task.is_terminal()

        task.status = TaskStatus.COMPLETED
        assert task.is_terminal()

    def test_task_duration(self):
        """작업 시간 계산"""
        from shared.models import Task, TaskType
        from shared.models.task import TaskResult

        task = Task(type=TaskType.FEATURE, title="테스트")
        task.start()

        # duration이 None이 아님
        assert task.duration_seconds is not None
        assert task.duration_seconds >= 0

    def test_task_title_validation(self):
        """제목 검증"""
        from shared.models import Task, TaskType

        # 빈 제목은 허용되지 않음
        with pytest.raises(ValidationError):
            Task(type=TaskType.FEATURE, title="")

    def test_task_priority_validation(self):
        """우선순위 검증"""
        from shared.models import Task, TaskType
        from shared.models.message import Priority

        # 유효한 우선순위
        task = Task(type=TaskType.FEATURE, title="테스트", priority=Priority.HIGH)
        assert task.priority == Priority.HIGH


class TestAgentModels:
    """Agent 모델 테스트"""

    def test_agent_config_creation(self):
        """AgentConfig 생성"""
        from shared.models import AgentCapability, AgentConfig

        config = AgentConfig(
            agent_id="coder-1",
            agent_type="coder",
            capabilities=[AgentCapability.CODING, AgentCapability.TESTING],
        )

        assert config.agent_id == "coder-1"
        assert config.agent_type == "coder"
        assert AgentCapability.CODING in config.capabilities

    def test_agent_config_has_capability(self):
        """능력 보유 확인"""
        from shared.models import AgentCapability, AgentConfig

        config = AgentConfig(
            agent_id="reviewer-1",
            agent_type="reviewer",
            capabilities=[AgentCapability.REVIEWING],
        )

        assert config.has_capability(AgentCapability.REVIEWING)
        assert not config.has_capability(AgentCapability.CODING)

    def test_agent_config_requires_capability(self):
        """능력 필수 검증"""
        from shared.models import AgentConfig

        with pytest.raises(ValidationError):
            AgentConfig(
                agent_id="empty",
                agent_type="test",
                capabilities=[],  # 빈 능력 목록
            )

    def test_agent_status_creation(self):
        """AgentStatus 생성"""
        from shared.models import AgentState, AgentStatus

        status = AgentStatus(
            agent_id="worker-1",
            state=AgentState.IDLE,
        )

        assert status.agent_id == "worker-1"
        assert status.state == AgentState.IDLE
        assert status.tasks_completed == 0

    def test_agent_status_is_available(self):
        """가용성 확인"""
        from shared.models import AgentState, AgentStatus

        status = AgentStatus(agent_id="worker-1", state=AgentState.IDLE)
        assert status.is_available()

        status.state = AgentState.ERROR
        assert not status.is_available()

    def test_agent_status_assign_task(self):
        """작업 할당"""
        from shared.models import AgentState, AgentStatus

        status = AgentStatus(agent_id="worker-1", state=AgentState.IDLE)
        status.assign_task("task-123")

        assert status.state == AgentState.BUSY
        assert "task-123" in status.current_task_ids
        assert status.current_task_id == "task-123"

    def test_agent_status_complete_task(self):
        """작업 완료 처리"""
        from shared.models import AgentState, AgentStatus

        status = AgentStatus(agent_id="worker-1", state=AgentState.IDLE)
        status.assign_task("task-123")
        status.complete_task("task-123", success=True)

        assert status.state == AgentState.IDLE
        assert status.tasks_completed == 1
        assert "task-123" not in status.current_task_ids

    def test_agent_status_success_rate(self):
        """성공률 계산"""
        from shared.models import AgentStatus

        status = AgentStatus(agent_id="worker-1")
        status.tasks_completed = 8
        status.tasks_failed = 2

        assert status.success_rate == 0.8

    def test_agent_status_is_healthy(self):
        """헬스 상태 확인"""
        from shared.models import AgentState, AgentStatus

        status = AgentStatus(agent_id="worker-1", state=AgentState.IDLE)
        assert status.is_healthy()

        status.state = AgentState.ERROR
        assert not status.is_healthy()


class TestKnowledgeModels:
    """Knowledge 모델 테스트"""

    def test_knowledge_creation(self):
        """Knowledge 생성"""
        from shared.models import Knowledge, KnowledgeType

        knowledge = Knowledge(
            type=KnowledgeType.CODE_SNIPPET,
            title="JWT 헬퍼",
            content="def verify_token(token): pass",
            tags=["auth", "jwt"],
        )

        assert knowledge.knowledge_id is not None
        assert knowledge.type == KnowledgeType.CODE_SNIPPET
        assert "auth" in knowledge.tags

    def test_knowledge_increment_usage(self):
        """사용 횟수 증가"""
        from shared.models import Knowledge, KnowledgeType

        knowledge = Knowledge(
            type=KnowledgeType.DOCUMENTATION,
            title="API 문서",
            content="# API Reference",
        )

        initial_count = knowledge.usage_count
        knowledge.increment_usage()

        assert knowledge.usage_count == initial_count + 1

    def test_knowledge_archive(self):
        """아카이브"""
        from shared.models import Knowledge, KnowledgeType

        knowledge = Knowledge(
            type=KnowledgeType.LESSON_LEARNED,
            title="교훈",
            content="항상 테스트를 작성하자",
        )

        knowledge.archive()

        assert knowledge.is_archived is True

    def test_knowledge_matches_tags(self):
        """태그 매칭"""
        from shared.models import Knowledge, KnowledgeType

        knowledge = Knowledge(
            type=KnowledgeType.PATTERN,
            title="싱글톤 패턴",
            content="class Singleton: ...",
            tags=["design-pattern", "singleton", "python"],
        )

        assert knowledge.matches_tags(["python"])
        assert knowledge.matches_tags(["singleton", "java"])  # 하나라도 매칭
        assert not knowledge.matches_tags(["java", "spring"])

    def test_knowledge_expiry(self):
        """만료 확인"""
        from shared.models import Knowledge, KnowledgeType

        # 만료되지 않은 지식
        knowledge = Knowledge(
            type=KnowledgeType.REFERENCE,
            title="참조",
            content="https://example.com",
        )
        assert not knowledge.is_expired()

        # 이미 만료된 지식
        knowledge.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        assert knowledge.is_expired()

    def test_knowledge_query(self):
        """KnowledgeQuery 생성"""
        from shared.models import KnowledgeType
        from shared.models.knowledge import KnowledgeQuery

        query = KnowledgeQuery(
            query="인증 방법",
            types=[KnowledgeType.CODE_SNIPPET, KnowledgeType.DOCUMENTATION],
            tags=["auth"],
            limit=20,
        )

        assert query.query == "인증 방법"
        assert len(query.types) == 2
        assert query.limit == 20
