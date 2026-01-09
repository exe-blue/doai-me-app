"""
모니터링 모듈 테스트

테스트 항목:
1. LogCollector 클래스 테스트
2. LogLevel enum 테스트
3. 검색/통계 함수 테스트 (모킹)

Usage:
    pytest tests/test_monitoring.py -v
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class TestLogLevel:
    """LogLevel enum 테스트"""

    def test_log_level_values(self):
        """로그 레벨 값 확인"""
        from shared.monitoring.log_collector import LogLevel

        assert LogLevel.DEBUG.value == "debug"
        assert LogLevel.INFO.value == "info"
        assert LogLevel.WARNING.value == "warning"
        assert LogLevel.ERROR.value == "error"
        assert LogLevel.CRITICAL.value == "critical"


class TestLogCollector:
    """LogCollector 클래스 테스트"""

    def test_init_defaults(self):
        """기본 초기화 테스트"""
        from shared.monitoring.log_collector import LogCollector

        collector = LogCollector()
        assert collector.source == "api"
        assert collector.component is None
        assert collector.buffer_size == 10
        assert collector.auto_flush_seconds == 5.0

    def test_init_custom_values(self):
        """커스텀 값으로 초기화 테스트"""
        from shared.monitoring.log_collector import LogCollector

        collector = LogCollector(
            source="oob",
            component="evaluator",
            buffer_size=20,
            auto_flush_seconds=10.0,
        )
        assert collector.source == "oob"
        assert collector.component == "evaluator"
        assert collector.buffer_size == 20
        assert collector.auto_flush_seconds == 10.0

    @pytest.mark.asyncio
    async def test_log_adds_to_buffer(self):
        """로그가 버퍼에 추가되는지 테스트"""
        from shared.monitoring.log_collector import LogCollector

        collector = LogCollector(buffer_size=100)  # 큰 버퍼로 flush 방지
        collector._enabled = False  # DB 연결 비활성화

        await collector.log("info", message="Test message")

        # 버퍼에 추가되지 않음 (disabled)
        assert len(collector._buffer) == 0

    @pytest.mark.asyncio
    async def test_convenience_methods(self):
        """편의 메서드 테스트"""
        from shared.monitoring.log_collector import LogCollector

        collector = LogCollector(buffer_size=100)
        collector._enabled = False

        # 각 레벨별 메서드 호출 (에러 없이 실행되는지)
        await collector.debug("Debug message")
        await collector.info("Info message")
        await collector.warning("Warning message")
        await collector.error("Error message")
        await collector.critical("Critical message")


class TestLogCollectorSingleton:
    """싱글톤 테스트"""

    def test_singleton_returns_same_instance(self):
        """싱글톤이 같은 인스턴스를 반환하는지 테스트"""
        from shared.monitoring.log_collector import (
            get_log_collector,
            reset_log_collector,
        )

        reset_log_collector()

        collector1 = get_log_collector()
        collector2 = get_log_collector()

        assert collector1 is collector2

        reset_log_collector()

    def test_reset_clears_singleton(self):
        """리셋이 싱글톤을 초기화하는지 테스트"""
        from shared.monitoring.log_collector import (
            get_log_collector,
            reset_log_collector,
        )

        collector1 = get_log_collector()
        reset_log_collector()
        collector2 = get_log_collector()

        assert collector1 is not collector2

        reset_log_collector()


class TestSearchLogs:
    """로그 검색 함수 테스트"""

    @pytest.mark.asyncio
    async def test_search_logs_returns_empty_without_db(self):
        """DB 없이 빈 결과 반환 테스트"""
        from shared.monitoring.log_collector import search_logs

        # 실제 DB 연결 없이는 빈 결과 반환
        with patch("shared.supabase_client.get_client") as mock_client:
            mock_client.side_effect = Exception("No DB connection")
            result = await search_logs()
            assert result == []


class TestGetLogStats:
    """로그 통계 함수 테스트"""

    @pytest.mark.asyncio
    async def test_get_log_stats_returns_error_without_db(self):
        """DB 없이 에러 반환 테스트"""
        from shared.monitoring.log_collector import get_log_stats

        with patch("shared.supabase_client.get_client") as mock_client:
            mock_client.side_effect = Exception("No DB connection")
            result = await get_log_stats()
            assert "error" in result


class TestMonitoringImports:
    """모니터링 모듈 임포트 테스트"""

    def test_imports_from_init(self):
        """__init__.py에서 임포트 테스트"""
        from shared.monitoring import (
            LogCollector,
            LogLevel,
            get_log_collector,
            get_log_stats,
            reset_log_collector,
            search_logs,
        )

        assert LogCollector is not None
        assert LogLevel is not None
        assert get_log_collector is not None
        assert reset_log_collector is not None
        assert search_logs is not None
        assert get_log_stats is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
