"""
LaixiClient 단위 테스트

PR #2: Laixi 연결 회복력 개선
- 지수 백오프 재연결 테스트
- 연결 메트릭 테스트
- 콜백 훅 테스트
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

# 테스트 대상 임포트
from services.api.api.services.laixi_client import (
    LaixiClient,
    LaixiConnectionMetrics,
    get_laixi_client,
    reset_laixi_client,
)


class TestLaixiConnectionMetrics:
    """LaixiConnectionMetrics 데이터클래스 테스트"""

    def test_initial_state(self):
        """초기 상태 확인"""
        metrics = LaixiConnectionMetrics()

        assert metrics.connection_attempts == 0
        assert metrics.connection_successes == 0
        assert metrics.connection_failures == 0
        assert metrics.connection_lost_count == 0
        assert metrics.reconnect_success_count == 0
        assert metrics.is_connected is False
        assert metrics.consecutive_failures == 0

    def test_record_connection_attempt(self):
        """연결 시도 기록"""
        metrics = LaixiConnectionMetrics()

        metrics.record_connection_attempt()
        metrics.record_connection_attempt()

        assert metrics.connection_attempts == 2

    def test_record_connection_success(self):
        """연결 성공 기록"""
        metrics = LaixiConnectionMetrics()
        metrics.consecutive_failures = 3  # 이전 실패 기록

        metrics.record_connection_success()

        assert metrics.connection_successes == 1
        assert metrics.is_connected is True
        assert metrics.consecutive_failures == 0  # 리셋됨
        assert metrics.last_connected_at is not None

    def test_record_connection_success_reconnect(self):
        """재연결 성공 기록"""
        metrics = LaixiConnectionMetrics()

        metrics.record_connection_success(is_reconnect=True)

        assert metrics.reconnect_success_count == 1

    def test_record_connection_failure(self):
        """연결 실패 기록"""
        metrics = LaixiConnectionMetrics()

        metrics.record_connection_failure("Connection refused")
        metrics.record_connection_failure("Timeout")

        assert metrics.connection_failures == 2
        assert metrics.consecutive_failures == 2
        assert metrics.last_error == "Timeout"

    def test_record_connection_lost(self):
        """연결 끊김 기록"""
        metrics = LaixiConnectionMetrics()
        metrics.is_connected = True

        metrics.record_connection_lost()

        assert metrics.connection_lost_count == 1
        assert metrics.is_connected is False
        assert metrics.last_disconnected_at is not None

    def test_to_dict(self):
        """딕셔너리 변환"""
        metrics = LaixiConnectionMetrics()
        metrics.record_connection_success()

        result = metrics.to_dict()

        assert "connection_attempts" in result
        assert "is_connected" in result
        assert result["is_connected"] is True
        assert result["last_connected_at"] is not None


class TestLaixiClientBackoff:
    """지수 백오프 테스트"""

    def test_backoff_settings(self):
        """백오프 설정 확인"""
        client = LaixiClient()

        assert client.BACKOFF_BASE == 1.0
        assert client.BACKOFF_MULTIPLIER == 2.0
        assert client.BACKOFF_MAX == 30.0
        assert client.MAX_RECONNECT_ATTEMPTS == 10

    def test_calculate_backoff_initial(self):
        """초기 백오프 계산 (실패 0회)"""
        client = LaixiClient()

        # consecutive_failures = 0
        delay = client._calculate_backoff()

        assert delay == 1.0  # 1 * 2^0 = 1

    def test_calculate_backoff_after_failures(self):
        """실패 후 백오프 계산"""
        client = LaixiClient()

        # 1회 실패: 1 * 2^1 = 2초
        client._metrics.consecutive_failures = 1
        assert client._calculate_backoff() == 2.0

        # 2회 실패: 1 * 2^2 = 4초
        client._metrics.consecutive_failures = 2
        assert client._calculate_backoff() == 4.0

        # 3회 실패: 1 * 2^3 = 8초
        client._metrics.consecutive_failures = 3
        assert client._calculate_backoff() == 8.0

    def test_calculate_backoff_max_cap(self):
        """백오프 최대값 제한"""
        client = LaixiClient()

        # 10회 실패: 1 * 2^10 = 1024초 -> 30초로 제한
        client._metrics.consecutive_failures = 10
        delay = client._calculate_backoff()

        assert delay == 30.0  # BACKOFF_MAX


class TestLaixiClientCallbacks:
    """콜백 훅 테스트"""

    def test_register_on_connected_callback(self):
        """연결 성공 콜백 등록"""
        client = LaixiClient()

        async def my_callback(c, event):
            pass

        client.on_connected(my_callback)

        assert len(client._on_connected_callbacks) == 1

    def test_register_on_disconnected_callback(self):
        """연결 끊김 콜백 등록"""
        client = LaixiClient()

        async def my_callback(c, event):
            pass

        client.on_disconnected(my_callback)

        assert len(client._on_disconnected_callbacks) == 1

    def test_register_on_reconnect_failed_callback(self):
        """재연결 실패 콜백 등록"""
        client = LaixiClient()

        async def my_callback(c, event):
            pass

        client.on_reconnect_failed(my_callback)

        assert len(client._on_reconnect_failed_callbacks) == 1

    @pytest.mark.asyncio
    async def test_fire_callbacks(self):
        """콜백 실행"""
        client = LaixiClient()
        callback_called = []

        async def my_callback(c, event):
            callback_called.append(event)

        client._on_connected_callbacks.append(my_callback)

        await client._fire_callbacks(client._on_connected_callbacks, "test_event")

        assert "test_event" in callback_called

    @pytest.mark.asyncio
    async def test_fire_callbacks_with_error(self):
        """콜백 실행 중 오류 처리"""
        client = LaixiClient()

        async def failing_callback(c, event):
            raise ValueError("Test error")

        async def success_callback(c, event):
            pass

        client._on_connected_callbacks.append(failing_callback)
        client._on_connected_callbacks.append(success_callback)

        # 오류가 발생해도 다른 콜백은 실행됨
        await client._fire_callbacks(client._on_connected_callbacks, "test")


class TestLaixiClientMetrics:
    """메트릭 접근 테스트"""

    def test_metrics_property(self):
        """metrics 프로퍼티"""
        client = LaixiClient()

        metrics = client.metrics

        assert isinstance(metrics, LaixiConnectionMetrics)

    def test_get_metrics_dict(self):
        """get_metrics 메서드"""
        client = LaixiClient()

        result = client.get_metrics()

        assert isinstance(result, dict)
        assert "is_connected" in result


class TestLaixiClientInit:
    """LaixiClient 초기화 테스트"""

    def test_default_url(self):
        """기본 URL 설정"""
        client = LaixiClient()

        assert client.ws_url == "ws://127.0.0.1:22221/"

    def test_custom_url(self):
        """커스텀 URL 설정"""
        client = LaixiClient(ws_url="ws://192.168.1.100:22221/")

        assert client.ws_url == "ws://192.168.1.100:22221/"

    def test_initial_state(self):
        """초기 상태"""
        client = LaixiClient()

        assert client.ws is None
        assert client._is_reconnecting is False
        assert len(client._on_connected_callbacks) == 0


class TestLaixiClientSingleton:
    """싱글톤 테스트"""

    def test_get_laixi_client_singleton(self):
        """싱글톤 인스턴스"""
        reset_laixi_client()

        client1 = get_laixi_client()
        client2 = get_laixi_client()

        assert client1 is client2

    def test_reset_laixi_client(self):
        """싱글톤 리셋"""
        client1 = get_laixi_client()
        reset_laixi_client()
        client2 = get_laixi_client()

        assert client1 is not client2


class TestBackoffSequence:
    """백오프 시퀀스 테스트"""

    def test_backoff_sequence(self):
        """백오프 시퀀스: 1 -> 2 -> 4 -> 8 -> 16 -> 30 (max)"""
        client = LaixiClient()
        expected = [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]

        for i, expected_delay in enumerate(expected):
            client._metrics.consecutive_failures = i
            actual_delay = client._calculate_backoff()
            assert actual_delay == expected_delay, f"failures={i}: expected {expected_delay}, got {actual_delay}"
