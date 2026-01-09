"""
📋 Agent Task 모델
Agent가 수행하는 작업 정의

사용 예:
    from shared.models import Task, TaskType, TaskStatus

    task = Task(
        type=TaskType.FEATURE,
        title="사용자 인증 구현",
        description="JWT 기반 인증 시스템 구현",
        assigned_agents=["coder", "reviewer"]
    )
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from .message import Priority


class TaskType(str, Enum):
    """작업 유형"""

    FEATURE = "feature"  # 새 기능 개발
    BUGFIX = "bugfix"  # 버그 수정
    OPTIMIZATION = "optimization"  # 최적화
    RESEARCH = "research"  # 리서치/분석
    REFACTOR = "refactor"  # 리팩토링
    DOCUMENTATION = "documentation"  # 문서화
    TESTING = "testing"  # 테스트 작성
    REVIEW = "review"  # 코드 리뷰


class TaskStatus(str, Enum):
    """작업 상태"""

    PENDING = "pending"  # 대기 중
    QUEUED = "queued"  # 큐에 추가됨
    IN_PROGRESS = "in_progress"  # 진행 중
    REVIEW = "review"  # 리뷰 중
    COMPLETED = "completed"  # 완료
    FAILED = "failed"  # 실패
    CANCELLED = "cancelled"  # 취소
    BLOCKED = "blocked"  # 차단됨 (의존성 대기)


class TaskResult(BaseModel):
    """작업 결과"""

    success: bool
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    artifacts: List[str] = Field(default_factory=list)  # 생성된 파일 경로 등
    metrics: Dict[str, Any] = Field(default_factory=dict)  # 실행 메트릭


class Task(BaseModel):
    """
    Agent 작업

    Attributes:
        task_id: 고유 작업 ID
        type: 작업 유형
        status: 현재 상태
        title: 작업 제목
        description: 상세 설명
        priority: 우선순위
        assigned_agents: 할당된 Agent ID 목록
        dependencies: 의존하는 작업 ID 목록
        context: 작업 컨텍스트
        metadata: 추가 메타데이터
        result: 작업 결과 (완료 시)
    """

    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: TaskType
    status: TaskStatus = TaskStatus.PENDING
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="")
    priority: Priority = Priority.MEDIUM
    assigned_agents: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[TaskResult] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_seconds: int = Field(default=3600, ge=60, le=86400)  # 1분 ~ 24시간

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        use_enum_values = True

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if isinstance(v, int) and not (1 <= v <= 5):
            raise ValueError("Priority must be between 1 and 5")
        return v

    def start(self) -> None:
        """작업 시작"""
        self.status = TaskStatus.IN_PROGRESS
        self.started_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def complete(self, result: TaskResult) -> None:
        """작업 완료"""
        self.status = TaskStatus.COMPLETED if result.success else TaskStatus.FAILED
        self.result = result
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def cancel(self, reason: str = "") -> None:
        """작업 취소"""
        self.status = TaskStatus.CANCELLED
        self.metadata["cancel_reason"] = reason
        self.updated_at = datetime.utcnow()

    def is_terminal(self) -> bool:
        """종료 상태 여부"""
        return self.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]

    def is_timed_out(self) -> bool:
        """타임아웃 여부"""
        if self.started_at is None:
            return False
        elapsed = (datetime.utcnow() - self.started_at).total_seconds()
        return elapsed > self.timeout_seconds

    @property
    def duration_seconds(self) -> Optional[float]:
        """작업 소요 시간 (초)"""
        if self.started_at is None:
            return None
        end_time = self.completed_at or datetime.utcnow()
        return (end_time - self.started_at).total_seconds()
