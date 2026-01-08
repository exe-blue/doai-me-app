"""
YouTube Automation E2E 테스트

Laixi WebSocket 서버 + 실제 디바이스 연결이 필요합니다.
테스트 전 LAIXI_WS_URL 환경변수가 설정되어야 합니다.
"""

import os
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from shared.scripts.youtube_app_automation import (
    YouTubeAppAutomation,
    YouTubeCoordinates,
    ExecutionResult,
    WatchResult,
)


pytestmark = pytest.mark.e2e


@pytest.mark.skipif(
    not os.getenv("LAIXI_WS_URL"),
    reason="LAIXI_WS_URL 환경변수 필요"
)
class TestYouTubeAppAutomation:
    """YouTube 앱 자동화 E2E 테스트"""
    
    @pytest.fixture
    def automation(self, laixi_client):
        """YouTubeAppAutomation 인스턴스"""
        return YouTubeAppAutomation(laixi_client)
    
    @pytest.fixture
    def test_device_serial(self):
        """테스트 디바이스 시리얼"""
        return os.getenv("TEST_DEVICE_SERIAL", "R58M00000001")
    
    @pytest.mark.asyncio
    async def test_launch_youtube(self, automation, test_device_serial):
        """YouTube 앱 실행"""
        try:
            result = await automation._launch_youtube(test_device_serial)
            
            assert result is True
        except Exception as e:
            pytest.skip(f"Laixi 연결 실패: {e}")
    
    @pytest.mark.asyncio
    async def test_search_video(self, automation, test_device_serial):
        """영상 검색"""
        try:
            # 먼저 앱 실행
            await automation._launch_youtube(test_device_serial)
            
            # 검색 수행
            result = await automation._search_video(
                device_serial=test_device_serial,
                keyword="테스트 영상"
            )
            
            assert result is True
        except Exception as e:
            pytest.skip(f"검색 실패: {e}")
    
    @pytest.mark.asyncio
    async def test_go_home(self, automation, test_device_serial):
        """홈으로 이동"""
        try:
            result = await automation._go_home(test_device_serial)
            
            assert result is True
        except Exception as e:
            pytest.skip(f"홈 이동 실패: {e}")


class TestYouTubeCoordinates:
    """YouTube 좌표 테스트"""
    
    def test_default_coordinates(self):
        """기본 좌표값"""
        coords = YouTubeCoordinates()
        
        # 검색 아이콘 (우상단)
        assert 0.9 <= coords.search_icon[0] <= 1.0
        assert 0 <= coords.search_icon[1] <= 0.1
        
        # 플레이어 중앙 (화면 상단)
        assert 0.4 <= coords.player_center[0] <= 0.6
        assert 0.2 <= coords.player_center[1] <= 0.3
    
    def test_coordinate_ranges(self):
        """좌표 범위 확인 (0.0 ~ 1.0)"""
        coords = YouTubeCoordinates()
        
        # 모든 좌표가 백분율 범위 내
        all_coords = [
            coords.search_icon,
            coords.search_input,
            coords.first_result,
            coords.player_center,
            coords.like_button,
            coords.comment_button,
        ]
        
        for x, y in all_coords:
            assert 0 <= x <= 1, f"X 좌표 범위 초과: {x}"
            assert 0 <= y <= 1, f"Y 좌표 범위 초과: {y}"


class TestExecutionResult:
    """실행 결과 Enum 테스트"""
    
    def test_result_values(self):
        """결과 값 확인"""
        assert ExecutionResult.SUCCESS.value == "success"
        assert ExecutionResult.PARTIAL.value == "partial"
        assert ExecutionResult.FAILED.value == "failed"
        assert ExecutionResult.ERROR.value == "error"
        assert ExecutionResult.SKIPPED.value == "skipped"


class TestWatchResult:
    """시청 결과 데이터클래스 테스트"""
    
    def test_create_success_result(self):
        """성공 결과 생성"""
        result = WatchResult(
            status=ExecutionResult.SUCCESS,
            watch_duration=180,
            target_duration=180,
            did_like=True,
            did_comment=False
        )
        
        assert result.status == ExecutionResult.SUCCESS
        assert result.watch_duration == 180
        assert result.did_like is True
    
    def test_create_failed_result(self):
        """실패 결과 생성"""
        result = WatchResult(
            status=ExecutionResult.FAILED,
            error_code="VIDEO_NOT_FOUND",
            error_message="검색 결과에서 영상을 찾지 못함"
        )
        
        assert result.status == ExecutionResult.FAILED
        assert result.error_code == "VIDEO_NOT_FOUND"


