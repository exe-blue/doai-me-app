"""
📨 Agent 메시지 모델
Agent 간 통신에 사용되는 메시지 정의

사용 예:
    from shared.models import AgentMessage, MessageType, Priority

    message = AgentMessage(
        message_type=MessageType.REQUEST,
        from_agent="orchestrator",
        to_agent="coder",
        payload={"action": "implement_feature", "spec": {...}}
    )
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """메시지 유형"""

    REQUEST = "request"  # 요청
    RESPONSE = "response"  # 응답
    EVENT = "event"  # 이벤트 알림
    ERROR = "error"  # 에러
    HEARTBEAT = "heartbeat"  # 하트비트
    BROADCAST = "broadcast"  # 브로드캐스트


class Priority(int, Enum):
    """메시지 우선순위"""

    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5


class AgentMessage(BaseModel):
    """
    Agent 간 메시지

    Attributes:
        message_id: 고유 메시지 ID
        message_type: 메시지 유형
        from_agent: 발신 Agent ID
        to_agent: 수신 Agent ID
        payload: 메시지 본문
        context: 추가 컨텍스트
        priority: 우선순위
        correlation_id: 연관 메시지 ID (요청-응답 매칭용)
        reply_to: 응답 받을 큐/채널
        ttl_seconds: 메시지 TTL (초)
    """

    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_type: MessageType
    from_agent: str
    to_agent: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Dict[str, Any]
    context: Dict[str, Any] = Field(default_factory=dict)
    priority: Priority = Priority.MEDIUM
    correlation_id: Optional[str] = None
    reply_to: Optional[str] = None
    ttl_seconds: Optional[int] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
        use_enum_values = True

    def is_expired(self) -> bool:
        """메시지 만료 여부"""
        if self.ttl_seconds is None:
            return False
        elapsed = (datetime.utcnow() - self.timestamp).total_seconds()
        return elapsed > self.ttl_seconds

    def create_response(
        self,
        payload: Dict[str, Any],
        message_type: MessageType = MessageType.RESPONSE,
    ) -> "AgentMessage":
        """이 메시지에 대한 응답 생성"""
        return AgentMessage(
            message_type=message_type,
            from_agent=self.to_agent,
            to_agent=self.from_agent,
            payload=payload,
            correlation_id=self.message_id,
            priority=self.priority,
        )

    def create_error_response(self, error: str, details: Optional[Dict] = None) -> "AgentMessage":
        """에러 응답 생성"""
        return AgentMessage(
            message_type=MessageType.ERROR,
            from_agent=self.to_agent,
            to_agent=self.from_agent,
            payload={"error": error, "details": details or {}},
            correlation_id=self.message_id,
            priority=Priority.HIGH,
        )
