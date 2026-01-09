"""
📚 Knowledge 모델
Agent 간 공유되는 지식 정의

사용 예:
    from shared.models import Knowledge, KnowledgeType

    knowledge = Knowledge(
        type=KnowledgeType.CODE_SNIPPET,
        title="JWT 인증 헬퍼",
        content="def verify_token(token): ...",
        tags=["auth", "jwt", "helper"]
    )
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class KnowledgeType(str, Enum):
    """지식 유형"""

    CODE_SNIPPET = "code_snippet"  # 코드 조각
    DOCUMENTATION = "documentation"  # 문서
    ARCHITECTURE = "architecture"  # 아키텍처 설계
    PATTERN = "pattern"  # 디자인 패턴
    LESSON_LEARNED = "lesson_learned"  # 교훈
    BEST_PRACTICE = "best_practice"  # 모범 사례
    ERROR_SOLUTION = "error_solution"  # 에러 해결책
    REFERENCE = "reference"  # 참조 자료


class KnowledgeSource(str, Enum):
    """지식 출처"""

    AGENT = "agent"  # Agent가 생성
    HUMAN = "human"  # 사람이 입력
    EXTERNAL = "external"  # 외부 소스
    GENERATED = "generated"  # 자동 생성


class Knowledge(BaseModel):
    """
    Agent 지식 베이스 항목

    Attributes:
        knowledge_id: 고유 ID
        type: 지식 유형
        title: 제목
        content: 내용
        tags: 태그 목록
        source: 출처
        source_agent: 생성한 Agent ID
        related_task_id: 관련 작업 ID
        embedding: 벡터 임베딩 (검색용)
        relevance_score: 관련성 점수
        usage_count: 사용 횟수
        metadata: 추가 메타데이터
    """

    knowledge_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: KnowledgeType
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source: KnowledgeSource = KnowledgeSource.AGENT
    source_agent: Optional[str] = None
    related_task_id: Optional[str] = None
    embedding: Optional[List[float]] = None
    relevance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    usage_count: int = Field(default=0, ge=0)
    is_archived: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        use_enum_values = True

    def is_expired(self) -> bool:
        """만료 여부"""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def increment_usage(self) -> None:
        """사용 횟수 증가"""
        self.usage_count += 1
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """아카이브"""
        self.is_archived = True
        self.updated_at = datetime.utcnow()

    def matches_tags(self, search_tags: List[str]) -> bool:
        """태그 매칭 여부"""
        if not search_tags:
            return True
        return any(tag in self.tags for tag in search_tags)


class KnowledgeQuery(BaseModel):
    """지식 검색 쿼리"""

    query: str = Field(..., min_length=1)
    types: Optional[List[KnowledgeType]] = None
    tags: Optional[List[str]] = None
    source_agent: Optional[str] = None
    min_relevance: float = Field(default=0.0, ge=0.0, le=1.0)
    include_archived: bool = False
    limit: int = Field(default=10, ge=1, le=100)


class KnowledgeSearchResult(BaseModel):
    """지식 검색 결과"""

    items: List[Knowledge]
    total_count: int
    query: KnowledgeQuery
