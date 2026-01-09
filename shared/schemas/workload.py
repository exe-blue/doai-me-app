"""
워크로드 관련 스키마 정의

워크로드 = 영상 리스팅 → 명령 → 결과 기록 → 대기 사이클
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid


class WorkloadStatus(str, Enum):
    """워크로드 상태"""
    PENDING = "pending"        # 대기 (시작 전)
    LISTING = "listing"        # 영상 리스팅 중
    EXECUTING = "executing"    # 명령 실행 중
    RECORDING = "recording"    # 결과 기록 중
    WAITING = "waiting"        # 다음 사이클 대기
    PAUSED = "paused"          # 일시 정지
    COMPLETED = "completed"    # 완료
    CANCELLED = "cancelled"    # 취소
    ERROR = "error"            # 오류


class CommandStatus(str, Enum):
    """명령 상태"""
    PENDING = "pending"
    SENT = "sent"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class LogLevel(str, Enum):
    """로그 레벨"""
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


# =========================================
# 배치 설정
# =========================================

class BatchConfig(BaseModel):
    """배치 실행 설정"""
    # 배치 크기 (% 단위, 50 = 전체의 50%씩 실행)
    batch_size_percent: int = Field(
        default=50,
        ge=10,
        le=100,
        description="한 번에 실행할 기기 비율 (%)"
    )
    
    # 배치 간 대기 시간 (초)
    batch_interval_seconds: int = Field(
        default=60,
        ge=10,
        le=600,
        description="배치 간 대기 시간 (초)"
    )
    
    # 사이클 간 대기 시간 (초)
    cycle_interval_seconds: int = Field(
        default=300,
        ge=60,
        le=3600,
        description="영상 간 대기 시간 (초)"
    )
    
    # 재시도 설정
    max_retries: int = Field(default=3, ge=0, le=10)
    retry_delay_seconds: int = Field(default=30, ge=5, le=300)
    
    # 타임아웃
    command_timeout_seconds: int = Field(
        default=120,
        ge=30,
        le=600,
        description="단일 명령 타임아웃"
    )


class WatchConfig(BaseModel):
    """시청 설정"""
    # 시청 시간 범위 (초)
    watch_duration_min: int = Field(default=30, ge=10)
    watch_duration_max: int = Field(default=120, le=600)
    
    # 인터랙션 확률
    like_probability: float = Field(default=0.05, ge=0.0, le=1.0)
    comment_probability: float = Field(default=0.02, ge=0.0, le=1.0)
    subscribe_probability: float = Field(default=0.01, ge=0.0, le=1.0)
    
    # 휴먼 패턴
    enable_random_scroll: bool = Field(default=True)
    enable_random_pause: bool = Field(default=True)


# =========================================
# 워크로드 생성/응답
# =========================================

class WorkloadCreate(BaseModel):
    """워크로드 생성 요청"""
    name: Optional[str] = Field(None, max_length=200)
    
    # 대상 영상
    video_ids: List[str] = Field(..., min_length=1, description="시청할 영상 ID 목록")
    
    # 대상 워크스테이션 (None = 전체)
    target_workstations: Optional[List[str]] = Field(
        None,
        description="대상 워크스테이션 ID 목록 (None = 전체)"
    )
    
    # 설정
    batch_config: Optional[BatchConfig] = None
    watch_config: Optional[WatchConfig] = None
    
    # 스케줄
    scheduled_at: Optional[datetime] = Field(
        None,
        description="예약 실행 시간 (None = 즉시)"
    )


class WorkloadUpdate(BaseModel):
    """워크로드 업데이트 요청"""
    name: Optional[str] = None
    status: Optional[WorkloadStatus] = None
    batch_config: Optional[BatchConfig] = None


class WorkloadInDB(BaseModel):
    """DB 저장 워크로드 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    
    # 대상 영상
    video_ids: List[str]
    current_video_index: int = 0
    
    # 설정
    batch_size_percent: int = 50
    batch_interval_seconds: int = 60
    cycle_interval_seconds: int = 300
    target_workstations: Optional[List[str]] = None
    
    # 상태
    status: WorkloadStatus = WorkloadStatus.PENDING
    
    # 진행률
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    current_batch: int = 0
    total_batches: int = 0
    
    # 타임스탬프
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_cycle_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


