"""
BatchExecutor - 50% 배치 실행 로직

연결된 기기의 절반씩 2회 실행하여 안정적인 워크로드 처리를 담당합니다.

실행 방식:
1. 가용 디바이스를 A/B 그룹으로 분할 (각 50%)
2. 1차 배치: 그룹 A 디바이스에 명령 전송
3. 대기: batch_interval 만큼 휴식
4. 2차 배치: 그룹 B 디바이스에 명령 전송

이점:
- 동시 부하 감소 (Laixi 서버, 네트워크)
- 오류 발생 시 절반은 보존
- 자연스러운 트래픽 패턴 생성
"""

import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Callable, Awaitable
from dataclasses import dataclass, field
import random

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.device_registry import DeviceRegistry, DeviceInfo, get_device_registry
from shared.laixi_client import LaixiClient, get_laixi_client
from shared.schemas.workload import (
    BatchConfig,
    WatchConfig,
    BatchResult,
    DeviceBatchResult,
    CommandStatus
)


@dataclass
class VideoTarget:
    """시청 대상 영상 정보"""
    video_id: str
    url: str
    title: Optional[str] = None
    duration_seconds: Optional[int] = None


@dataclass
class BatchExecutionContext:
    """배치 실행 컨텍스트"""
    workload_id: Optional[str] = None
    video: Optional[VideoTarget] = None
    batch_config: BatchConfig = field(default_factory=BatchConfig)
    watch_config: WatchConfig = field(default_factory=WatchConfig)
    
    # 콜백 함수들
    on_device_start: Optional[Callable[[str, str], Awaitable[None]]] = None
    on_device_complete: Optional[Callable[[str, DeviceBatchResult], Awaitable[None]]] = None
    on_batch_complete: Optional[Callable[[BatchResult], Awaitable[None]]] = None


