"""
🏥 DoAi.Me 헬스체크 모듈
서비스 상태 확인 및 리포팅

사용 예:
    from shared.monitoring import HealthChecker, HealthStatus

    checker = HealthChecker(version="2.0.0")

    # 헬스체크 함수 등록
    checker.register("database", check_database)
    checker.register("redis", check_redis)

    # 전체 헬스체크 실행
    result = await checker.check_all()
    print(checker.to_dict(result))
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from shared.utils import get_logger

logger = get_logger(__name__)


class HealthStatus(Enum):
    """헬스 상태"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class ComponentHealth:
    """개별 컴포넌트 헬스 상태"""

    name: str
    status: HealthStatus
    message: Optional[str] = None
    latency_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


@dataclass
class HealthCheckResult:
    """전체 헬스체크 결과"""

    status: HealthStatus
    components: List[ComponentHealth]
    timestamp: datetime
    version: str


class HealthChecker:
    """
    서비스 헬스체크 관리자

    여러 컴포넌트의 헬스체크를 등록하고 실행
    """

    def __init__(self, version: str = "2.0.0", on_status_change: Optional[Callable] = None):
        """
        Args:
            version: 서비스 버전
            on_status_change: 상태 변경 시 콜백 (async fn(component, old_status, new_status))
        """
        self.version = version
        self._checks: Dict[str, Callable] = {}
        self._timeouts: Dict[str, float] = {}
        self._last_statuses: Dict[str, HealthStatus] = {}
        self._on_status_change = on_status_change

    def register(
        self,
        name: str,
        check_func: Callable,
        timeout: float = 5.0,
    ) -> None:
        """
        헬스체크 함수 등록

        Args:
            name: 컴포넌트 이름
            check_func: 헬스체크 함수 (async 또는 sync, bool 또는 dict 반환)
            timeout: 타임아웃 (초)
        """
        self._checks[name] = check_func
        self._timeouts[name] = timeout
        logger.debug(f"헬스체크 등록: {name}")

    def unregister(self, name: str) -> None:
        """헬스체크 등록 해제"""
        self._checks.pop(name, None)
        self._timeouts.pop(name, None)

    async def check_one(self, name: str) -> ComponentHealth:
        """
        단일 컴포넌트 헬스체크 실행

        Args:
            name: 컴포넌트 이름

        Returns:
            ComponentHealth 결과
        """
        if name not in self._checks:
            return ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message=f"Unknown component: {name}",
            )

        check_func = self._checks[name]
        start = datetime.now()

        try:
            # 동기/비동기 함수 모두 지원
            import asyncio
            import inspect

            if inspect.iscoroutinefunction(check_func):
                result = await asyncio.wait_for(
                    check_func(),
                    timeout=self._timeouts.get(name, 5.0),
                )
            else:
                result = check_func()

            latency = (datetime.now() - start).total_seconds() * 1000

            # 결과 해석
            if isinstance(result, bool):
                status = HealthStatus.HEALTHY if result else HealthStatus.UNHEALTHY
                return ComponentHealth(
                    name=name,
                    status=status,
                    latency_ms=latency,
                )
            elif isinstance(result, dict):
                status = result.get("status", HealthStatus.HEALTHY)
                if isinstance(status, str):
                    status = HealthStatus(status)
                return ComponentHealth(
                    name=name,
                    status=status,
                    message=result.get("message"),
                    latency_ms=latency,
                    details=result.get("details"),
                )
            else:
                # 예상치 못한 반환값
                return ComponentHealth(
                    name=name,
                    status=HealthStatus.HEALTHY,
                    latency_ms=latency,
                )

        except asyncio.TimeoutError:
            return ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message="Health check timed out",
            )
        except Exception as e:
            logger.warning(f"헬스체크 실패: {name} - {e}")
            return ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message=str(e),
            )

    async def check_all(self) -> HealthCheckResult:
        """
        모든 컴포넌트 헬스체크 실행

        Returns:
            HealthCheckResult 전체 결과
        """
        import asyncio
        import inspect

        # 모든 체크 병렬 실행
        tasks = [self.check_one(name) for name in self._checks.keys()]
        components = await asyncio.gather(*tasks)

        # 전체 상태 결정 및 상태 변경 감지
        overall_status = HealthStatus.HEALTHY

        for component in components:
            if component.status == HealthStatus.UNHEALTHY:
                overall_status = HealthStatus.UNHEALTHY
            elif component.status == HealthStatus.DEGRADED and overall_status != HealthStatus.UNHEALTHY:
                overall_status = HealthStatus.DEGRADED

            # 상태 변경 감지 및 콜백 호출
            old_status = self._last_statuses.get(component.name)
            if old_status != component.status:
                self._last_statuses[component.name] = component.status

                if self._on_status_change:
                    try:
                        if inspect.iscoroutinefunction(self._on_status_change):
                            await self._on_status_change(component, old_status, component.status)
                        else:
                            self._on_status_change(component, old_status, component.status)
                    except Exception as e:
                        logger.error(f"상태 변경 콜백 실패: {e}")

        return HealthCheckResult(
            status=overall_status,
            components=list(components),
            timestamp=datetime.now(),
            version=self.version,
        )

    def to_dict(self, result: HealthCheckResult) -> Dict[str, Any]:
        """
        API 응답용 딕셔너리 변환

        Args:
            result: HealthCheckResult

        Returns:
            JSON 직렬화 가능한 딕셔너리
        """
        return {
            "status": result.status.value,
            "version": result.version,
            "timestamp": result.timestamp.isoformat(),
            "components": [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "message": c.message,
                    "latency_ms": round(c.latency_ms, 2) if c.latency_ms else None,
                    "details": c.details,
                }
                for c in result.components
            ],
        }


# ===========================================
# 기본 헬스체크 함수들
# ===========================================


async def check_supabase() -> Dict[str, Any]:
    """Supabase 연결 헬스체크"""
    try:
        from shared.supabase_client import get_client

        client = get_client()
        # 간단한 쿼리로 연결 확인
        client.table("devices").select("id").limit(1).execute()
        return {"status": "healthy", "message": "Supabase connected"}
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


def check_memory() -> Dict[str, Any]:
    """메모리 사용량 체크"""
    try:
        import psutil

        memory = psutil.virtual_memory()
        usage_percent = memory.percent

        if usage_percent > 90:
            status = "unhealthy"
        elif usage_percent > 80:
            status = "degraded"
        else:
            status = "healthy"

        return {
            "status": status,
            "details": {
                "usage_percent": usage_percent,
                "available_mb": memory.available // (1024 * 1024),
            },
        }
    except ImportError:
        return {"status": "healthy", "message": "psutil not installed"}


def check_disk() -> Dict[str, Any]:
    """디스크 사용량 체크"""
    try:
        import psutil

        disk = psutil.disk_usage("/")
        usage_percent = disk.percent

        if usage_percent > 95:
            status = "unhealthy"
        elif usage_percent > 85:
            status = "degraded"
        else:
            status = "healthy"

        return {
            "status": status,
            "details": {
                "usage_percent": usage_percent,
                "free_gb": disk.free // (1024 * 1024 * 1024),
            },
        }
    except ImportError:
        return {"status": "healthy", "message": "psutil not installed"}
