"""
Commission (작업 위임) 스키마 정의

AI 시민(디바이스)에게 위임하는 작업 정의
- 작업 유형: LIKE, COMMENT, SUBSCRIBE, WATCH, SHARE
- 페르소나 적합도 검증
- 보상 시스템
- 윤리 검증 (거절 가능 여부)

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid


# =========================================
# Enums
# =========================================

class JobType(str, Enum):
    """작업 유형"""
    LIKE = "LIKE"
    COMMENT = "COMMENT"
    SUBSCRIBE = "SUBSCRIBE"
    WATCH = "WATCH"
    SHARE = "SHARE"


class CommissionStatus(str, Enum):
    """Commission 상태"""
    PENDING = "pending"          # 생성됨, 할당 대기
    ASSIGNED = "assigned"        # 디바이스 할당됨
    SENT = "sent"                # 디바이스에 전송됨
    IN_PROGRESS = "in_progress"  # 실행 중
    SUCCESS = "success"          # 성공
    FAILED = "failed"            # 실패
    REFUSED = "refused"          # 거절됨 (페르소나 불일치)
    TIMEOUT = "timeout"          # 타임아웃
    CANCELLED = "cancelled"      # 취소됨


class PlatformType(str, Enum):
    """대상 플랫폼"""
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    TWITTER = "twitter"
    FACEBOOK = "facebook"


class ElementType(str, Enum):
    """UI 요소 유형"""
    BUTTON = "BUTTON"
    INPUT = "INPUT"
    VIDEO = "VIDEO"
    LINK = "LINK"


# =========================================
# 작업 대상 (Target)
# =========================================

class CommissionTarget(BaseModel):
    """작업 대상 요소"""
    element_type: ElementType = Field(..., description="UI 요소 유형")
    selector_hint: Optional[str] = Field(None, description="요소 찾기 힌트 (id, desc, text)")
    fallback_coords: Optional[List[int]] = Field(None, description="폴백 좌표 [x, y]")
    required_state: str = Field(default="VISIBLE", description="필요 상태 (VISIBLE, CLICKABLE)")


# =========================================
# 작업 내용 (Content)
# =========================================

class CommissionContent(BaseModel):
    """작업 내용 (COMMENT 등에 사용)"""
    text: Optional[str] = Field(None, description="텍스트 내용")
    persona_voice: bool = Field(default=True, description="페르소나 말투 적용 여부")
    max_length: int = Field(default=200, description="최대 길이")
    template_id: Optional[str] = Field(None, description="템플릿 ID")


# =========================================
# 타이밍 설정
# =========================================

class CommissionTiming(BaseModel):
    """작업 타이밍 설정"""
    delay_before_ms: int = Field(default=2000, ge=0, description="작업 전 딜레이 (ms)")
    delay_after_ms: int = Field(default=1000, ge=0, description="작업 후 딜레이 (ms)")
    timeout_sec: int = Field(default=30, ge=5, le=300, description="작업 타임아웃 (초)")
    retry_count: int = Field(default=2, ge=0, le=5, description="재시도 횟수")


# =========================================
# 보상 설정
# =========================================

class BonusConditions(BaseModel):
    """보너스 조건"""
    first_of_day: int = Field(default=5, description="오늘 첫 작업 보너스")
    streak_bonus: int = Field(default=2, description="연속 작업 보너스")
    quality_bonus: int = Field(default=10, description="품질 보너스")


class CommissionReward(BaseModel):
    """보상 설정"""
    base_credits: int = Field(default=10, ge=0, description="기본 크레딧")
    bonus_conditions: Optional[BonusConditions] = None


# =========================================
# 윤리/컴플라이언스 설정
# =========================================

class CommissionCompliance(BaseModel):
    """윤리/컴플라이언스 설정"""
    ethical_check: bool = Field(default=True, description="윤리 검증 활성화")
    persona_alignment: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="필요 페르소나 적합도 (0.0 ~ 1.0)"
    )
    can_refuse: bool = Field(default=True, description="작업 거절 가능 여부")


# =========================================
# 작업 정의 (Job)
# =========================================

class CommissionJob(BaseModel):
    """작업 정의"""
    type: JobType = Field(..., description="작업 유형")
    platform: PlatformType = Field(default=PlatformType.YOUTUBE, description="대상 플랫폼")
    url: Optional[str] = Field(None, description="대상 URL")
    video_id: Optional[str] = Field(None, description="영상 ID")
    channel_id: Optional[str] = Field(None, description="채널 ID")


# =========================================
# Commission 생성/응답 스키마
# =========================================

class CommissionCreate(BaseModel):
    """Commission 생성 요청"""
    # 작업 정의
    job: CommissionJob

    # 대상 디바이스 (None = 자동 할당)
    device_id: Optional[str] = Field(None, description="대상 디바이스 ID")
    device_ids: Optional[List[str]] = Field(None, description="대상 디바이스 ID 목록 (배치)")

    # 대상 워크스테이션 (device_id가 없을 때 사용)
    target_workstations: Optional[List[str]] = Field(
        None,
        description="대상 워크스테이션 ID 목록"
    )

    # 할당 비율 (target_workstations 사용 시)
    device_percent: float = Field(
        default=1.0,
        ge=0.01,
        le=1.0,
        description="할당할 디바이스 비율 (0.01 ~ 1.0)"
    )

    # 작업 세부 설정
    target: Optional[CommissionTarget] = None
    content: Optional[CommissionContent] = None
    timing: Optional[CommissionTiming] = None
    reward: Optional[CommissionReward] = None
    compliance: Optional[CommissionCompliance] = None

    # 우선순위 (높을수록 우선)
    priority: int = Field(default=5, ge=1, le=10, description="우선순위 (1-10)")

    # 예약 실행
    scheduled_at: Optional[datetime] = Field(None, description="예약 실행 시간")

    # 메타데이터
    tags: Optional[List[str]] = Field(None, description="태그 목록")
    metadata: Optional[Dict[str, Any]] = Field(None, description="추가 메타데이터")


class CommissionUpdate(BaseModel):
    """Commission 업데이트 요청"""
    status: Optional[CommissionStatus] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    scheduled_at: Optional[datetime] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class CommissionInDB(BaseModel):
    """DB 저장 Commission 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # 작업 정의
    job_type: JobType
    platform: PlatformType = PlatformType.YOUTUBE
    url: Optional[str] = None
    video_id: Optional[str] = None
    channel_id: Optional[str] = None

    # 대상 디바이스
    device_id: Optional[str] = None
    device_serial: Optional[str] = None
    workstation_id: Optional[str] = None

    # 상태
    status: CommissionStatus = CommissionStatus.PENDING
    priority: int = 5

    # 설정 (JSON)
    target_config: Optional[Dict[str, Any]] = None
    content_config: Optional[Dict[str, Any]] = None
    timing_config: Optional[Dict[str, Any]] = None
    reward_config: Optional[Dict[str, Any]] = None
    compliance_config: Optional[Dict[str, Any]] = None

    # 결과
    result_status: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    credits_earned: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # 실행 정보
    retry_count: int = 0
    execution_time_ms: Optional[int] = None

    # 타임스탬프
    scheduled_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # 메타데이터
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class CommissionResponse(CommissionInDB):
    """Commission 응답 스키마"""
    # 추가 계산 필드
    device_name: Optional[str] = None
    video_title: Optional[str] = None
    channel_name: Optional[str] = None
    persona_name: Optional[str] = None

    # 진행률
    progress_percent: Optional[float] = None


