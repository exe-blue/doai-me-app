"""
🤖 Agent 모델
Agent 설정 및 상태 정의

사용 예:
    from shared.models import AgentConfig, AgentStatus, AgentState, AgentCapability

    config = AgentConfig(
        agent_id="coder-1",
        agent_type="coder",
        capabilities=[AgentCapability.CODING, AgentCapability.TESTING]
    )

    status = AgentStatus(
        agent_id="coder-1",
        state=AgentState.IDLE
    )
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class AgentState(str, Enum):
    """Agent 상태"""

    IDLE = "idle"  # 유휴 상태
    BUSY = "busy"  # 작업 중
    ERROR = "error"  # 에러 발생
    MAINTENANCE = "maintenance"  # 유지보수 모드
    OFFLINE = "offline"  # 오프라인
    STARTING = "starting"  # 시작 중
    STOPPING = "stopping"  # 종료 중


class AgentCapability(str, Enum):
    """Agent 능력"""

    PLANNING = "planning"  # 계획 수립
    CODING = "coding"  # 코드 작성
    REVIEWING = "reviewing"  # 코드 리뷰
    TESTING = "testing"  # 테스트 작성/실행
    DOCUMENTATION = "documentation"  # 문서화
    OPTIMIZATION = "optimization"  # 최적화
    DEBUGGING = "debugging"  # 디버깅
    RESEARCH = "research"  # 리서치
    ORCHESTRATION = "orchestration"  # 오케스트레이션


class AgentConfig(BaseModel):
    """
    Agent 설정

    Attributes:
        agent_id: 고유 Agent ID
        agent_type: Agent 유형 (orchestrator, coder, reviewer, etc.)
        capabilities: Agent가 수행 가능한 작업 목록
        max_concurrent_tasks: 동시 처리 가능한 작업 수
        timeout_seconds: 작업 타임아웃 (초)
        retry_attempts: 재시도 횟수
        model_config_data: LLM 모델 설정
        metadata: 추가 메타데이터
    """

    agent_id: str = Field(..., min_length=1, max_length=100)
    agent_type: str = Field(..., min_length=1, max_length=50)
    capabilities: List[AgentCapability] = Field(default_factory=list)
    max_concurrent_tasks: int = Field(default=1, ge=1, le=100)
    timeout_seconds: int = Field(default=300, ge=30, le=3600)
    retry_attempts: int = Field(default=3, ge=0, le=10)
    model_config_data: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("capabilities")
    @classmethod
    def validate_capabilities(cls, v):
        if not v:
            raise ValueError("Agent must have at least one capability")
        return v

    def has_capability(self, capability: AgentCapability) -> bool:
        """특정 능력 보유 여부"""
        return capability in self.capabilities


class AgentStatus(BaseModel):
    """
    Agent 상태 정보

    Attributes:
        agent_id: Agent ID
        state: 현재 상태
        current_task_id: 현재 처리 중인 작업 ID
        tasks_completed: 완료한 작업 수
        tasks_failed: 실패한 작업 수
        last_heartbeat: 마지막 하트비트 시간
        resource_usage: 리소스 사용량
        error_message: 에러 메시지 (에러 상태일 때)
    """

    agent_id: str
    state: AgentState = AgentState.IDLE
    current_task_id: Optional[str] = None
    current_task_ids: List[str] = Field(default_factory=list)  # 동시 작업 지원
    tasks_completed: int = Field(default=0, ge=0)
    tasks_failed: int = Field(default=0, ge=0)
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)
    resource_usage: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    uptime_seconds: Optional[float] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        use_enum_values = True

    def is_available(self, max_concurrent: int = 1) -> bool:
        """작업 할당 가능 여부"""
        if self.state not in [AgentState.IDLE, AgentState.BUSY]:
            return False
        return len(self.current_task_ids) < max_concurrent

    def is_healthy(self, timeout_seconds: int = 60) -> bool:
        """헬스 상태 (하트비트 기반)"""
        if self.state in [AgentState.ERROR, AgentState.OFFLINE]:
            return False
        elapsed = (datetime.utcnow() - self.last_heartbeat).total_seconds()
        return elapsed < timeout_seconds

    def update_heartbeat(self) -> None:
        """하트비트 갱신"""
        self.last_heartbeat = datetime.utcnow()
        self.uptime_seconds = (datetime.utcnow() - self.started_at).total_seconds()

    def assign_task(self, task_id: str) -> None:
        """작업 할당"""
        self.current_task_ids.append(task_id)
        self.current_task_id = task_id
        self.state = AgentState.BUSY

    def complete_task(self, task_id: str, success: bool = True) -> None:
        """작업 완료 처리"""
        if task_id in self.current_task_ids:
            self.current_task_ids.remove(task_id)

        if success:
            self.tasks_completed += 1
        else:
            self.tasks_failed += 1

        if not self.current_task_ids:
            self.state = AgentState.IDLE
            self.current_task_id = None
        else:
            self.current_task_id = self.current_task_ids[-1]

    @property
    def success_rate(self) -> float:
        """작업 성공률"""
        total = self.tasks_completed + self.tasks_failed
        if total == 0:
            return 1.0
        return self.tasks_completed / total
