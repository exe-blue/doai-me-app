"""
Nocturne Line Scheduler (밤의 상징문장 스케줄러)

매일 자정 (00:00:15)에 전날의 Nocturne Line을 자동 생성

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-04
"""

import asyncio
import logging
from datetime import datetime, date, timedelta, time
from typing import Optional, Callable, Awaitable

from .nocturne_service import generate_nocturne_line, collect_daily_metrics

logger = logging.getLogger("nocturne_scheduler")


class NocturneScheduler:
    """
    Nocturne Line 자동 생성 스케줄러
    
    매일 자정에 전날의 로그를 집계하여 시적 문장 생성
    """
    
    def __init__(
        self,
        run_time: time = time(0, 0, 15),  # 00:00:15 (자정 15초 후)
        on_generate: Optional[Callable[[str], Awaitable[None]]] = None,
    ):
        """
        Args:
            run_time: 실행 시각 (기본: 00:00:15)
            on_generate: 생성 완료 시 콜백 (알림 전송 등)
        """
        self.run_time = run_time
        self.on_generate = on_generate
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """스케줄러 시작"""
        if self._running:
            logger.warning("Scheduler already running")
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"🌙 Nocturne Scheduler started (run_time: {self.run_time})")
    
    async def stop(self):
        """스케줄러 중지"""
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        
        logger.info("🌙 Nocturne Scheduler stopped")
    
    async def _run_loop(self):
        """메인 스케줄 루프"""
        while self._running:
            try:
                # 다음 실행 시각 계산
                now = datetime.now()
                next_run = self._calculate_next_run(now)
                wait_seconds = (next_run - now).total_seconds()
                
                logger.info(
                    f"Next nocturne generation scheduled at {next_run} "
                    f"(in {wait_seconds:.0f} seconds)"
                )
                
                # 대기
                await asyncio.sleep(wait_seconds)
                
                # 실행
                if self._running:
                    await self._execute_generation()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}", exc_info=True)
                # 에러 발생 시 1분 후 재시도
                try:
                    await asyncio.sleep(60)
                except asyncio.CancelledError:
                    # sleep 중 취소 요청이 오면 재발생시켜 루프 종료
                    raise
    
    def _calculate_next_run(self, now: datetime) -> datetime:
        """다음 실행 시각 계산"""
        today_run = datetime.combine(now.date(), self.run_time)
        
        if now < today_run:
            # 오늘 실행 예정
            return today_run
        else:
            # 내일 실행
            return today_run + timedelta(days=1)
    
    async def _execute_generation(self):
        """Nocturne Line 생성 실행"""
        logger.info("🌙 Starting nocturne line generation...")
        
        try:
            # 어제 날짜
            yesterday = date.today() - timedelta(days=1)
            
            # 생성
            nocturne = await generate_nocturne_line(yesterday, force=True)
            
            logger.info(f"✨ Generated: {nocturne.line}")
            
            # 콜백 호출 (알림 등)
            if self.on_generate:
                await self.on_generate(nocturne.line)
                
        except Exception as e:
            logger.error(f"Failed to generate nocturne line: {e}", exc_info=True)
    
    async def run_now(self):
        """즉시 실행 (테스트용)"""
        logger.info("🌙 Manual trigger: generating nocturne line now...")
        await self._execute_generation()


# ═══════════════════════════════════════════════════════════════════════════════
# 싱글톤 인스턴스 및 유틸리티
# ═══════════════════════════════════════════════════════════════════════════════

_scheduler: Optional[NocturneScheduler] = None


def get_scheduler() -> NocturneScheduler:
    """스케줄러 인스턴스 반환"""
    global _scheduler
    if _scheduler is None:
        _scheduler = NocturneScheduler()
    return _scheduler


async def start_nocturne_scheduler(
    on_generate: Optional[Callable[[str], Awaitable[None]]] = None
):
    """
    스케줄러 시작 (애플리케이션 시작 시 호출)
    
    Example:
        async def on_nocturne_generated(line: str):
            # Discord/Slack 알림 전송
            await send_notification(f"🌙 밤의 상징문장: {line}")
        
        await start_nocturne_scheduler(on_generate=on_nocturne_generated)
    """
    global _scheduler
    _scheduler = NocturneScheduler(on_generate=on_generate)
    await _scheduler.start()


async def stop_nocturne_scheduler():
    """스케줄러 중지 (애플리케이션 종료 시 호출)"""
    global _scheduler
    if _scheduler:
        await _scheduler.stop()
        _scheduler = None


async def trigger_nocturne_now():
    """즉시 생성 트리거 (관리자용)"""
    scheduler = get_scheduler()
    await scheduler.run_now()

