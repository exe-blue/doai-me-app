"""
공통 pytest fixtures

테스트 레벨:
- unit: DB 연결 없이 순수 로직 테스트
- integration: Supabase 연결 필요
- e2e: Laixi + 디바이스 연결 필요
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv(project_root / ".env")

# =============================================================================
# CI 환경을 위한 기본 환경 변수 설정
# Note: 실제 .env 파일이 없는 CI 환경에서도 테스트가 collection될 수 있도록
# 필수 환경 변수에 더미 값을 설정합니다. 이 값들은 실제로 사용되지 않습니다.
# =============================================================================
_CI_DUMMY_SUPABASE_URL = "https://test-ci-dummy.supabase.co"
_CI_DEFAULT_ENV_VARS = {
    "SUPABASE_URL": _CI_DUMMY_SUPABASE_URL,
    "SUPABASE_ANON_KEY": "test-anon-key-for-ci",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key-for-ci",
}

# Track if we're using dummy CI credentials
_USING_CI_DUMMY_CREDENTIALS = False
for key, default_value in _CI_DEFAULT_ENV_VARS.items():
    if key not in os.environ:
        os.environ[key] = default_value
        _USING_CI_DUMMY_CREDENTIALS = True


def has_real_supabase_credentials() -> bool:
    """
    Check if we have real Supabase credentials (not CI dummy values)

    Returns True only if SUPABASE_URL is set to a real project URL
    """
    url = os.getenv("SUPABASE_URL", "")
    # If URL is the dummy value or contains 'test', we don't have real credentials
    if not url:
        return False
    if url == _CI_DUMMY_SUPABASE_URL:
        return False
    if "test" in url.lower() and "supabase.co" not in url:
        return False
    # Real Supabase URLs look like: https://xxxxx.supabase.co
    return ".supabase.co" in url or "localhost" in url


# Expose for use in test files
SKIP_INTEGRATION_TESTS = not has_real_supabase_credentials()


# =============================================================================
# 공통 Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def project_root_path() -> Path:
    """프로젝트 루트 경로"""
    return project_root


# =============================================================================
# Unit Test Fixtures (Mock 기반)
# =============================================================================


@pytest.fixture
def reset_settings_cache():
    """
    Settings 캐시 리셋

    각 테스트에서 새로운 Settings 인스턴스가 필요할 때 사용
    """
    from shared.config.settings import get_settings

    # lru_cache 초기화
    get_settings.cache_clear()
    yield
    # 테스트 후 다시 초기화
    get_settings.cache_clear()


@pytest.fixture
def sample_supabase_env(monkeypatch):
    """Supabase 테스트용 환경 변수 (Unit Test용)"""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key-12345")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key-67890")


@pytest.fixture
def clean_settings_env(monkeypatch):
    """Settings 관련 환경 변수 격리"""
    # DEBUG 환경 변수를 올바른 boolean 값으로 설정
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("ENV", "development")


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase 클라이언트"""
    mock = MagicMock()
    mock.table.return_value.select.return_value.execute.return_value.data = []
    mock.table.return_value.insert.return_value.execute.return_value.data = [{}]
    mock.table.return_value.update.return_value.execute.return_value.data = [{}]
    mock.table.return_value.delete.return_value.execute.return_value.data = [{}]
    return mock


@pytest.fixture
def mock_laixi_client():
    """Mock Laixi WebSocket 클라이언트"""
    mock = AsyncMock()
    mock.connect.return_value = True
    mock.disconnect.return_value = None
    mock.tap.return_value = {"success": True}
    mock.swipe.return_value = {"success": True}
    mock.screenshot.return_value = {"success": True, "data": "base64..."}
    mock.set_clipboard.return_value = {"success": True}
    mock.get_clipboard.return_value = {"success": True, "text": ""}
    mock.execute_adb.return_value = {"success": True, "output": ""}
    mock.press_home.return_value = {"success": True}
    mock.press_back.return_value = {"success": True}
    return mock


