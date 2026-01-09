"""
CORS Configuration Unit Tests

환경별 CORS 설정 검증 테스트
- 개발 환경: localhost 허용
- 프로덕션 환경: 실제 도메인만 허용, localhost/와일드카드 거부

Production Domain: doai.me
Production Server: 158.247.210.152 (Vultr)
"""

import pytest
from unittest.mock import patch
import os


class TestCorsConfigurationDevelopment:
    """개발 환경 CORS 설정 테스트"""

    def test_cors_default_origins_development(self, monkeypatch):
        """개발 환경 기본 오리진 확인"""
        # 환경 변수 설정
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        # 캐시 클리어 후 임포트
        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        origins = settings.get_cors_origins_list()
        assert "http://localhost:3000" in origins
        assert "http://localhost:5173" in origins
        assert "http://127.0.0.1:3000" in origins

    def test_cors_localhost_allowed_in_development(self, monkeypatch):
        """개발 환경에서 localhost 허용"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8080")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        # 에러 없이 설정 로드 가능
        settings = get_settings()
        assert "localhost" in settings.cors_origins

    def test_cors_credentials_default(self, monkeypatch):
        """credentials 기본값 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        assert settings.cors_allow_credentials is True

    def test_cors_methods_list(self, monkeypatch):
        """CORS 메서드 리스트 변환"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        methods = settings.get_cors_methods_list()

        assert "GET" in methods
        assert "POST" in methods
        assert "PUT" in methods
        assert "DELETE" in methods
        assert "OPTIONS" in methods
        assert "PATCH" in methods

    def test_cors_headers_list(self, monkeypatch):
        """CORS 헤더 리스트 변환"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        headers = settings.get_cors_headers_list()

        assert "Authorization" in headers
        assert "Content-Type" in headers
        assert "X-API-Key" in headers


class TestCorsConfigurationProduction:
    """프로덕션 환경 CORS 설정 테스트"""

    def test_cors_production_valid_domain(self, monkeypatch):
        """프로덕션에서 유효한 도메인 허용 (doai.me)"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv("CORS_ORIGINS", "https://doai.me,https://www.doai.me,https://admin.doai.me")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert "https://doai.me" in origins
        assert "https://www.doai.me" in origins
        assert "https://admin.doai.me" in origins

    def test_cors_production_vultr_ip_allowed(self, monkeypatch):
        """프로덕션에서 Vultr IP 허용 (158.247.210.152)"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv("CORS_ORIGINS", "https://doai.me,http://158.247.210.152:3000")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert "http://158.247.210.152:3000" in origins

    def test_cors_production_rejects_wildcard(self, monkeypatch):
        """프로덕션에서 와일드카드(*) 거부"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv("CORS_ORIGINS", "*")

        from backend.api.config import get_settings, Settings
        get_settings.cache_clear()

        with pytest.raises(ValueError) as exc_info:
            Settings()

        assert "와일드카드" in str(exc_info.value) or "localhost" in str(exc_info.value)

    def test_cors_production_rejects_localhost(self, monkeypatch):
        """프로덕션에서 localhost 거부"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

        from backend.api.config import get_settings, Settings
        get_settings.cache_clear()

        with pytest.raises(ValueError) as exc_info:
            Settings()

        assert "localhost" in str(exc_info.value)

    def test_cors_production_rejects_127_0_0_1(self, monkeypatch):
        """프로덕션에서 127.0.0.1 거부"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv("CORS_ORIGINS", "http://127.0.0.1:5173")

        from backend.api.config import get_settings, Settings
        get_settings.cache_clear()

        with pytest.raises(ValueError) as exc_info:
            Settings()

        assert "127.0.0.1" in str(exc_info.value) or "localhost" in str(exc_info.value)


class TestCorsOriginsParsing:
    """CORS 오리진 파싱 테스트"""

    def test_cors_origins_comma_separated(self, monkeypatch):
        """쉼표로 구분된 오리진 파싱"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://a.com,http://b.com,http://c.com")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert len(origins) == 3
        assert "http://a.com" in origins
        assert "http://b.com" in origins
        assert "http://c.com" in origins

    def test_cors_origins_with_spaces(self, monkeypatch):
        """공백 포함 오리진 파싱 (trim)"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://a.com , http://b.com , http://c.com")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert "http://a.com" in origins
        assert "http://b.com" in origins
        assert "http://c.com" in origins
        # 공백이 trim 되었는지 확인
        assert " http://b.com" not in origins

    def test_cors_origins_empty_entries_filtered(self, monkeypatch):
        """빈 항목 필터링"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://a.com,,http://b.com,")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert len(origins) == 2
        assert "" not in origins


