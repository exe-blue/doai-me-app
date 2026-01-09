"""
✅ DoAi.Me 기본 검증기
Pydantic 기반 데이터 검증 유틸리티

왜 이 구조인가?
- Pydantic v2의 새로운 ConfigDict 사용
- 프로젝트 전체에서 일관된 검증 설정
- 커스텀 에러 타입으로 명확한 에러 처리
"""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ValidationError(Exception):
    """
    커스텀 검증 에러

    Pydantic ValidationError와 구분하기 위한 프로젝트 전용 에러

    Attributes:
        field: 에러가 발생한 필드명
        message: 에러 메시지
        value: 검증 실패한 값 (선택)
    """

    def __init__(
        self,
        field: str,
        message: str,
        value: Optional[Any] = None,
    ) -> None:
        self.field = field
        self.message = message
        self.value = value
        super().__init__(f"{field}: {message}")

    def to_dict(self) -> Dict[str, Any]:
        """에러를 딕셔너리로 변환 (API 응답용)"""
        result = {
            "field": self.field,
            "message": self.message,
        }
        if self.value is not None:
            result["value"] = str(self.value)
        return result


class BaseValidator(BaseModel):
    """
    모든 검증기의 기본 클래스

    프로젝트 전체에서 일관된 Pydantic 설정 적용

    사용 예:
        class UserValidator(BaseValidator):
            name: str
            email: str

        user = UserValidator(name="  John  ", email="john@example.com")
        # name은 자동으로 "John"으로 strip됨
    """

    model_config = ConfigDict(
        # 임의 타입 허용 (UUID, datetime 등)
        arbitrary_types_allowed=True,
        # 할당 시에도 검증 실행
        validate_assignment=True,
        # 문자열 앞뒤 공백 자동 제거
        str_strip_whitespace=True,
        # 알 수 없는 필드 무시
        extra="ignore",
        # JSON 스키마에서 예제 포함
        json_schema_extra={"examples": []},
    )


class TimestampMixin(BaseModel):
    """
    타임스탬프 필드 믹스인

    created_at, updated_at 필드가 필요한 모델에서 사용

    사용 예:
        class User(BaseValidator, TimestampMixin):
            name: str
    """

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UUIDMixin(BaseModel):
    """
    UUID ID 필드 믹스인

    UUID 기반 ID가 필요한 모델에서 사용

    사용 예:
        class Entity(BaseValidator, UUIDMixin):
            name: str
    """

    id: Optional[UUID] = None
