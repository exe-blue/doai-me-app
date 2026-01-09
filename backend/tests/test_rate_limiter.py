"""
Rate Limiter Unit Tests

Rate Limiting 기능 검증 테스트
- 기본 Rate Limit 적용
- 엔드포인트별 차등 제한
- 429 응답 및 Retry-After 헤더
- 화이트리스트 동작

Production Domain: doai.me
Production Server: 158.247.210.152 (Vultr)
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


class TestRateLimiterConfiguration:
    """Rate Limiter 설정 테스트"""

    def test_rate_limit_settings_default(self, monkeypatch):
        """Rate Limit 기본 설정값 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.rate_limit_default == "100/minute"
        assert settings.rate_limit_auth == "10/minute"
        assert settings.rate_limit_read == "200/minute"
        assert settings.rate_limit_write == "50/minute"
        assert settings.rate_limit_health == "1000/minute"
        assert settings.rate_limit_enabled is True
        assert settings.rate_limit_storage == "memory"

    def test_rate_limit_settings_custom(self, monkeypatch):
        """Rate Limit 커스텀 설정값 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("RATE_LIMIT_DEFAULT", "50/minute")
        monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.rate_limit_default == "50/minute"
        assert settings.rate_limit_enabled is False

    def test_rate_limit_redis_config(self, monkeypatch):
        """Redis 저장소 설정 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("RATE_LIMIT_STORAGE", "redis")
        monkeypatch.setenv("RATE_LIMIT_REDIS_URL", "redis://localhost:6379")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.rate_limit_storage == "redis"
        assert settings.rate_limit_redis_url == "redis://localhost:6379"


class TestRateLimiterIdentifier:
    """Rate Limiter 식별자 테스트"""

    def test_get_identifier_ip_based(self, monkeypatch):
        """IP 기반 식별자 생성"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import get_identifier
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "192.168.1.100"

        identifier = get_identifier(mock_request)
        assert identifier.startswith("ip:")

    def test_get_identifier_api_key_based(self, monkeypatch):
        """API Key 기반 식별자 생성"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import get_identifier
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.headers = {"X-API-Key": "my-secret-api-key-12345"}
        mock_request.client.host = "192.168.1.100"

        identifier = get_identifier(mock_request)
        assert identifier.startswith("key:")
        assert "my-secret-api-key" in identifier

    def test_get_real_client_ip_direct(self, monkeypatch):
        """직접 연결 IP 추출"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import get_real_client_ip
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "10.0.0.50"

        ip = get_real_client_ip(mock_request)
        assert ip == "10.0.0.50"

    def test_get_real_client_ip_forwarded(self, monkeypatch):
        """X-Forwarded-For 헤더에서 IP 추출"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import get_real_client_ip
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.headers = {"X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178"}
        mock_request.client.host = "10.0.0.1"

        ip = get_real_client_ip(mock_request)
        assert ip == "203.0.113.50"

    def test_get_real_client_ip_real_ip_header(self, monkeypatch):
        """X-Real-IP 헤더에서 IP 추출"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import get_real_client_ip
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.headers = {"X-Real-IP": "198.51.100.25"}
        mock_request.client.host = "10.0.0.1"

        ip = get_real_client_ip(mock_request)
        assert ip == "198.51.100.25"


class TestRateLimiterWhitelist:
    """Rate Limiter 화이트리스트 테스트"""

    def test_whitelist_localhost(self, monkeypatch):
        """localhost는 화이트리스트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import is_whitelisted, RATE_LIMIT_WHITELIST_IPS
        from unittest.mock import MagicMock

        assert "127.0.0.1" in RATE_LIMIT_WHITELIST_IPS

        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        mock_request.url.path = "/api/test"

        assert is_whitelisted(mock_request) is True

    def test_whitelist_vultr_server(self, monkeypatch):
        """Vultr 서버 IP는 화이트리스트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import is_whitelisted, RATE_LIMIT_WHITELIST_IPS
        from unittest.mock import MagicMock

        assert "158.247.210.152" in RATE_LIMIT_WHITELIST_IPS

    def test_whitelist_docs_path(self, monkeypatch):
        """문서 경로는 화이트리스트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import is_whitelisted, RATE_LIMIT_WHITELIST_PATHS
        from unittest.mock import MagicMock

        assert "/docs" in RATE_LIMIT_WHITELIST_PATHS
        assert "/redoc" in RATE_LIMIT_WHITELIST_PATHS

        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "203.0.113.50"
        mock_request.url.path = "/docs"

        assert is_whitelisted(mock_request) is True