class TestCorsIntegrationWithFastAPI:
    """FastAPI CORS 미들웨어 통합 테스트"""

    def test_cors_middleware_applied(self, monkeypatch):
        """CORS 미들웨어가 FastAPI 앱에 적용되는지 확인"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        # FastAPI 앱 임포트 시 CORS 미들웨어가 적용됨
        from backend.api.main import app

        # 미들웨어 스택에서 CORS 확인
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes

    def test_cors_preflight_request(self, monkeypatch):
        """CORS preflight (OPTIONS) 요청 테스트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from fastapi.testclient import TestClient
        from backend.api.main import app

        client = TestClient(app)

        # Preflight 요청
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            }
        )

        # CORS 헤더 확인
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_cors_actual_request_allowed_origin(self, monkeypatch):
        """허용된 오리진에서 실제 요청"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from fastapi.testclient import TestClient
        from backend.api.main import app

        client = TestClient(app)

        response = client.get(
            "/health",
            headers={"Origin": "http://localhost:3000"}
        )

        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_cors_actual_request_disallowed_origin(self, monkeypatch):
        """허용되지 않은 오리진에서 실제 요청"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        from fastapi.testclient import TestClient
        from backend.api.main import app

        client = TestClient(app)

        response = client.get(
            "/health",
            headers={"Origin": "http://evil.com"}
        )

        # 요청은 처리되지만 CORS 헤더가 없거나 다름
        assert response.status_code == 200
        # 허용되지 않은 오리진이므로 access-control-allow-origin이 없거나 다른 값
        cors_header = response.headers.get("access-control-allow-origin")
        assert cors_header != "http://evil.com"


class TestCorsProductionDoaiMe:
    """DoAi.Me 프로덕션 환경 특화 테스트"""

    def test_doai_me_production_config(self, monkeypatch):
        """doai.me 프로덕션 설정 테스트"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv(
            "CORS_ORIGINS",
            "https://doai.me,https://www.doai.me,https://admin.doai.me,https://api.doai.me"
        )

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        # 모든 doai.me 서브도메인 허용
        assert "https://doai.me" in origins
        assert "https://www.doai.me" in origins
        assert "https://admin.doai.me" in origins
        assert "https://api.doai.me" in origins

    def test_vultr_server_access(self, monkeypatch):
        """Vultr 서버 직접 접근 허용 (158.247.210.152)"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_KEY", "secure-production-key-12345")
        monkeypatch.setenv(
            "CORS_ORIGINS",
            "https://doai.me,http://158.247.210.152:3000,http://158.247.210.152:8080"
        )

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        origins = settings.get_cors_origins_list()

        assert "http://158.247.210.152:3000" in origins
        assert "http://158.247.210.152:8080" in origins


class TestCorsEnvironmentVariableOverride:
    """환경 변수 오버라이드 테스트"""

    def test_cors_methods_override(self, monkeypatch):
        """CORS 메서드 환경 변수 오버라이드"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ALLOW_METHODS", "GET,POST")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        methods = settings.get_cors_methods_list()

        assert methods == ["GET", "POST"]
        assert "DELETE" not in methods

    def test_cors_headers_override(self, monkeypatch):
        """CORS 헤더 환경 변수 오버라이드"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ALLOW_HEADERS", "X-Custom-Header,Authorization")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()
        headers = settings.get_cors_headers_list()

        assert "X-Custom-Header" in headers
        assert "Authorization" in headers

    def test_cors_credentials_override(self, monkeypatch):
        """CORS credentials 환경 변수 오버라이드"""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_ANON_KEY", "test-key")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
        monkeypatch.setenv("ENV", "development")
        monkeypatch.setenv("CORS_ALLOW_CREDENTIALS", "false")

        from backend.api.config import get_settings
        get_settings.cache_clear()

        settings = get_settings()

        assert settings.cors_allow_credentials is False