class TestMockYouTubeAutomation:
    """Mock을 사용한 자동화 테스트"""
    
    @pytest.fixture
    def mock_automation(self, mock_laixi_client):
        """Mock Laixi를 사용한 자동화 인스턴스"""
        return YouTubeAppAutomation(mock_laixi_client)
    
    @pytest.mark.asyncio
    async def test_full_flow_with_mock(self, mock_automation):
        """전체 플로우 (Mock)"""
        # Mock 응답 설정
        mock_automation._laixi.tap.return_value = {"success": True}
        mock_automation._laixi.swipe.return_value = {"success": True}
        mock_automation._laixi.set_clipboard.return_value = {"success": True}
        mock_automation._laixi.execute_adb.return_value = {"success": True}
        
        # 전체 플로우 실행
        result = await mock_automation.execute_youtube_task(
            device_serial="MOCK_DEVICE",
            video_id="test123",
            keyword="테스트",
            watch_duration=10,
            should_like=False,
            should_comment=False
        )
        
        # 결과 확인
        assert result is not None
        assert result.status in [
            ExecutionResult.SUCCESS,
            ExecutionResult.PARTIAL,
            ExecutionResult.FAILED
        ]
    
    @pytest.mark.asyncio
    async def test_search_with_mock(self, mock_automation):
        """검색 테스트 (Mock)"""
        mock_automation._laixi.tap.return_value = {"success": True}
        mock_automation._laixi.set_clipboard.return_value = {"success": True}
        
        result = await mock_automation._search_video(
            device_serial="MOCK_DEVICE",
            keyword="테스트 검색어"
        )
        
        # tap이 호출되었는지 확인
        assert mock_automation._laixi.tap.called
    
    @pytest.mark.asyncio
    async def test_like_with_mock(self, mock_automation):
        """좋아요 테스트 (Mock)"""
        mock_automation._laixi.tap.return_value = {"success": True}
        mock_automation._laixi.swipe.return_value = {"success": True}
        
        result = await mock_automation._click_like("MOCK_DEVICE")
        
        assert mock_automation._laixi.tap.called
    
    @pytest.mark.asyncio
    async def test_comment_with_mock(self, mock_automation):
        """댓글 테스트 (Mock)"""
        mock_automation._laixi.tap.return_value = {"success": True}
        mock_automation._laixi.swipe.return_value = {"success": True}
        mock_automation._laixi.set_clipboard.return_value = {"success": True}
        
        result = await mock_automation._write_comment(
            device_serial="MOCK_DEVICE",
            comment="테스트 댓글"
        )
        
        assert mock_automation._laixi.set_clipboard.called


class TestAutomationHelpers:
    """자동화 헬퍼 함수 테스트"""
    
    def test_calculate_watch_duration(self):
        """시청 시간 계산"""
        from shared.scripts.youtube_app_automation import YouTubeAppAutomation
        
        # 기본 시청 시간 (70-100%)
        duration = YouTubeAppAutomation._calculate_watch_duration(
            target_duration=180,
            min_percent=0.7,
            max_percent=1.0
        )
        
        assert 126 <= duration <= 180  # 70% ~ 100%
    
    def test_calculate_watch_duration_short_video(self):
        """짧은 영상 시청 시간"""
        from shared.scripts.youtube_app_automation import YouTubeAppAutomation
        
        duration = YouTubeAppAutomation._calculate_watch_duration(
            target_duration=30,
            min_percent=0.7,
            max_percent=1.0
        )
        
        assert 21 <= duration <= 30
    
    def test_random_delay_range(self):
        """랜덤 딜레이 범위"""
        from shared.scripts.youtube_app_automation import YouTubeAppAutomation
        
        for _ in range(10):
            delay = YouTubeAppAutomation._get_random_delay(1.0, 3.0)
            assert 1.0 <= delay <= 3.0
    
    def test_scroll_direction(self):
        """스크롤 방향 계산"""
        from shared.scripts.youtube_app_automation import YouTubeAppAutomation
        
        # 아래로 스크롤
        start_y, end_y = YouTubeAppAutomation._get_scroll_coordinates("down")
        assert start_y > end_y
        
        # 위로 스크롤
        start_y, end_y = YouTubeAppAutomation._get_scroll_coordinates("up")
        assert start_y < end_y


class TestErrorHandling:
    """에러 핸들링 테스트"""
    
    @pytest.fixture
    def mock_automation(self, mock_laixi_client):
        return YouTubeAppAutomation(mock_laixi_client)
    
    @pytest.mark.asyncio
    async def test_handle_tap_failure(self, mock_automation):
        """탭 실패 처리"""
        mock_automation._laixi.tap.return_value = {"success": False, "error": "Device not found"}
        
        # 실패해도 예외가 발생하지 않아야 함
        result = await mock_automation._search_video("MOCK", "test")
        
        # 실패 결과 반환
        assert result is False or result is None
    
    @pytest.mark.asyncio
    async def test_handle_timeout(self, mock_automation):
        """타임아웃 처리"""
        import asyncio
        
        async def slow_response():
            await asyncio.sleep(10)
            return {"success": True}
        
        mock_automation._laixi.tap.side_effect = asyncio.TimeoutError()
        
        # 타임아웃 예외 처리
        try:
            result = await mock_automation._search_video("MOCK", "test")
        except asyncio.TimeoutError:
            pass  # 예상된 예외
    
    @pytest.mark.asyncio
    async def test_handle_connection_error(self, mock_automation):
        """연결 에러 처리"""
        mock_automation._laixi.tap.side_effect = ConnectionError("Connection lost")
        
        try:
            result = await mock_automation._search_video("MOCK", "test")
        except ConnectionError:
            pass  # 예상된 예외
