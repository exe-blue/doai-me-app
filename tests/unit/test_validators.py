"""
🧪 Validators 단위 테스트
shared/utils/validators.py 테스트
"""

from datetime import datetime
from uuid import UUID, uuid4

import pytest


class TestValidationError:
    """ValidationError 클래스 테스트"""

    def test_validation_error_creation(self):
        """ValidationError 생성"""
        from shared.utils import ValidationError

        error = ValidationError(field="email", message="유효하지 않은 이메일")

        assert error.field == "email"
        assert error.message == "유효하지 않은 이메일"
        assert str(error) == "email: 유효하지 않은 이메일"

    def test_validation_error_with_value(self):
        """값과 함께 ValidationError 생성"""
        from shared.utils import ValidationError

        error = ValidationError(
            field="age",
            message="0보다 커야 합니다",
            value=-1,
        )

        assert error.field == "age"
        assert error.value == -1

    def test_validation_error_to_dict(self):
        """ValidationError를 딕셔너리로 변환"""
        from shared.utils import ValidationError

        error = ValidationError(
            field="name",
            message="필수 필드입니다",
            value=None,
        )

        result = error.to_dict()

        assert result["field"] == "name"
        assert result["message"] == "필수 필드입니다"

    def test_validation_error_to_dict_with_value(self):
        """값이 있는 ValidationError를 딕셔너리로 변환"""
        from shared.utils import ValidationError

        error = ValidationError(
            field="count",
            message="최대값을 초과했습니다",
            value=1000,
        )

        result = error.to_dict()

        assert result["field"] == "count"
        assert result["message"] == "최대값을 초과했습니다"
        assert result["value"] == "1000"


class TestBaseValidator:
    """BaseValidator 클래스 테스트"""

    def test_base_validator_creation(self):
        """BaseValidator 상속 클래스 생성"""
        from shared.utils import BaseValidator

        class UserValidator(BaseValidator):
            name: str
            age: int

        user = UserValidator(name="John", age=30)

        assert user.name == "John"
        assert user.age == 30

    def test_base_validator_strip_whitespace(self):
        """문자열 앞뒤 공백 자동 제거"""
        from shared.utils import BaseValidator

        class NameValidator(BaseValidator):
            name: str

        validator = NameValidator(name="  John Doe  ")

        assert validator.name == "John Doe"

    def test_base_validator_extra_ignore(self):
        """알 수 없는 필드 무시"""
        from shared.utils import BaseValidator

        class SimpleValidator(BaseValidator):
            name: str

        # unknown_field는 무시되어야 함
        validator = SimpleValidator(name="test", unknown_field="ignored")

        assert validator.name == "test"
        assert not hasattr(validator, "unknown_field")

    def test_base_validator_validate_assignment(self):
        """할당 시 검증"""
        from shared.utils import BaseValidator

        class AgeValidator(BaseValidator):
            age: int

        validator = AgeValidator(age=25)
        validator.age = 30

        assert validator.age == 30

    def test_base_validator_arbitrary_types(self):
        """임의 타입 허용 (UUID, datetime)"""
        from shared.utils import BaseValidator

        class EntityValidator(BaseValidator):
            id: UUID
            created_at: datetime

        now = datetime.now()
        entity_id = uuid4()

        validator = EntityValidator(id=entity_id, created_at=now)

        assert validator.id == entity_id
        assert validator.created_at == now


class TestTimestampMixin:
    """TimestampMixin 테스트"""

    def test_timestamp_mixin(self):
        """타임스탬프 믹스인 사용"""
        from shared.utils.validators import BaseValidator, TimestampMixin

        class Entity(BaseValidator, TimestampMixin):
            name: str

        now = datetime.now()
        entity = Entity(name="test", created_at=now)

        assert entity.name == "test"
        assert entity.created_at == now
        assert entity.updated_at is None


class TestUUIDMixin:
    """UUIDMixin 테스트"""

    def test_uuid_mixin(self):
        """UUID 믹스인 사용"""
        from shared.utils.validators import BaseValidator, UUIDMixin

        class Entity(BaseValidator, UUIDMixin):
            name: str

        entity_id = uuid4()
        entity = Entity(id=entity_id, name="test")

        assert entity.id == entity_id
        assert entity.name == "test"

    def test_uuid_mixin_optional(self):
        """UUID 믹스인 - ID 선택적"""
        from shared.utils.validators import BaseValidator, UUIDMixin

        class Entity(BaseValidator, UUIDMixin):
            name: str

        entity = Entity(name="test")

        assert entity.id is None
        assert entity.name == "test"
