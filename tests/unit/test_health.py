"""
🧪 Health 단위 테스트
shared/monitoring/health.py 테스트
"""

import pytest

from shared.monitoring import ComponentHealth, HealthChecker, HealthCheckResult, HealthStatus


class TestHealthStatus:
    """HealthStatus enum 테스트"""

    def test_health_status_values(self):
        """상태 값 확인"""
        assert HealthStatus.HEALTHY.value == "healthy"
        assert HealthStatus.DEGRADED.value == "degraded"
        assert HealthStatus.UNHEALTHY.value == "unhealthy"


class TestComponentHealth:
    """ComponentHealth dataclass 테스트"""

    def test_component_health_creation(self):
        """ComponentHealth 생성"""
        component = ComponentHealth(
            name="database",
            status=HealthStatus.HEALTHY,
            latency_ms=5.2,
        )

        assert component.name == "database"
        assert component.status == HealthStatus.HEALTHY
        assert component.latency_ms == 5.2
        assert component.message is None

    def test_component_health_with_message(self):
        """메시지 포함 ComponentHealth"""
        component = ComponentHealth(
            name="redis",
            status=HealthStatus.UNHEALTHY,
            message="Connection refused",
        )

        assert component.message == "Connection refused"


class TestHealthChecker:
    """HealthChecker 클래스 테스트"""

    def test_health_checker_creation(self):
        """HealthChecker 생성"""
        checker = HealthChecker(version="2.0.0")

        assert checker.version == "2.0.0"

    def test_register_sync_check(self):
        """동기 함수 등록"""
        checker = HealthChecker()

        def sync_check():
            return True

        checker.register("sync_test", sync_check)

        assert "sync_test" in checker._checks

    def test_register_async_check(self):
        """비동기 함수 등록"""
        checker = HealthChecker()

        async def async_check():
            return True

        checker.register("async_test", async_check)

        assert "async_test" in checker._checks

    def test_unregister(self):
        """헬스체크 등록 해제"""
        checker = HealthChecker()
        checker.register("test", lambda: True)
        checker.unregister("test")

        assert "test" not in checker._checks

    @pytest.mark.asyncio
    async def test_check_one_healthy(self):
        """단일 체크 - 정상"""
        checker = HealthChecker()
        checker.register("test", lambda: True)

        result = await checker.check_one("test")

        assert result.status == HealthStatus.HEALTHY
        assert result.latency_ms is not None

    @pytest.mark.asyncio
    async def test_check_one_unhealthy(self):
        """단일 체크 - 비정상"""
        checker = HealthChecker()
        checker.register("test", lambda: False)

        result = await checker.check_one("test")

        assert result.status == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_check_one_exception(self):
        """단일 체크 - 예외 발생"""
        checker = HealthChecker()

        def failing_check():
            raise ConnectionError("Connection refused")

        checker.register("failing", failing_check)

        result = await checker.check_one("failing")

        assert result.status == HealthStatus.UNHEALTHY
        assert "Connection refused" in result.message

    @pytest.mark.asyncio
    async def test_check_one_unknown_component(self):
        """알 수 없는 컴포넌트 체크"""
        checker = HealthChecker()

        result = await checker.check_one("unknown")

        assert result.status == HealthStatus.UNHEALTHY
        assert "Unknown component" in result.message

    @pytest.mark.asyncio
    async def test_check_one_with_dict_result(self):
        """딕셔너리 반환 체크"""
        checker = HealthChecker()

        def dict_check():
            return {
                "status": "degraded",
                "message": "High latency",
                "details": {"latency_ms": 500},
            }

        checker.register("dict_test", dict_check)

        result = await checker.check_one("dict_test")

        assert result.status == HealthStatus.DEGRADED
        assert result.message == "High latency"
        assert result.details == {"latency_ms": 500}

    @pytest.mark.asyncio
    async def test_check_all_all_healthy(self):
        """전체 체크 - 모두 정상"""
        checker = HealthChecker()
        checker.register("service1", lambda: True)
        checker.register("service2", lambda: True)

        result = await checker.check_all()

        assert result.status == HealthStatus.HEALTHY
        assert len(result.components) == 2

    @pytest.mark.asyncio
    async def test_check_all_one_unhealthy(self):
        """전체 체크 - 하나 비정상"""
        checker = HealthChecker()
        checker.register("healthy", lambda: True)
        checker.register("unhealthy", lambda: False)

        result = await checker.check_all()

        assert result.status == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_check_all_one_degraded(self):
        """전체 체크 - 하나 degraded"""
        checker = HealthChecker()
        checker.register("healthy", lambda: True)
        checker.register("degraded", lambda: {"status": "degraded"})

        result = await checker.check_all()

        assert result.status == HealthStatus.DEGRADED

    @pytest.mark.asyncio
    async def test_check_all_async_functions(self):
        """전체 체크 - 비동기 함수들"""
        checker = HealthChecker()

        async def async_check1():
            return True

        async def async_check2():
            return {"status": "healthy", "message": "OK"}

        checker.register("async1", async_check1)
        checker.register("async2", async_check2)

        result = await checker.check_all()

        assert result.status == HealthStatus.HEALTHY
        assert len(result.components) == 2

    def test_to_dict(self):
        """딕셔너리 변환"""
        from datetime import datetime

        checker = HealthChecker(version="2.0.0")

        result = HealthCheckResult(
            status=HealthStatus.HEALTHY,
            components=[
                ComponentHealth(
                    name="db",
                    status=HealthStatus.HEALTHY,
                    latency_ms=5.123,
                )
            ],
            timestamp=datetime(2024, 1, 1, 12, 0, 0),
            version="2.0.0",
        )

        dict_result = checker.to_dict(result)

        assert dict_result["status"] == "healthy"
        assert dict_result["version"] == "2.0.0"
        assert dict_result["timestamp"] == "2024-01-01T12:00:00"
        assert len(dict_result["components"]) == 1
        assert dict_result["components"][0]["name"] == "db"
        assert dict_result["components"][0]["latency_ms"] == 5.12  # rounded


class TestBuiltinChecks:
    """내장 헬스체크 함수 테스트"""

    def test_check_memory(self):
        """메모리 체크 함수"""
        from shared.monitoring.health import check_memory

        result = check_memory()

        assert "status" in result
        assert result["status"] in ["healthy", "degraded", "unhealthy"]

    def test_check_disk(self):
        """디스크 체크 함수"""
        from shared.monitoring.health import check_disk

        result = check_disk()

        assert "status" in result
        assert result["status"] in ["healthy", "degraded", "unhealthy"]