class BatchExecutor:
    """
    50% 배치 실행기
    
    연결된 기기를 A/B 그룹으로 나누어 절반씩 실행합니다.
    
    Usage:
        executor = BatchExecutor()
        
        video = VideoTarget(
            video_id="abc123",
            url="https://youtube.com/watch?v=abc123",
            title="테스트 영상"
        )
        
        context = BatchExecutionContext(
            workload_id="workload-001",
            video=video,
            batch_config=BatchConfig(batch_size_percent=50)
        )
        
        results = await executor.execute_half_batches(context)
    """
    
    def __init__(
        self,
        registry: Optional[DeviceRegistry] = None,
        laixi: Optional[LaixiClient] = None
    ):
        """
        BatchExecutor 초기화
        
        Args:
            registry: DeviceRegistry 인스턴스 (None이면 싱글톤 사용)
            laixi: LaixiClient 인스턴스 (None이면 싱글톤 사용)
        """
        self.registry = registry or get_device_registry()
        self.laixi = laixi
        self._laixi_connected = False
    
    async def _ensure_laixi(self) -> LaixiClient:
        """Laixi 클라이언트 연결 확인"""
        if self.laixi is None:
            self.laixi = get_laixi_client()
        
        if not self._laixi_connected:
            connected = await self.laixi.connect()
            if not connected:
                raise ConnectionError("Laixi 연결 실패")
            self._laixi_connected = True
        
        return self.laixi
    
    async def execute_half_batches(
        self,
        context: BatchExecutionContext,
        workstation_id: Optional[str] = None
    ) -> List[BatchResult]:
        """
        50% 배치 실행 (A/B 그룹 순차 실행)
        
        Args:
            context: 실행 컨텍스트 (영상, 설정, 콜백)
            workstation_id: 특정 워크스테이션만 대상 (None = 전체)
        
        Returns:
            [그룹 A 결과, 그룹 B 결과]
        """
        # 디바이스 그룹 가져오기
        group_a, group_b = await self.registry.get_batch_groups(workstation_id)
        
        total_devices = len(group_a) + len(group_b)
        if total_devices == 0:
            logger.warning("실행 가능한 디바이스 없음")
            return []
        
        logger.info(
            f"배치 실행 시작: {total_devices}대 "
            f"(A={len(group_a)}, B={len(group_b)})"
        )
        
        results: List[BatchResult] = []
        
        # 1차 배치: 그룹 A
        if group_a:
            batch_1 = await self._execute_batch(
                devices=group_a,
                batch_number=1,
                batch_group="A",
                context=context
            )
            results.append(batch_1)
            
            if context.on_batch_complete:
                await context.on_batch_complete(batch_1)
            
            logger.info(
                f"1차 배치(A) 완료: {batch_1.success_count}/{batch_1.total_devices} 성공"
            )
        
        # 배치 간 대기
        if group_a and group_b:
            interval = context.batch_config.batch_interval_seconds
            logger.info(f"배치 간 대기: {interval}초")
            await asyncio.sleep(interval)
        
        # 2차 배치: 그룹 B
        if group_b:
            batch_2 = await self._execute_batch(
                devices=group_b,
                batch_number=2,
                batch_group="B",
                context=context
            )
            results.append(batch_2)
            
            if context.on_batch_complete:
                await context.on_batch_complete(batch_2)
            
            logger.info(
                f"2차 배치(B) 완료: {batch_2.success_count}/{batch_2.total_devices} 성공"
            )
        
        # 전체 집계
        total_success = sum(r.success_count for r in results)
        total_failed = sum(r.failed_count for r in results)
        
        logger.info(
            f"배치 실행 완료: {total_success}/{total_devices} 성공, "
            f"{total_failed} 실패"
        )
        
        return results
    
    async def _execute_batch(
        self,
        devices: List[DeviceInfo],
        batch_number: int,
        batch_group: str,
        context: BatchExecutionContext
    ) -> BatchResult:
        """
        단일 배치 실행
        
        Args:
            devices: 대상 디바이스 목록
            batch_number: 배치 번호 (1 또는 2)
            batch_group: 그룹 (A 또는 B)
            context: 실행 컨텍스트
        
        Returns:
            배치 실행 결과
        """
        started_at = datetime.now(timezone.utc)
        
        result = BatchResult(
            batch_number=batch_number,
            batch_group=batch_group,
            total_devices=len(devices),
            started_at=started_at
        )
        
        # 디바이스들을 busy 상태로 변경
        device_ids = [d.hierarchy_id or d.serial_number for d in devices]
        await self.registry.set_devices_busy(device_ids)
        
        try:
            # 병렬 실행 (동시성 제한)
            semaphore = asyncio.Semaphore(10)  # 동시 10개 제한
            
            async def execute_with_limit(device: DeviceInfo) -> DeviceBatchResult:
                async with semaphore:
                    return await self._execute_on_device(device, context)
            
            tasks = [execute_with_limit(device) for device in devices]
            device_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 결과 처리
            for i, res in enumerate(device_results):
                if isinstance(res, Exception):
                    # 예외 발생 시 실패 결과 생성
                    device = devices[i]
                    device_result = DeviceBatchResult(
                        device_id=device.id,
                        device_hierarchy_id=device.hierarchy_id,
                        status=CommandStatus.FAILED,
                        error_message=str(res),
                        started_at=started_at
                    )
                    result.failed_count += 1
                else:
                    device_result = res
                    if device_result.status == CommandStatus.SUCCESS:
                        result.success_count += 1
                    else:
                        result.failed_count += 1
                
                result.device_results.append(device_result)
                
                # 디바이스 완료 콜백
                if context.on_device_complete:
                    await context.on_device_complete(
                        device_result.device_id,
                        device_result
                    )
        
        finally:
            # 디바이스들을 idle 상태로 복원
            await self.registry.set_devices_idle(device_ids)
        
        # 완료 시간 기록
        result.completed_at = datetime.now(timezone.utc)
        result.duration_seconds = (
            result.completed_at - result.started_at
        ).total_seconds()
        
        return result
    
    async def _execute_on_device(
        self,
        device: DeviceInfo,
        context: BatchExecutionContext
    ) -> DeviceBatchResult:
        """
        단일 디바이스에서 시청 명령 실행
        
        Args:
            device: 대상 디바이스
            context: 실행 컨텍스트
        
        Returns:
            디바이스 실행 결과
        """
        started_at = datetime.now(timezone.utc)
        
        result = DeviceBatchResult(
            device_id=device.id,
            device_hierarchy_id=device.hierarchy_id,
            status=CommandStatus.PENDING,
            started_at=started_at
        )
        
        # 시작 콜백
        if context.on_device_start:
            await context.on_device_start(device.id, device.hierarchy_id)
        
        try:
            laixi = await self._ensure_laixi()
            
            video = context.video
            if not video:
                raise ValueError("시청 대상 영상이 없음")
            
            watch_config = context.watch_config
            
            # 시청 시간 결정 (랜덤 범위)
            watch_duration = random.randint(
                watch_config.watch_duration_min,
                watch_config.watch_duration_max
            )
            
            # YouTube 영상 열기 (ADB 명령)
            device_id = device.serial_number
            
            # 1. YouTube 앱으로 영상 열기
            await laixi.execute_adb(
                device_id,
                f"am start -a android.intent.action.VIEW -d {video.url}"
            )
            
            logger.debug(f"[{device.hierarchy_id}] YouTube 열기: {video.title}")
            
            # 2. 영상 로드 대기
            await asyncio.sleep(3)
            
            # 3. 시청 (대기)
            if watch_config.enable_random_pause:
                # 랜덤 구간으로 나누어 시청
                remaining = watch_duration
                while remaining > 0:
                    segment = min(remaining, random.randint(10, 30))
                    await asyncio.sleep(segment)
                    remaining -= segment
                    
                    # 랜덤 스크롤 (휴먼 패턴)
                    if watch_config.enable_random_scroll and random.random() < 0.3:
                        await laixi.swipe(
                            device_id,
                            0.5, 0.6,
                            0.5, 0.4,
                            duration_ms=300
                        )
            else:
                await asyncio.sleep(watch_duration)
            
            result.watch_time_seconds = watch_duration
            
            # 4. 좋아요 (확률적)
            if random.random() < watch_config.like_probability:
                # 좋아요 버튼 위치 탭 (대략적 위치)
                await laixi.tap(device_id, 0.15, 0.85)
                await asyncio.sleep(0.5)
                result.liked = True
                logger.debug(f"[{device.hierarchy_id}] 좋아요 클릭")
            
            # 5. 홈으로 나가기
            await laixi.press_home(device_id)
            
            # 성공 처리
            result.status = CommandStatus.SUCCESS
            result.completed_at = datetime.now(timezone.utc)
            result.duration_ms = int(
                (result.completed_at - result.started_at).total_seconds() * 1000
            )
            
            logger.info(
                f"[{device.hierarchy_id}] 시청 완료: "
                f"{result.watch_time_seconds}초, liked={result.liked}"
            )
            
            # 디바이스 명령 기록 업데이트
            await self.registry.update_device_command(
                device_id,
                command="watch",
                result="success"
            )
        
        except asyncio.TimeoutError:
            result.status = CommandStatus.TIMEOUT
            result.error_message = "명령 타임아웃"
            logger.warning(f"[{device.hierarchy_id}] 타임아웃")
            
            await self.registry.update_device_command(
                device.serial_number,
                command="watch",
                result="timeout"
            )
        
        except Exception as e:
            result.status = CommandStatus.FAILED
            result.error_message = str(e)
            logger.error(f"[{device.hierarchy_id}] 실행 오류: {e}")
            
            await self.registry.update_device_command(
                device.serial_number,
                command="watch",
                result="failed"
            )
        
        return result
    
    async def execute_custom_command(
        self,
        devices: List[DeviceInfo],
        command_fn: Callable[[LaixiClient, str], Awaitable[bool]],
        batch_size_percent: int = 50,
        batch_interval: int = 30
    ) -> List[BatchResult]:
        """
        커스텀 명령 배치 실행
        
        Args:
            devices: 대상 디바이스 목록
            command_fn: 실행할 명령 함수 (laixi, device_serial) -> success
            batch_size_percent: 배치 크기 (%)
            batch_interval: 배치 간 대기 (초)
        
        Returns:
            배치 결과 목록
        """
        if not devices:
            return []
        
        # 배치 크기 계산
        batch_size = max(1, len(devices) * batch_size_percent // 100)
        batches = [
            devices[i:i + batch_size]
            for i in range(0, len(devices), batch_size)
        ]
        
        results: List[BatchResult] = []
        laixi = await self._ensure_laixi()
        
        for batch_num, batch_devices in enumerate(batches, 1):
            started_at = datetime.now(timezone.utc)
            
            result = BatchResult(
                batch_number=batch_num,
                batch_group="A" if batch_num % 2 == 1 else "B",
                total_devices=len(batch_devices),
                started_at=started_at
            )
            
            for device in batch_devices:
                device_started = datetime.now(timezone.utc)
                
                try:
                    success = await command_fn(laixi, device.serial_number)
                    
                    device_result = DeviceBatchResult(
                        device_id=device.id,
                        device_hierarchy_id=device.hierarchy_id,
                        status=CommandStatus.SUCCESS if success else CommandStatus.FAILED,
                        started_at=device_started,
                        completed_at=datetime.now(timezone.utc)
                    )
                    
                    if success:
                        result.success_count += 1
                    else:
                        result.failed_count += 1
                
                except Exception as e:
                    device_result = DeviceBatchResult(
                        device_id=device.id,
                        device_hierarchy_id=device.hierarchy_id,
                        status=CommandStatus.FAILED,
                        error_message=str(e),
                        started_at=device_started
                    )
                    result.failed_count += 1
                
                result.device_results.append(device_result)
            
            result.completed_at = datetime.now(timezone.utc)
            result.duration_seconds = (
                result.completed_at - result.started_at
            ).total_seconds()
            
            results.append(result)
            
            # 배치 간 대기
            if batch_num < len(batches):
                await asyncio.sleep(batch_interval)
        
        return results


# 싱글톤 인스턴스
_executor: Optional[BatchExecutor] = None


def get_batch_executor() -> BatchExecutor:
    """BatchExecutor 싱글톤 반환"""
    global _executor
    if _executor is None:
        _executor = BatchExecutor()
    return _executor