class WorkloadResponse(WorkloadInDB):
    """워크로드 응답 스키마"""
    progress_percent: float = Field(default=0.0)
    current_video_title: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    
    def __init__(self, **data: Any):
        super().__init__(**data)
        if self.total_tasks > 0:
            self.progress_percent = (self.completed_tasks / self.total_tasks) * 100


class WorkloadListResponse(BaseModel):
    """워크로드 목록 응답"""
    total: int
    pending: int
    active: int
    completed: int
    workloads: List[WorkloadResponse]


# =========================================
# 배치 결과
# =========================================

class DeviceBatchResult(BaseModel):
    """단일 디바이스 배치 결과"""
    device_id: str
    device_hierarchy_id: str
    status: CommandStatus
    
    # 시청 결과
    watch_time_seconds: int = 0
    liked: bool = False
    commented: bool = False
    subscribed: bool = False
    
    # 오류 정보
    error_message: Optional[str] = None
    retry_count: int = 0
    
    # 타임스탬프
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: int = 0


class BatchResult(BaseModel):
    """배치 실행 결과"""
    batch_number: int
    batch_group: str  # A 또는 B
    
    # 디바이스 수
    total_devices: int
    success_count: int = 0
    failed_count: int = 0
    
    # 상세 결과
    device_results: List[DeviceBatchResult] = []
    
    # 타임스탬프
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: float = 0.0


class WorkloadCycleResult(BaseModel):
    """워크로드 사이클 결과 (한 영상 처리 완료)"""
    video_id: str
    video_title: Optional[str] = None
    
    # 배치 결과
    batch_results: List[BatchResult] = []
    
    # 집계
    total_devices: int = 0
    total_success: int = 0
    total_failed: int = 0
    total_watch_time: int = 0
    
    # 타임스탬프
    started_at: datetime
    completed_at: Optional[datetime] = None


# =========================================
# 워크로드 로그
# =========================================

class WorkloadLogCreate(BaseModel):
    """워크로드 로그 생성"""
    workload_id: str
    level: LogLevel = LogLevel.INFO
    message: str
    
    # 컨텍스트
    video_id: Optional[str] = None
    device_id: Optional[str] = None
    batch_number: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkloadLogResponse(WorkloadLogCreate):
    """워크로드 로그 응답"""
    id: str
    created_at: datetime


# =========================================
# 명령 히스토리
# =========================================

class CommandHistoryCreate(BaseModel):
    """명령 히스토리 생성"""
    device_id: str
    device_hierarchy_id: Optional[str] = None
    workstation_id: Optional[str] = None
    
    # 명령 정보
    command_type: str  # watch, tap, swipe, adb, etc.
    command_data: Dict[str, Any]
    
    # 워크로드 연결
    workload_id: Optional[str] = None
    task_id: Optional[str] = None


class CommandHistoryUpdate(BaseModel):
    """명령 히스토리 업데이트"""
    status: CommandStatus
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None


class CommandHistoryResponse(BaseModel):
    """명령 히스토리 응답"""
    id: str
    device_id: Optional[str]
    device_hierarchy_id: Optional[str]
    workstation_id: Optional[str]
    
    command_type: str
    command_data: Dict[str, Any]
    
    status: CommandStatus
    result_data: Optional[Dict[str, Any]]
    error_message: Optional[str]
    
    workload_id: Optional[str]
    task_id: Optional[str]
    
    sent_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    created_at: datetime


class CommandHistoryListResponse(BaseModel):
    """명령 히스토리 목록 응답"""
    total: int
    commands: List[CommandHistoryResponse]
    
    # 통계
    success_count: int = 0
    failed_count: int = 0
    timeout_count: int = 0


# =========================================
# 워크로드 요약
# =========================================

class WorkloadSummary(BaseModel):
    """워크로드 요약 (대시보드용)"""
    id: str
    name: Optional[str]
    status: WorkloadStatus
    
    video_count: int
    current_video_index: int
    progress_percent: float
    
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    
    current_batch: int
    total_batches: int
    
    started_at: Optional[datetime]
    next_cycle_at: Optional[datetime]
    estimated_completion: Optional[datetime]


class ActiveWorkloadsResponse(BaseModel):
    """활성 워크로드 목록 (실시간 모니터링용)"""
    active_count: int
    workloads: List[WorkloadSummary]
    
    # 시스템 전체 통계
    total_devices_busy: int = 0
    total_videos_processing: int = 0
