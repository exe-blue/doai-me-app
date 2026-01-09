"""
📝 DoAi.Me Log Collector
Supabase monitoring_logs 테이블에 로그 저장

사용 예:
    from shared.monitoring.log_collector import LogCollector, get_log_collector

    # 싱글톤 사용
    collector = get_log_collector()
    await collector.log("info", "api", "Request processed", context={"duration": 0.5})

    # 또는 직접 인스턴스
    collector = LogCollector(source="my-service")
    await collector.info("Service started")
    await collector.error("Connection failed", context={"host": "db.example.com"})
"""

import asyncio
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)
    logging.basicConfig(level=logging.INFO)


class LogLevel(str, Enum):
    """로그 레벨"""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class LogCollector:
    """
    Supabase monitoring_logs 테이블에 로그 저장

    Features:
    - 비동기 로그 저장
    - 배치 저장 (버퍼링)
    - 로컬 로거와 동시 출력
    - 실패 시 로컬 로그로 폴백
    """

    def __init__(
        self,
        source: str = "api",
        component: Optional[str] = None,
        buffer_size: int = 10,
        auto_flush_seconds: float = 5.0,
    ):
        """
        Args:
            source: 로그 소스 (api, oob, laixi, node-runner)
            component: 세부 컴포넌트 (router, service, etc.)
            buffer_size: 버퍼 크기 (이 수 만큼 모이면 flush)
            auto_flush_seconds: 자동 flush 간격 (초)
        """
        self.source = source
        self.component = component
        self.buffer_size = buffer_size
        self.auto_flush_seconds = auto_flush_seconds

        self._buffer: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None
        self._client = None
        self._enabled = True

    def _get_client(self):
        """Supabase 클라이언트 lazy 로딩"""
        if self._client is None:
            try:
                from shared.supabase_client import get_client

                self._client = get_client()
            except Exception as e:
                logger.warning(f"Supabase 연결 실패, 로컬 로깅만 사용: {e}")
                self._enabled = False
        return self._client

    async def log(
        self,
        level: str,
        source: Optional[str] = None,
        message: str = "",
        component: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        node_id: Optional[str] = None,
        device_serial: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        로그 저장

        Args:
            level: 로그 레벨 (debug, info, warning, error, critical)
            source: 로그 소스 (미지정 시 인스턴스 기본값)
            message: 로그 메시지
            component: 세부 컴포넌트
            context: 추가 컨텍스트 (JSON)
            node_id: 관련 노드 ID
            device_serial: 관련 디바이스 시리얼
            request_id: 요청 ID (트레이싱용)

        Returns:
            로그 ID (버퍼링 시 None)
        """
        # 로컬 로거에도 출력
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(f"[{source or self.source}] {message}")

        if not self._enabled:
            return None

        log_entry = {
            "level": level,
            "source": source or self.source,
            "component": component or self.component,
            "message": message,
            "context": context or {},
            "node_id": node_id,
            "device_serial": device_serial,
            "request_id": request_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        async with self._lock:
            self._buffer.append(log_entry)

            if len(self._buffer) >= self.buffer_size:
                await self._flush_buffer()

        # auto flush 태스크 시작
        if self._flush_task is None or self._flush_task.done():
            self._flush_task = asyncio.create_task(self._auto_flush())

        return None  # 버퍼링 시 ID 반환 불가

    async def _flush_buffer(self) -> int:
        """버퍼를 Supabase에 저장"""
        if not self._buffer:
            return 0

        entries = self._buffer.copy()
        self._buffer.clear()

        try:
            client = self._get_client()
            if client is None:
                return 0

            # 배치 삽입
            result = client.table("monitoring_logs").insert(entries).execute()

            count = len(result.data) if result.data else 0
            logger.debug(f"로그 {count}건 저장 완료")
            return count

        except Exception as e:
            logger.error(f"로그 저장 실패: {e}")
            # 실패한 로그는 버퍼에 다시 넣기 (최대 버퍼 크기까지)
            self._buffer = entries[: self.buffer_size] + self._buffer[: self.buffer_size]
            return 0

    async def _auto_flush(self):
        """자동 flush 태스크"""
        await asyncio.sleep(self.auto_flush_seconds)
        async with self._lock:
            await self._flush_buffer()

    async def flush(self) -> int:
        """수동 flush"""
        async with self._lock:
            return await self._flush_buffer()

    # 편의 메서드들
    async def debug(
        self,
        message: str,
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Optional[str]:
        """DEBUG 레벨 로그"""
        return await self.log("debug", message=message, context=context, **kwargs)

    async def info(
        self,
        message: str,
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Optional[str]:
        """INFO 레벨 로그"""
        return await self.log("info", message=message, context=context, **kwargs)

    async def warning(
        self,
        message: str,
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Optional[str]:
        """WARNING 레벨 로그"""
        return await self.log("warning", message=message, context=context, **kwargs)

    async def error(
        self,
        message: str,
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Optional[str]:
        """ERROR 레벨 로그"""
        return await self.log("error", message=message, context=context, **kwargs)

    async def critical(
        self,
        message: str,
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Optional[str]:
        """CRITICAL 레벨 로그"""
        return await self.log("critical", message=message, context=context, **kwargs)


# ===========================================
# 싱글톤 인스턴스
# ===========================================

_collector: Optional[LogCollector] = None


def get_log_collector(source: str = "api") -> LogCollector:
    """로그 컬렉터 싱글톤"""
    global _collector

    if _collector is None:
        _collector = LogCollector(source=source)

    return _collector


def reset_log_collector():
    """테스트용 리셋"""
    global _collector
    _collector = None


# ===========================================
# 로그 검색 함수
# ===========================================


async def search_logs(
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    search_text: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """
    로그 검색

    Args:
        level: 로그 레벨 필터
        source: 소스 필터
        start_time: 시작 시간
        end_time: 종료 시간
        search_text: 메시지 검색어
        limit: 최대 결과 수
        offset: 오프셋

    Returns:
        로그 목록
    """
    try:
        from shared.supabase_client import get_client

        client = get_client()

        query = client.table("monitoring_logs").select("*")

        if level:
            query = query.eq("level", level)
        if source:
            query = query.eq("source", source)
        if start_time:
            query = query.gte("created_at", start_time.isoformat())
        if end_time:
            query = query.lte("created_at", end_time.isoformat())
        if search_text:
            query = query.ilike("message", f"%{search_text}%")

        query = query.order("created_at", desc=True).limit(limit).offset(offset)

        result = query.execute()
        return result.data or []

    except Exception as e:
        logger.error(f"로그 검색 실패: {e}")
        return []


async def get_log_stats(hours: int = 24) -> Dict[str, Any]:
    """
    로그 통계 조회

    Args:
        hours: 조회할 시간 범위

    Returns:
        레벨별 로그 수
    """
    try:
        from shared.supabase_client import get_client

        client = get_client()

        # 시간 범위 계산
        from datetime import timedelta

        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        result = (
            client.table("monitoring_logs")
            .select("level")
            .gte("created_at", start_time.isoformat())
            .execute()
        )

        # 레벨별 집계
        stats = {"debug": 0, "info": 0, "warning": 0, "error": 0, "critical": 0, "total": 0}

        for row in result.data or []:
            level = row.get("level", "info")
            if level in stats:
                stats[level] += 1
            stats["total"] += 1

        return stats

    except Exception as e:
        logger.error(f"로그 통계 조회 실패: {e}")
        return {"error": str(e)}
