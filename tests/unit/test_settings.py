"""
🧪 Settings 단위 테스트
shared/config/settings.py 테스트

환경 변수 격리를 위해 conftest.py의 clean_env_for_settings fixture 사용
"""

import pytest


class TestSettings:
    """Settings 클래스 테스트"""

    def test_settings_app_name(self, reset_settings_cache):
        """앱 이름 기본값 확인"""
        from shared.config.settings import Settings

        settings = Settings()
        assert settings.app_name == "doai-me"

    def test_settings_app_version(self, reset_settings_cache):
        """앱 버전 기본값 확인"""
        from shared.config.settings import Settings

        settings = Settings()
        assert settings.app_version == "2.0.0"

    def test_settings_default_values(self, reset_settings_cache):
        """기본값 확인"""
        from shared.config.settings import Settings

        settings = Settings()

        assert settings.port == 8080
        assert settings.log_level == "INFO"
        assert settings.host == "0.0.0.0"
        assert settings.api_prefix == "/api/v1"

    def test_settings_env_override(self, reset_settings_cache, monkeypatch):
        """환경 변수로 설정 오버라이드"""
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        monkeypatch.setenv("PORT", "9000")

        from shared.config.settings import Settings

        fresh_settings = Settings()

        assert fresh_settings.log_level == "DEBUG"
        assert fresh_settings.port == 9000

    def test_settings_is_production(self, reset_settings_cache, monkeypatch):
        """프로덕션 환경 판별"""
        monkeypatch.setenv("ENV", "production")

        from shared.config.settings import Settings

        settings = Settings()

        assert settings.is_production() is True
        assert settings.is_development() is False

    def test_settings_is_development(self, reset_settings_cache, monkeypatch):
        """개발 환경 판별"""
        monkeypatch.setenv("ENV", "development")

        from shared.config.settings import Settings

        settings = Settings()

        assert settings.is_development() is True
        assert settings.is_production() is False

    def test_settings_debug_true(self, reset_settings_cache, monkeypatch):
        """DEBUG=true 파싱 확인"""
        monkeypatch.setenv("DEBUG", "true")

        from shared.config.settings import Settings

        settings = Settings()
        assert settings.debug is True

    def test_settings_debug_false(self, reset_settings_cache, monkeypatch):
        """DEBUG=false 파싱 확인"""
        monkeypatch.setenv("DEBUG", "false")

        from shared.config.settings import Settings

        settings = Settings()
        assert settings.debug is False

    def test_settings_supabase_key_methods(
        self, reset_settings_cache, sample_supabase_env
    ):
        """Supabase 키 메서드 테스트"""
        from shared.config.settings import Settings

        settings = Settings()

        assert settings.get_supabase_anon_key_value() == "test-anon-key-12345"
        assert (
            settings.get_supabase_service_role_key_value()
            == "test-service-role-key-67890"
        )

    def test_settings_optional_supabase_keys(self, reset_settings_cache):
        """Supabase 키가 없을 때 None 반환"""
        from shared.config.settings import Settings

        settings = Settings()

        # 환경 변수가 설정되지 않은 경우 None 반환
        assert settings.get_supabase_anon_key_value() is None
        assert settings.get_supabase_service_role_key_value() is None

    def test_settings_device_management_defaults(self, reset_settings_cache):
        """디바이스 관리 기본값 확인"""
        from shared.config.settings import Settings

        settings = Settings()

        assert settings.device_heartbeat_timeout == 30
        assert settings.max_concurrent_tasks == 100

    def test_settings_openai_defaults(self, reset_settings_cache):
        """OpenAI 설정 기본값 확인"""
        from shared.config.settings import Settings

        settings = Settings()

        assert settings.openai_api_key is None
        assert settings.openai_model == "gpt-4-turbo-preview"


class TestGetSettings:
    """get_settings 함수 테스트"""

    def test_get_settings_returns_settings(self, reset_settings_cache):
        """get_settings가 Settings 인스턴스 반환"""
        from shared.config.settings import Settings, get_settings

        settings = get_settings()

        assert isinstance(settings, Settings)

    def test_get_settings_singleton(self, reset_settings_cache):
        """get_settings가 동일 인스턴스 반환 (캐싱)"""
        from shared.config.settings import get_settings

        settings1 = get_settings()
        settings2 = get_settings()

        assert settings1 is settings2

    def test_get_settings_cache_clear(self, reset_settings_cache, monkeypatch):
        """캐시 클리어 후 새 인스턴스 생성"""
        from shared.config.settings import get_settings

        settings1 = get_settings()
        get_settings.cache_clear()

        # 환경 변수 변경
        monkeypatch.setenv("LOG_LEVEL", "WARNING")

        settings2 = get_settings()

        # 새 인스턴스이므로 다른 객체
        assert settings1 is not settings2
        assert settings2.log_level == "WARNING"
