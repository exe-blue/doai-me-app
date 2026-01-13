"""
공통 pytest fixtures

테스트 레벨:
- unit: DB 연결 없이 순수 로직 테스트
- integration: Supabase 연결 필요
- e2e: Laixi + 디바이스 연결 필요
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Generator
from unittest.mock import AsyncMock, MagicMock

import pytest

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")


# =============================================================================
# Integration Test Flag
# =============================================================================

# Skip integration tests if Supabase credentials are not available
SKIP_INTEGRATION_TESTS = not (
    os.getenv("SUPABASE_URL") and
    (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY"))
)


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
    from shared.schemas.youtube_queue import VideoQueueCreate, QueueSource
    return VideoQueueCreate(
        youtube_video_id="dQw4w9WgXcQ",
        title="테스트 영상",
        source=QueueSource.DIRECT,
        duration_seconds=180,
        target_device_percent=0.5,
        like_probability=0.20,
        comment_probability=0.05
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
        model="SM-G960N"
    )


@pytest.fixture
def sample_video_target():
    """샘플 VideoTarget 데이터"""
    from shared.batch_executor import VideoTarget
    return VideoTarget(
        video_id="dQw4w9WgXcQ",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title="테스트 영상",
        duration_seconds=180
    )


@pytest.fixture
def sample_batch_config():
    """샘플 BatchConfig 데이터"""
    from shared.schemas.workload import BatchConfig
    return BatchConfig(
        device_percent=0.5,
        batch_interval_seconds=60,
        randomize_interval=True,
        min_interval_seconds=30,
        max_interval_seconds=120
    )


@pytest.fixture
def sample_watch_config():
    """샘플 WatchConfig 데이터"""
    from shared.schemas.workload import WatchConfig
    return WatchConfig(
        min_watch_percent=0.7,
        max_watch_percent=1.0,
        like_probability=0.20,
        comment_probability=0.05,
        random_pause_chance=0.1
    )


# =============================================================================
# Integration Test Fixtures (실제 DB 연결)
# =============================================================================

@pytest.fixture(scope="session")
def supabase_client():
    """실제 Supabase 클라이언트 (Integration 테스트용)"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        pytest.skip("SUPABASE_URL/KEY 환경변수가 필요합니다")
    
    from supabase import create_client
    return create_client(url, key)


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