class TestRateLimiterIntegration:
    """Rate Limiter FastAPI 통합 테스트"""

    def test_rate_limit_middleware_applied(self, monkeypatch):
        """Rate Limit 미들웨어가 적용되는지 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.main import app

        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "SlowAPIMiddleware" in middleware_classes

    def test_rate_limit_status_endpoint(self, monkeypatch):
        """Rate Limit 상태 조회 엔드포인트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.main import app

        client = TestClient(app)
        response = client.get("/api/rate-limit-status")

        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "limits" in data
        assert "default" in data["limits"]

    def test_health_endpoint_with_rate_limit(self, monkeypatch):
        """헬스 체크 엔드포인트 Rate Limit"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.main import app

        client = TestClient(app)

        # 정상 요청
        response = client.get("/health")
        assert response.status_code == 200

    def test_rate_limit_exceeded_response(self, monkeypatch):
        """Rate Limit 초과 시 429 응답"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("RATE_LIMIT_HEALTH", "2/minute")  # 매우 낮은 한도

        from backend.api.config import get_settings
        get_settings.cache_clear()

        # 새 limiter 인스턴스 필요 (설정 변경 반영)
        # 실제 테스트에서는 limiter 모듈도 재로드 필요

        from backend.api.rate_limiter import rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded
        from unittest.mock import MagicMock, AsyncMock
        import asyncio

        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "192.168.1.100"
        mock_request.url.path = "/health"

        exc = RateLimitExceeded(detail="2 per 1 minute")

        # 핸들러 호출
        response = asyncio.get_event_loop().run_until_complete(
            rate_limit_exceeded_handler(mock_request, exc)
        )

        assert response.status_code == 429
        assert "Retry-After" in response.headers


class TestRateLimiterDecorators:
    """Rate Limit 데코레이터 테스트"""

    def test_limit_decorators_available(self, monkeypatch):
        """Rate Limit 데코레이터들이 사용 가능한지 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import (
            limit_default,
            limit_auth,
            limit_read,
            limit_write,
            limit_health,
            limit_custom,
        )

        assert callable(limit_default)
        assert callable(limit_auth)
        assert callable(limit_read)
        assert callable(limit_write)
        assert callable(limit_health)
        assert callable(limit_custom)

    def test_limit_custom_decorator(self, monkeypatch):
        """커스텀 Rate Limit 데코레이터"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from backend.api.rate_limiter import limit_custom

        decorator = limit_custom("5/minute")
        assert callable(decorator)

        # 함수에 적용
        async def test_func():
            return "ok"

        decorated = decorator(test_func)
        assert callable(decorated)


class TestRateLimiterProduction:
    """프로덕션 환경 Rate Limiter 테스트"""

    def test_production_rate_limits(self, monkeypatch):
        """프로덕션 환경 Rate Limit 설정"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key")
        monkeypatch.setenv("CORS_ORIGINS", "https://doai.me")
        monkeypatch.setenv("RATE_LIMIT_DEFAULT", "60/minute")  # 더 엄격

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.rate_limit_default == "60/minute"
        assert settings.rate_limit_enabled is True

    def test_doai_me_rate_limit_message(self, monkeypatch):
        """doai.me용 커스텀 Rate Limit 메시지"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("RATE_LIMIT_MESSAGE", "DoAi.Me 요청 한도 초과")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.rate_limit_message == "DoAi.Me 요청 한도 초과"