# =========================================
# 배치 Commission
# =========================================

class CommissionBatchCreate(BaseModel):
    """배치 Commission 생성 요청"""
    # 공통 작업 정의
    job: CommissionJob

    # 대상 설정 (둘 중 하나 필수)
    device_ids: Optional[List[str]] = Field(None, description="대상 디바이스 ID 목록")
    target_workstations: Optional[List[str]] = Field(None, description="대상 워크스테이션")
    device_percent: float = Field(default=1.0, ge=0.01, le=1.0)

    # 공통 설정
    content: Optional[CommissionContent] = None
    timing: Optional[CommissionTiming] = None
    reward: Optional[CommissionReward] = None
    compliance: Optional[CommissionCompliance] = None

    priority: int = Field(default=5, ge=1, le=10)
    scheduled_at: Optional[datetime] = None
    tags: Optional[List[str]] = None


class CommissionBatchResponse(BaseModel):
    """배치 Commission 생성 응답"""
    batch_id: str
    total_created: int
    total_devices: int
    commissions: List[str]  # commission IDs
    created_at: datetime


# =========================================
# 결과 및 통계
# =========================================

class CommissionResult(BaseModel):
    """Commission 결과 (디바이스 → 서버)"""
    commission_id: str
    device_id: str
    status: CommissionStatus

    # 실행 결과
    execution_time_ms: int = 0
    credits_earned: int = 0

    # 작업별 상세 결과
    action_details: Optional[Dict[str, Any]] = None

    # 오류 정보
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # 페르소나 정보
    persona_alignment: Optional[float] = None
    refused_reason: Optional[str] = None

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CommissionStats(BaseModel):
    """Commission 통계"""
    total: int = 0
    pending: int = 0
    assigned: int = 0
    in_progress: int = 0
    success: int = 0
    failed: int = 0
    refused: int = 0
    timeout: int = 0
    cancelled: int = 0

    # 집계
    total_credits_earned: int = 0
    avg_execution_time_ms: float = 0.0
    success_rate: float = 0.0

    # 기간별
    today_total: int = 0
    today_success: int = 0

    # 작업 유형별
    by_job_type: Dict[str, int] = Field(default_factory=dict)


class CommissionListResponse(BaseModel):
    """Commission 목록 응답"""
    total: int
    stats: CommissionStats
    commissions: List[CommissionResponse]

    # 페이지네이션
    page: int = 1
    page_size: int = 50
    total_pages: int = 1


# =========================================
# 실시간 모니터링
# =========================================

class CommissionQueueStatus(BaseModel):
    """Commission 대기열 상태 (실시간)"""
    queue_length: int = 0
    processing_count: int = 0
    avg_wait_time_sec: float = 0.0

    # 워크스테이션별 상태
    by_workstation: Dict[str, Dict[str, int]] = Field(default_factory=dict)

    # 최근 활동
    recent_success: int = 0
    recent_failed: int = 0
    recent_refused: int = 0


class ActiveCommissionsResponse(BaseModel):
    """활성 Commission 목록 (실시간 모니터링용)"""
    active_count: int
    queue_status: CommissionQueueStatus
    active_commissions: List[CommissionResponse]