# =============================================================================
# 샘플 데이터 Fixtures
# =============================================================================


@pytest.fixture
def sample_video_queue_create():
    """샘플 VideoQueueCreate 데이터"""
    from shared.schemas.youtube_queue import QueueSource, VideoQueueCreate

    return VideoQueueCreate(
        youtube_video_id="dQw4w9WgXcQ",
        title="테스트 영상",
        source=QueueSource.DIRECT,
        duration_seconds=180,
        target_device_percent=0.5,
        like_probability=0.20,
        comment_probability=0.05,
    )


@pytest.fixture
def sample_device_info():
    """샘플 DeviceInfo 데이터"""
    from shared.device_registry import DeviceInfo

    return DeviceInfo(
        id="device-001",
        serial_number="R58M12345678",
        hierarchy_id="WS01-PB01-S01",
        workstation_id="WS01",
        phoneboard_id="WS01-PB01",
        slot_number=1,
        device_group="A",
        status="idle",
        model="SM-G960N",
    )


@pytest.fixture
def sample_video_target():
    """샘플 VideoTarget 데이터"""
    from shared.batch_executor import VideoTarget

    return VideoTarget(
        video_id="dQw4w9WgXcQ",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title="테스트 영상",
        duration_seconds=180,
    )


@pytest.fixture
def sample_batch_config():
    """샘플 BatchConfig 데이터"""
    from shared.schemas.workload import BatchConfig

    return BatchConfig(batch_size_percent=50, batch_interval_seconds=60, cycle_interval_seconds=300)


@pytest.fixture
def sample_watch_config():
    """샘플 WatchConfig 데이터"""
    from shared.schemas.workload import WatchConfig

    return WatchConfig(
        watch_duration_min=30,
        watch_duration_max=120,
        like_probability=0.05,
        comment_probability=0.02,
    )


# =============================================================================
# Integration Test Fixtures (실제 DB 연결)
# =============================================================================


@pytest.fixture(scope="session")
def supabase_client():
    """실제 Supabase 클라이언트 (Integration 테스트용) - api 스키마 사용"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not url or not key:
        pytest.skip("SUPABASE_URL/KEY 환경변수가 필요합니다")

    from supabase import create_client

    client = create_client(url, key)
    # Use 'api' schema instead of default 'public'
    return client.schema("api")


@pytest.fixture
def youtube_queue_service(supabase_client):
    """YouTubeQueueService 인스턴스"""
    from shared.youtube_queue_service import YouTubeQueueService

    return YouTubeQueueService()


@pytest.fixture
def device_registry(supabase_client):
    """DeviceRegistry 인스턴스"""
    from shared.device_registry import DeviceRegistry

    return DeviceRegistry()


# =============================================================================
# E2E Test Fixtures (실제 디바이스 연결)
# =============================================================================


@pytest.fixture
def laixi_client():
    """실제 Laixi 클라이언트 (E2E 테스트용)"""
    laixi_url = os.getenv("LAIXI_WS_URL")
    if not laixi_url:
        pytest.skip("LAIXI_WS_URL 환경변수가 필요합니다")

    from shared.laixi_client import LaixiClient

    return LaixiClient(laixi_url)


@pytest.fixture
def youtube_automation(laixi_client):
    """YouTubeAppAutomation 인스턴스"""
    from shared.scripts.youtube_app_automation import YouTubeAppAutomation

    return YouTubeAppAutomation(laixi_client)


# =============================================================================
# 테스트 유틸리티
# =============================================================================


@pytest.fixture
def unique_video_id():
    """유니크한 테스트 영상 ID 생성"""
    return f"test_{datetime.now(timezone.utc).timestamp()}"


@pytest.fixture
def cleanup_video_queue(supabase_client):
    """테스트 후 video_queue 정리"""
    created_ids = []

    yield created_ids

    # 테스트 후 정리
    for video_id in created_ids:
        try:
            supabase_client.table("video_queue").delete().eq("id", video_id).execute()
        except Exception:
            pass
