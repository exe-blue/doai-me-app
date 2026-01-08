"""
WorkloadEngine - 워크로드 실행 엔진

영상 리스팅 → 명령 → 결과 기록 → 대기 사이클을 관리합니다.

워크로드 사이클:
1. LISTING: 다음 영상 선택
2. EXECUTING: 50% 배치 실행 (A그룹 → 대기 → B그룹)
3. RECORDING: 결과 DB 기록
4. WAITING: 다음 영상까지 대기
5. 반복 또는 COMPLETED
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Callable, Awaitable
from dataclasses import dataclass, field
import uuid

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.supabase_client import get_client
from shared.device_registry import DeviceRegistry, get_device_registry
from shared.batch_executor import (
    BatchExecutor,
    BatchExecutionContext,
    VideoTarget,
    get_batch_executor
)
from shared.schemas.workload import (
    WorkloadStatus,
    WorkloadCreate,
    WorkloadInDB,
    WorkloadResponse,
    BatchConfig,
    WatchConfig,
    BatchResult,
    DeviceBatchResult,
    WorkloadCycleResult,
    WorkloadLogCreate,
    LogLevel,
    CommandStatus
)


@dataclass
class WorkloadState:
    """워크로드 실행 상태"""
    workload_id: str
    status: WorkloadStatus = WorkloadStatus.PENDING
    current_video_index: int = 0
    current_batch: int = 0
    total_batches: int = 0
    
    # 실행 결과
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    
    # 사이클 결과
    cycle_results: List[WorkloadCycleResult] = field(default_factory=list)
    
    # 제어
    is_running: bool = False
    should_stop: bool = False
    
    # 에러
    last_error: Optional[str] = None


class WorkloadEngine:
    """
    워크로드 실행 엔진
    
    워크로드를 생성, 실행, 모니터링합니다.
    
    Usage:
        engine = WorkloadEngine()
        
        # 워크로드 생성
        workload = await engine.create_workload(WorkloadCreate(
            name="신규 영상 시청",
            video_ids=["uuid1", "uuid2", "uuid3"],
            batch_config=BatchConfig(batch_size_percent=50)
        ))
        
        # 워크로드 실행
        await engine.start_workload(workload.id)
        
        # 상태 확인
        status = await engine.get_workload_status(workload.id)
    """
    
    def __init__(
        self,
        registry: Optional[DeviceRegistry] = None,
        executor: Optional[BatchExecutor] = None
    ):
        """
        WorkloadEngine 초기화
        
        Args:
            registry: DeviceRegistry 인스턴스
            executor: BatchExecutor 인스턴스
        """
        self.client = get_client()
        self.registry = registry or get_device_registry()
        self.executor = executor or get_batch_executor()
        
        # 실행 중인 워크로드 상태
        self._running_workloads: Dict[str, WorkloadState] = {}
        
        # 콜백
        self.on_workload_start: Optional[Callable[[str], Awaitable[None]]] = None
        self.on_workload_complete: Optional[Callable[[str, WorkloadState], Awaitable[None]]] = None
        self.on_cycle_complete: Optional[Callable[[str, WorkloadCycleResult], Awaitable[None]]] = None
    
    # =========================================
    # 워크로드 CRUD
    # =========================================
    
    async def create_workload(self, request: WorkloadCreate) -> WorkloadResponse:
        """
        워크로드 생성
        
        Args:
            request: 생성 요청
        
        Returns:
            생성된 워크로드
        """
        workload_id = str(uuid.uuid4())
        batch_config = request.batch_config or BatchConfig()
        
        now = datetime.now(timezone.utc).isoformat()
        
        data = {
            "id": workload_id,
            "name": request.name or f"워크로드 {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "video_ids": request.video_ids,
            "current_video_index": 0,
            "batch_size_percent": batch_config.batch_size_percent,
            "batch_interval_seconds": batch_config.batch_interval_seconds,
            "cycle_interval_seconds": batch_config.cycle_interval_seconds,
            "target_workstations": request.target_workstations,
            "status": WorkloadStatus.PENDING.value,
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "current_batch": 0,
            "total_batches": 0,
            "scheduled_at": request.scheduled_at.isoformat() if request.scheduled_at else None,
            "created_at": now,
            "updated_at": now
        }
        
        result = self.client.table("workloads").insert(data).execute()
        
        if not result.data:
            raise Exception("워크로드 생성 실패")
        
        await self._log(
            workload_id,
            LogLevel.INFO,
            f"워크로드 생성: {len(request.video_ids)}개 영상"
        )
        
        logger.info(f"워크로드 생성: {workload_id}")
        
        return self._to_response(result.data[0])
    
    async def get_workload(self, workload_id: str) -> Optional[WorkloadResponse]:
        """워크로드 조회"""
        try:
            result = self.client.table("workloads").select("*").eq(
                "id", workload_id
            ).single().execute()
            
            if result.data:
                return self._to_response(result.data)
            return None
        except Exception:
            return None
    
    async def get_workloads(
        self,
        status: Optional[WorkloadStatus] = None,
        limit: int = 50
    ) -> List[WorkloadResponse]:
        """워크로드 목록 조회"""
        try:
            query = self.client.table("workloads").select("*")
            
            if status:
                query = query.eq("status", status.value)
            
            result = query.order("created_at", desc=True).limit(limit).execute()
            
            return [self._to_response(w) for w in (result.data or [])]
        except Exception as e:
            logger.error(f"워크로드 목록 조회 실패: {e}")
            return []
    
    async def update_workload_status(
        self,
        workload_id: str,
        status: WorkloadStatus,
        **kwargs: Any
    ) -> bool:
        """워크로드 상태 업데이트"""
        try:
            update_data: Dict[str, Any] = {
                "status": status.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            update_data.update(kwargs)
            
            result = self.client.table("workloads").update(
                update_data
            ).eq("id", workload_id).execute()
            
            return bool(result.data)
        except Exception as e:
            logger.error(f"워크로드 상태 업데이트 실패: {workload_id} - {e}")
            return False
    
    async def cancel_workload(self, workload_id: str) -> bool:
        """워크로드 취소"""
        # 실행 중이면 중지 플래그 설정
        if workload_id in self._running_workloads:
            self._running_workloads[workload_id].should_stop = True
        
        await self._log(workload_id, LogLevel.WARN, "워크로드 취소됨")
        
        return await self.update_workload_status(
            workload_id,
            WorkloadStatus.CANCELLED
        )
    
    # =========================================
    # 워크로드 실행
    # =========================================
    
    async def start_workload(self, workload_id: str) -> bool:
        """
        워크로드 실행 시작
        
        Args:
            workload_id: 워크로드 ID
        
        Returns:
            성공 여부
        """
        # 워크로드 조회
        workload = await self.get_workload(workload_id)
        if not workload:
            logger.error(f"워크로드 없음: {workload_id}")
            return False
        
        # 이미 실행 중인지 확인
        if workload_id in self._running_workloads:
            logger.warning(f"워크로드 이미 실행 중: {workload_id}")
            return False
        
        # 실행 가능한 상태인지 확인
        if workload.status not in [WorkloadStatus.PENDING, WorkloadStatus.PAUSED]:
            logger.warning(f"실행 불가 상태: {workload.status}")
            return False
        
        # 상태 초기화
        state = WorkloadState(
            workload_id=workload_id,
            current_video_index=workload.current_video_index,
            is_running=True
        )
        self._running_workloads[workload_id] = state
        
        # 백그라운드에서 실행
        asyncio.create_task(self._run_workload(workload_id, workload, state))
        
        logger.info(f"워크로드 실행 시작: {workload_id}")
        return True
    
    async def _run_workload(
        self,
        workload_id: str,
        workload: WorkloadResponse,
        state: WorkloadState
    ) -> None:
        """
        워크로드 실행 메인 루프
        
        영상 리스팅 → 명령 → 결과 기록 → 대기 사이클
        """
        try:
            # 시작 상태 업데이트
            await self.update_workload_status(
                workload_id,
                WorkloadStatus.LISTING,
                started_at=datetime.now(timezone.utc).isoformat()
            )
            
            await self._log(workload_id, LogLevel.INFO, "워크로드 실행 시작")
            
            if self.on_workload_start:
                await self.on_workload_start(workload_id)
            
            video_ids = workload.video_ids
            batch_config = BatchConfig(
                batch_size_percent=workload.batch_size_percent,
                batch_interval_seconds=workload.batch_interval_seconds,
                cycle_interval_seconds=workload.cycle_interval_seconds
            )
            
            # 영상별 사이클 실행
            for idx in range(state.current_video_index, len(video_ids)):
                if state.should_stop:
                    logger.info(f"워크로드 중지 요청: {workload_id}")
                    break
                
                state.current_video_index = idx
                video_id = video_ids[idx]
                
                # 영상 정보 조회
                video = await self._get_video_info(video_id)
                if not video:
                    await self._log(
                        workload_id,
                        LogLevel.WARN,
                        f"영상 정보 없음: {video_id}",
                        video_id=video_id
                    )
                    continue
                
                await self._log(
                    workload_id,
                    LogLevel.INFO,
                    f"영상 처리 시작 ({idx + 1}/{len(video_ids)}): {video.title}",
                    video_id=video_id
                )
                
                # 상태 업데이트: EXECUTING
                await self.update_workload_status(
                    workload_id,
                    WorkloadStatus.EXECUTING,
                    current_video_index=idx
                )
                
                # 배치 실행
                cycle_result = await self._execute_video_cycle(
                    workload_id,
                    video,
                    batch_config,
                    state,
                    workload.target_workstations
                )
                
                state.cycle_results.append(cycle_result)
                
                # 콜백
                if self.on_cycle_complete:
                    await self.on_cycle_complete(workload_id, cycle_result)
                
                # 상태 업데이트: RECORDING
                await self.update_workload_status(
                    workload_id,
                    WorkloadStatus.RECORDING,
                    completed_tasks=state.completed_tasks,
                    failed_tasks=state.failed_tasks
                )
                
                # 결과 기록
                await self._record_cycle_result(workload_id, video_id, cycle_result)
                
                await self._log(
                    workload_id,
                    LogLevel.INFO,
                    f"영상 처리 완료: {cycle_result.total_success}/{cycle_result.total_devices} 성공",
                    video_id=video_id
                )
                
                # 마지막 영상이 아니면 대기
                if idx < len(video_ids) - 1 and not state.should_stop:
                    wait_until = datetime.now(timezone.utc) + timedelta(
                        seconds=batch_config.cycle_interval_seconds
                    )
                    
                    await self.update_workload_status(
                        workload_id,
                        WorkloadStatus.WAITING,
                        next_cycle_at=wait_until.isoformat()
                    )
                    
                    await self._log(
                        workload_id,
                        LogLevel.INFO,
                        f"다음 영상까지 {batch_config.cycle_interval_seconds}초 대기"
                    )
                    
                    await asyncio.sleep(batch_config.cycle_interval_seconds)
            
            # 완료 처리
            final_status = (
                WorkloadStatus.CANCELLED if state.should_stop 
                else WorkloadStatus.COMPLETED
            )
            
            await self.update_workload_status(
                workload_id,
                final_status,
                completed_at=datetime.now(timezone.utc).isoformat(),
                total_tasks=state.total_tasks,
                completed_tasks=state.completed_tasks,
                failed_tasks=state.failed_tasks
            )
            
            await self._log(
                workload_id,
                LogLevel.INFO,
                f"워크로드 완료: {state.completed_tasks}/{state.total_tasks} 성공"
            )
            
            if self.on_workload_complete:
                await self.on_workload_complete(workload_id, state)
        
        except Exception as e:
            logger.error(f"워크로드 실행 오류: {workload_id} - {e}")
            state.last_error = str(e)
            
            await self.update_workload_status(
                workload_id,
                WorkloadStatus.ERROR
            )
            
            await self._log(
                workload_id,
                LogLevel.ERROR,
                f"워크로드 오류: {e}"
            )
        
        finally:
            state.is_running = False
            if workload_id in self._running_workloads:
                del self._running_workloads[workload_id]
    
    async def _execute_video_cycle(
        self,
        workload_id: str,
        video: VideoTarget,
        batch_config: BatchConfig,
        state: WorkloadState,
        target_workstations: Optional[List[str]] = None
    ) -> WorkloadCycleResult:
        """단일 영상 시청 사이클 실행"""
        started_at = datetime.now(timezone.utc)
        
        cycle_result = WorkloadCycleResult(
            video_id=video.video_id,
            video_title=video.title,
            started_at=started_at
        )
        
        # 배치 실행 컨텍스트
        context = BatchExecutionContext(
            workload_id=workload_id,
            video=video,
            batch_config=batch_config,
            watch_config=WatchConfig(),
            on_device_complete=self._make_device_complete_callback(workload_id, state)
        )
        
        # 대상 워크스테이션별 실행
        if target_workstations:
            for ws_id in target_workstations:
                batch_results = await self.executor.execute_half_batches(
                    context,
                    workstation_id=ws_id
                )
                cycle_result.batch_results.extend(batch_results)
        else:
            batch_results = await self.executor.execute_half_batches(context)
            cycle_result.batch_results.extend(batch_results)
        
        # 집계
        for batch in cycle_result.batch_results:
            cycle_result.total_devices += batch.total_devices
            cycle_result.total_success += batch.success_count
            cycle_result.total_failed += batch.failed_count
            
            for device_result in batch.device_results:
                cycle_result.total_watch_time += device_result.watch_time_seconds
        
        cycle_result.completed_at = datetime.now(timezone.utc)
        
        # 상태 업데이트
        state.total_tasks += cycle_result.total_devices
        state.completed_tasks += cycle_result.total_success
        state.failed_tasks += cycle_result.total_failed
        
        return cycle_result
    
    def _make_device_complete_callback(
        self,
        workload_id: str,
        state: WorkloadState
    ) -> Callable[[str, DeviceBatchResult], Awaitable[None]]:
        """디바이스 완료 콜백 생성"""
        async def callback(device_id: str, result: DeviceBatchResult) -> None:
            # 실시간 진행률 업데이트 (너무 자주 하지 않음)
            if state.completed_tasks % 10 == 0:
                await self.update_workload_status(
                    workload_id,
                    WorkloadStatus.EXECUTING,
                    completed_tasks=state.completed_tasks,
                    failed_tasks=state.failed_tasks
                )
        
        return callback
    
    # =========================================
    # 영상 정보
    # =========================================
    
    async def _get_video_info(self, video_id: str) -> Optional[VideoTarget]:
        """영상 정보 조회"""
        try:
            result = self.client.table("videos").select("*").eq(
                "id", video_id
            ).single().execute()
            
            if result.data:
                return VideoTarget(
                    video_id=video_id,
                    url=result.data["url"],
                    title=result.data.get("title"),
                    duration_seconds=result.data.get("duration")
                )
            return None
        except Exception as e:
            logger.error(f"영상 정보 조회 실패: {video_id} - {e}")
            return None
    
    # =========================================
    # 결과 기록
    # =========================================
    
    async def _record_cycle_result(
        self,
        workload_id: str,
        video_id: str,
        cycle_result: WorkloadCycleResult
    ) -> None:
        """사이클 결과를 DB에 기록"""
        try:
            # 영상 완료 카운트 업데이트
            self.client.table("videos").update({
                "completed_count": self.client.rpc(
                    "increment",
                    {"row_id": video_id, "column": "completed_count", "amount": cycle_result.total_success}
                ) if False else cycle_result.total_success  # RPC 대신 직접 업데이트
            }).eq("id", video_id).execute()
            
            # 개별 결과 기록 (results 테이블)
            for batch in cycle_result.batch_results:
                for device_result in batch.device_results:
                    result_data = {
                        "task_id": None,  # 워크로드 기반이므로 task_id 없음
                        "video_id": video_id,
                        "device_id": device_result.device_id,
                        "watch_time": device_result.watch_time_seconds,
                        "total_duration": 0,  # 영상 길이 (나중에 채움)
                        "liked": device_result.liked,
                        "commented": device_result.commented,
                        "error_message": device_result.error_message
                    }
                    
                    self.client.table("results").insert(result_data).execute()
            
            # 명령 히스토리 기록
            for batch in cycle_result.batch_results:
                for device_result in batch.device_results:
                    history_data = {
                        "device_id": device_result.device_id,
                        "device_hierarchy_id": device_result.device_hierarchy_id,
                        "command_type": "watch",
                        "command_data": {
                            "video_id": video_id,
                            "video_title": cycle_result.video_title
                        },
                        "status": device_result.status.value,
                        "result_data": {
                            "watch_time": device_result.watch_time_seconds,
                            "liked": device_result.liked
                        },
                        "error_message": device_result.error_message,
                        "workload_id": workload_id,
                        "sent_at": device_result.started_at.isoformat(),
                        "completed_at": device_result.completed_at.isoformat() if device_result.completed_at else None,
                        "duration_ms": device_result.duration_ms
                    }
                    
                    self.client.table("command_history").insert(history_data).execute()
        
        except Exception as e:
            logger.error(f"결과 기록 실패: {workload_id}/{video_id} - {e}")
    
    # =========================================
    # 로깅
    # =========================================
    
    async def _log(
        self,
        workload_id: str,
        level: LogLevel,
        message: str,
        video_id: Optional[str] = None,
        device_id: Optional[str] = None,
        batch_number: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """워크로드 로그 기록"""
        try:
            log_data = {
                "workload_id": workload_id,
                "level": level.value,
                "message": message,
                "video_id": video_id,
                "device_id": device_id,
                "batch_number": batch_number,
                "metadata": metadata or {},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.client.table("workload_logs").insert(log_data).execute()
        except Exception as e:
            logger.error(f"워크로드 로그 기록 실패: {e}")
    
    async def get_workload_logs(
        self,
        workload_id: str,
        level: Optional[LogLevel] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """워크로드 로그 조회"""
        try:
            query = self.client.table("workload_logs").select("*").eq(
                "workload_id", workload_id
            )
            
            if level:
                query = query.eq("level", level.value)
            
            result = query.order("created_at", desc=True).limit(limit).execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"워크로드 로그 조회 실패: {e}")
            return []
    
    # =========================================
    # 상태 조회
    # =========================================
    
    async def get_workload_status(self, workload_id: str) -> Optional[Dict[str, Any]]:
        """
        워크로드 실시간 상태 조회
        
        실행 중인 워크로드의 상세 상태 반환
        """
        workload = await self.get_workload(workload_id)
        if not workload:
            return None
        
        result = {
            "workload": workload.model_dump(),
            "is_running": workload_id in self._running_workloads
        }
        
        # 실행 중인 경우 추가 정보
        if workload_id in self._running_workloads:
            state = self._running_workloads[workload_id]
            result["live_state"] = {
                "current_video_index": state.current_video_index,
                "current_batch": state.current_batch,
                "total_tasks": state.total_tasks,
                "completed_tasks": state.completed_tasks,
                "failed_tasks": state.failed_tasks,
                "last_error": state.last_error
            }
        
        return result
    
    def get_active_workloads(self) -> List[str]:
        """실행 중인 워크로드 ID 목록"""
        return list(self._running_workloads.keys())
    
    # =========================================
    # 유틸리티
    # =========================================
    
    def _to_response(self, data: Dict[str, Any]) -> WorkloadResponse:
        """DB 레코드를 응답 스키마로 변환"""
        return WorkloadResponse(
            id=data["id"],
            name=data.get("name"),
            video_ids=data.get("video_ids", []),
            current_video_index=data.get("current_video_index", 0),
            batch_size_percent=data.get("batch_size_percent", 50),
            batch_interval_seconds=data.get("batch_interval_seconds", 60),
            cycle_interval_seconds=data.get("cycle_interval_seconds", 300),
            target_workstations=data.get("target_workstations"),
            status=WorkloadStatus(data.get("status", "pending")),
            total_tasks=data.get("total_tasks", 0),
            completed_tasks=data.get("completed_tasks", 0),
            failed_tasks=data.get("failed_tasks", 0),
            current_batch=data.get("current_batch", 0),
            total_batches=data.get("total_batches", 0),
            scheduled_at=datetime.fromisoformat(data["scheduled_at"]) if data.get("scheduled_at") else None,
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            next_cycle_at=datetime.fromisoformat(data["next_cycle_at"]) if data.get("next_cycle_at") else None,
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.utcnow()
        )


# 싱글톤 인스턴스
_engine: Optional[WorkloadEngine] = None


def get_workload_engine() -> WorkloadEngine:
    """WorkloadEngine 싱글톤 반환"""
    global _engine
    if _engine is None:
        _engine = WorkloadEngine()
    return _engine
