"""
🔧 DoAi.Me API Service Configuration
API 서비스 전용 설정 (공통 설정 확장)

왜 이 구조인가?
- shared.config.Settings를 기반으로 API 전용 설정 추가
- 공통 설정과 API 전용 설정 분리
- 프로덕션 환경에서는 모든 필수 값 명시적 설정 강제
"""

from functools import lru_cache
from typing import Optional

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings


# 안전하지 않은 기본값 상수 (프로덕션에서 거부됨)
_INSECURE_DEFAULT_API_KEY = "dev-api-key-change-in-production"


class APISettings(BaseSettings):
    """
    API 서비스 설정

    shared.config.Settings의 모든 필드를 포함하고,
    API 서비스 전용 필드를 추가
    """

    # ===========================================
    # App 메타데이터 (공통)
    # ===========================================
    app_name: str = "doai-me"
    app_version: str = "2.0.0"
    env: str = "development"  # development, staging, production
    debug: bool = True

    # ===========================================
    # Supabase Configuration (API 서비스에서는 필수)
    # ===========================================
    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_role_key: SecretStr

    # PostgreSQL 직접 연결 (선택)
    database_url: Optional[str] = None

    # ===========================================
    # Server Configuration (공통)
    # ===========================================
    port: int = 8080
    host: str = "0.0.0.0"
    api_prefix: str = "/api/v1"

    # ===========================================
    # API Configuration (API 서비스 전용)
    # ===========================================
    api_key: Optional[str] = None  # 프로덕션에서는 반드시 명시적 설정 필요

    @field_validator("api_key", mode="after")
    @classmethod
    def validate_api_key_not_default_in_production(
        cls, v: Optional[str], info
    ) -> Optional[str]:
        """
        프로덕션 환경에서 안전하지 않은 기본 API 키 사용 방지

        왜 이렇게 작성했는가?
        - 개발 환경에서는 편의를 위해 기본값 허용
        - 프로덕션에서는 보안을 위해 명시적 설정 강제
        """
        # info.data에서 env 값을 가져옴
        env = info.data.get("env", "development")

        if env == "production":
            if v is None:
                raise ValueError("프로덕션 환경에서는 API_KEY를 반드시 설정해야 합니다.")
            if v == _INSECURE_DEFAULT_API_KEY:
                raise ValueError(
                    f"프로덕션 환경에서 안전하지 않은 기본 API 키 "
                    f"'{_INSECURE_DEFAULT_API_KEY}' 사용이 금지됩니다. "
                    "환경 변수 API_KEY를 안전한 값으로 설정하세요."
                )

        # 개발 환경에서 None이면 기본값 사용
        if v is None and env != "production":
            return _INSECURE_DEFAULT_API_KEY

        return v

    # ===========================================
    # Device Management (공통)
    # ===========================================
    device_heartbeat_timeout: int = 30
    max_concurrent_tasks: int = 100

    # ===========================================
    # Logging (공통)
    # ===========================================
    log_level: str = "INFO"
    log_format: str = "console"  # json 또는 console

    # ===========================================
    # OpenAI (선택)
    # ===========================================
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4-turbo-preview"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # 정의되지 않은 환경변수 무시

    def get_supabase_anon_key_value(self) -> str:
        """Supabase Anon Key의 실제 값 반환 (SecretStr에서 추출)"""
        return self.supabase_anon_key.get_secret_value()

    def get_supabase_service_role_key_value(self) -> str:
        """Supabase Service Role Key의 실제 값 반환 (SecretStr에서 추출)"""
        return self.supabase_service_role_key.get_secret_value()

    def is_production(self) -> bool:
        """프로덕션 환경 여부"""
        return self.env == "production"

    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.env == "development"


# 기존 호환성을 위한 별칭
Settings = APISettings


@lru_cache()
def get_settings() -> APISettings:
    """
    설정 싱글톤 반환

    @lru_cache로 한 번만 로딩하여 성능 최적화
    """
    return APISettings()


# 편의를 위한 글로벌 인스턴스
settings = get_settings()
