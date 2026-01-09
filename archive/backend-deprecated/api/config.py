"""
🔧 DoAi.Me Backend Configuration
환경 변수 기반 설정 관리

왜 이 구조인가?
- pydantic-settings로 타입 안전한 환경 변수 로딩
- .env 파일과 환경 변수 모두 지원
- 프로덕션 환경에서는 모든 필수 값 명시적 설정 강제
"""

import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import SecretStr, field_validator


# 안전하지 않은 기본값 상수 (프로덕션에서 거부됨)
_INSECURE_DEFAULT_API_KEY = "dev-api-key-change-in-production"


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # ===========================================
    # Supabase Configuration (필수 - 기본값 없음)
    # ===========================================
    # 환경 변수에서 반드시 설정되어야 함
    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_role_key: SecretStr
    
    # PostgreSQL 직접 연결 (선택)
    database_url: Optional[str] = None
    
    # ===========================================
    # Server Configuration
    # ===========================================
    port: int = 8080
    host: str = "0.0.0.0"
    env: str = "development"  # development, staging, production
    debug: bool = True
    
    # ===========================================
    # API Configuration
    # ===========================================
    api_prefix: str = "/api/v1"
    api_key: Optional[str] = None  # 프로덕션에서는 반드시 명시적 설정 필요
    
    @field_validator('api_key', mode='after')
    @classmethod
    def validate_api_key_not_default_in_production(cls, v: Optional[str], info) -> Optional[str]:
        """
        프로덕션 환경에서 안전하지 않은 기본 API 키 사용 방지
        
        왜 이렇게 작성했는가?
        - 개발 환경에서는 편의를 위해 기본값 허용
        - 프로덕션에서는 보안을 위해 명시적 설정 강제
        """
        # info.data에서 env 값을 가져옴
        env = info.data.get('env', 'development')
        
        if env == "production":
            if v is None:
                raise ValueError(
                    "프로덕션 환경에서는 API_KEY를 반드시 설정해야 합니다."
                )
            if v == _INSECURE_DEFAULT_API_KEY:
                raise ValueError(
                    f"프로덕션 환경에서 안전하지 않은 기본 API 키 '{_INSECURE_DEFAULT_API_KEY}' 사용이 금지됩니다. "
                    "환경 변수 API_KEY를 안전한 값으로 설정하세요."
                )
        
        # 개발 환경에서 None이면 기본값 사용
        if v is None and env != "production":
            return _INSECURE_DEFAULT_API_KEY
        
        return v
    
    # ===========================================
    # Device Management
    # ===========================================
    # 기기 하트비트 타임아웃 (초) - 이 시간 동안 응답 없으면 offline
    device_heartbeat_timeout: int = 30
    # 최대 동시 작업 수
    max_concurrent_tasks: int = 100
    
    # ===========================================
    # CORS Configuration
    # ===========================================
    # 허용된 오리진 목록 (쉼표로 구분)
    # 개발: http://localhost:3000,http://localhost:5173
    # 프로덕션: https://doai.me,https://admin.doai.me
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "GET,POST,PUT,DELETE,OPTIONS,PATCH"
    cors_allow_headers: str = "Authorization,Content-Type,X-Requested-With,X-API-Key"

    @field_validator('cors_origins', mode='after')
    @classmethod
    def validate_cors_origins_in_production(cls, v: str, info) -> str:
        """
        프로덕션 환경에서 와일드카드 CORS 사용 방지
        """
        env = info.data.get('env', 'development')

        if env == "production":
            if v == "*" or "localhost" in v or "127.0.0.1" in v:
                raise ValueError(
                    "프로덕션 환경에서는 localhost나 와일드카드(*) CORS 오리진을 사용할 수 없습니다. "
                    "CORS_ORIGINS를 실제 도메인으로 설정하세요. (예: https://doai.me)"
                )
        return v

    def get_cors_origins_list(self) -> list[str]:
        """CORS 오리진 문자열을 리스트로 변환"""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def get_cors_methods_list(self) -> list[str]:
        """CORS 메서드 문자열을 리스트로 변환"""
        return [method.strip() for method in self.cors_allow_methods.split(",") if method.strip()]

    def get_cors_headers_list(self) -> list[str]:
        """CORS 헤더 문자열을 리스트로 변환"""
        return [header.strip() for header in self.cors_allow_headers.split(",") if header.strip()]

    # ===========================================
    # Rate Limiting Configuration
    # ===========================================
    # 전역 Rate Limit (기본값: 분당 100회)
    rate_limit_default: str = "100/minute"
    # 인증 엔드포인트 (로그인, API 키) - 더 엄격
    rate_limit_auth: str = "10/minute"
    # 검색/조회 엔드포인트 - 여유롭게
    rate_limit_read: str = "200/minute"
    # 쓰기 엔드포인트 (POST, PUT, DELETE) - 중간
    rate_limit_write: str = "50/minute"
    # 헬스체크 - 매우 여유롭게
    rate_limit_health: str = "1000/minute"
    # Rate Limit 활성화 여부
    rate_limit_enabled: bool = True
    # Rate Limit 저장소 타입 (memory, redis)
    rate_limit_storage: str = "memory"
    # Redis URL (rate_limit_storage가 redis일 때 사용)
    rate_limit_redis_url: Optional[str] = None
    # Rate Limit 초과 시 응답 메시지
    rate_limit_message: str = "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."

    # ===========================================
    # Logging
    # ===========================================
    log_level: str = "INFO"

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


@lru_cache()
def get_settings() -> Settings:
    """
    설정 싱글톤 반환
    
    @lru_cache로 한 번만 로딩하여 성능 최적화
    """
    return Settings()


# 편의를 위한 글로벌 인스턴스
settings = get_settings()


