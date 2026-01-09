"""
🔧 DoAi.Me 공통 설정
환경 변수 기반 설정 관리

왜 이 구조인가?
- pydantic-settings로 타입 안전한 환경 변수 로딩
- .env 파일과 환경 변수 모두 지원
- 프로젝트 전체에서 일관된 설정 사용
"""

from functools import lru_cache
from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    애플리케이션 공통 설정

    환경 변수 또는 .env 파일에서 로드됨
    """

    # ===========================================
    # App 메타데이터
    # ===========================================
    app_name: str = "doai-me"
    app_version: str = "2.0.0"
    env: str = "development"  # development, staging, production
    debug: bool = True

    # ===========================================
    # Supabase Configuration (필수)
    # ===========================================
    # 환경 변수에서 반드시 설정되어야 함
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[SecretStr] = None
    supabase_service_role_key: Optional[SecretStr] = None

    # ===========================================
    # Server Configuration
    # ===========================================
    host: str = "0.0.0.0"
    port: int = 8080
    api_prefix: str = "/api/v1"

    # ===========================================
    # Device Management
    # ===========================================
    # 기기 하트비트 타임아웃 (초) - 이 시간 동안 응답 없으면 offline
    device_heartbeat_timeout: int = 30
    # 최대 동시 작업 수
    max_concurrent_tasks: int = 100

    # ===========================================
    # Logging
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

    def get_supabase_anon_key_value(self) -> Optional[str]:
        """Supabase Anon Key의 실제 값 반환 (SecretStr에서 추출)"""
        if self.supabase_anon_key:
            return self.supabase_anon_key.get_secret_value()
        return None

    def get_supabase_service_role_key_value(self) -> Optional[str]:
        """Supabase Service Role Key의 실제 값 반환 (SecretStr에서 추출)"""
        if self.supabase_service_role_key:
            return self.supabase_service_role_key.get_secret_value()
        return None

    def is_production(self) -> bool:
        """프로덕션 환경 여부"""
        return self.env == "production"

    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.env == "development"


@lru_cache()
def get_settings() -> Settings:
    """
    설정 싱글톤 반환

    @lru_cache로 한 번만 로딩하여 성능 최적화
    """
    return Settings()


# 편의를 위한 글로벌 인스턴스
settings = get_settings()
