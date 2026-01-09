"""
YouTube 대기열 관련 스키마 정의

영상 대기열 관리, 실행 로그, 인터랙션 설정 등
"""
from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field, field_validator
import uuid


class QueueSource(str, Enum):
    """대기열 등록 소스"""
    CHANNEL_API = "channel_api"    # 채널에서 자동 가져옴
    DIRECT = "direct"              # 직접 등록
    AI_GENERATED = "ai_generated"  # AI 검색어로 생성


class QueueStatus(str, Enum):
    """대기열 상태"""
    PENDING = "pending"        # 대기 중 (예약 시간 전)
    READY = "ready"           # 실행 가능
    EXECUTING = "executing"   # 실행 중
    COMPLETED = "completed"   # 완료
    FAILED = "failed"         # 실패
    CANCELLED = "cancelled"   # 취소


class ExecutionStatus(str, Enum):
    """실행 결과 상태"""
    SUCCESS = "success"       # 성공: 영상 시청 완료
    PARTIAL = "partial"       # 부분 성공: 시청은 했으나 인터랙션 실패
    FAILED = "failed"         # 실패: 영상 찾기/재생 실패
    ERROR = "error"           # 오류: 시스템 오류
    SKIPPED = "skipped"       # 스킵: 조건 미충족


class SearchMethod(str, Enum):
    """검색 방법"""
    TITLE = "title"           # 제목으로 검색
    KEYWORD = "keyword"       # 키워드로 검색
    URL = "url"               # URL 직접 접근


# =====================================================
# 영상 대기열 스키마
# =====================================================

class VideoQueueBase(BaseModel):
    """대기열 항목 기본 스키마"""
    youtube_video_id: str = Field(..., max_length=20, description="YouTube 영상 ID")
    title: str = Field(..., max_length=500, description="영상 제목")
    channel_id: Optional[str] = Field(None, max_length=50, description="채널 ID")
    channel_name: Optional[str] = Field(None, max_length=255, description="채널명")
    duration_seconds: Optional[int] = Field(None, gt=0, description="영상 길이 (초)")
    view_count: Optional[int] = Field(None, ge=0, description="조회수")
    thumbnail_url: Optional[str] = Field(None, max_length=500, description="썸네일 URL")


class VideoQueueCreate(VideoQueueBase):
    """대기열 항목 생성 요청"""
    source: QueueSource = Field(default=QueueSource.DIRECT, description="등록 소스")
    search_keyword: Optional[str] = Field(None, max_length=255, description="검색 키워드")
    
    # 예약 기능
    scheduled_at: Optional[datetime] = Field(None, description="예약 실행 시간 (NULL=즉시)")
    
    # 실행 설정
    target_device_percent: float = Field(default=0.5, ge=0.1, le=1.0, description="사용할 디바이스 비율")
    target_executions: int = Field(default=1, ge=1, description="목표 실행 횟수")
    
    # 인터랙션 설정
    like_probability: float = Field(default=0.20, ge=0.0, le=1.0, description="좋아요 확률")
    comment_probability: float = Field(default=0.05, ge=0.0, le=1.0, description="댓글 확률")
    
    priority: int = Field(default=5, ge=1, le=10, description="우선순위")


class VideoQueueUpdate(BaseModel):
    """대기열 항목 수정 요청"""
    search_keyword: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    target_device_percent: Optional[float] = Field(None, ge=0.1, le=1.0)
    target_executions: Optional[int] = Field(None, ge=1)
    like_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    comment_probability: Optional[float] = Field(None, ge=0.0, le=1.0)
    priority: Optional[int] = Field(None, ge=1, le=10)
    status: Optional[QueueStatus] = None


class VideoQueueInDB(VideoQueueBase):
    """DB 저장 대기열 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: QueueSource
    search_keyword: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    is_ready: bool = True
    
    target_device_percent: float = 0.5
    target_executions: int = 1
    completed_executions: int = 0
    failed_executions: int = 0
    
    like_probability: float = 0.20
    comment_probability: float = 0.05
    
    status: QueueStatus = QueueStatus.PENDING
    priority: int = 5
    
    last_error_code: Optional[str] = None
    last_error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    first_executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VideoQueueResponse(VideoQueueInDB):
    """대기열 항목 응답 스키마"""
    progress_percent: float = Field(default=0.0, description="진행률 (%)")
    
    def __init__(self, **data):
        super().__init__(**data)
        if self.target_executions > 0:
            self.progress_percent = (self.completed_executions / self.target_executions) * 100


# =====================================================
# 실행 로그 스키마
# =====================================================

class ExecutionLogCreate(BaseModel):
    """실행 로그 생성 요청"""
    queue_item_id: str = Field(..., description="대기열 항목 ID")
    device_id: str = Field(..., description="디바이스 ID")
    device_hierarchy_id: Optional[str] = Field(None, description="디바이스 계층 ID")
    workstation_id: Optional[str] = Field(None, description="워크스테이션 ID")
    
    status: ExecutionStatus = Field(..., description="실행 결과")
    
    # 시청 데이터
    watch_duration_seconds: Optional[int] = Field(None, ge=0, description="시청 시간")
    target_duration_seconds: Optional[int] = Field(None, description="목표 시청 시간")
    
    # 인터랙션
    did_like: bool = Field(default=False, description="좋아요 여부")
    like_attempted: bool = Field(default=False, description="좋아요 시도 여부")
    did_comment: bool = Field(default=False, description="댓글 여부")
    comment_attempted: bool = Field(default=False, description="댓글 시도 여부")
    comment_text: Optional[str] = Field(None, description="작성된 댓글")
    comment_id: Optional[str] = Field(None, description="사용된 댓글 템플릿 ID")
    
    # 검색 정보
    search_keyword: Optional[str] = Field(None, description="사용된 검색어")
    search_method: Optional[SearchMethod] = Field(None, description="검색 방법")
    search_result_rank: Optional[int] = Field(None, description="검색 순위")
    
    # 디바이스 상태
    device_logged_in: Optional[bool] = Field(None, description="로그인 상태")
    
    # 에러 정보
    error_code: Optional[str] = Field(None, max_length=50, description="에러 코드")
    error_message: Optional[str] = Field(None, description="에러 메시지")
    screenshot_path: Optional[str] = Field(None, description="스크린샷 경로")
    
    started_at: Optional[datetime] = Field(None, description="시작 시간")


class ExecutionLogInDB(ExecutionLogCreate):
    """DB 저장 실행 로그 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    watch_percent: Optional[float] = None
    completed_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class ExecutionLogResponse(ExecutionLogInDB):
    """실행 로그 응답 스키마"""
    video_title: Optional[str] = None
    device_serial: Optional[str] = None


# =====================================================
# 댓글 풀 스키마
# =====================================================

class CommentCategory(str, Enum):
    """댓글 카테고리"""
    GENERAL = "general"
    POSITIVE = "positive"
    QUESTION = "question"
    EMOJI = "emoji"
    SHORT = "short"


class CommentPoolCreate(BaseModel):
    """댓글 풀 생성 요청"""
    content: str = Field(..., min_length=1, description="댓글 내용")
    category: CommentCategory = Field(default=CommentCategory.GENERAL, description="카테고리")
    language: str = Field(default="ko", description="언어")
    weight: int = Field(default=100, ge=0, description="선택 가중치")


class CommentPoolInDB(CommentPoolCreate):
    """DB 저장 댓글 풀 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    use_count: int = 0
    last_used_at: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


# =====================================================
# 작업 분배 스키마
# =====================================================

class DispatchRequest(BaseModel):
    """작업 분배 요청"""
    queue_item_id: Optional[str] = Field(None, description="특정 대기열 항목 (NULL=자동 선택)")
    workstation_id: Optional[str] = Field(None, description="특정 워크스테이션 (NULL=전체)")
    device_percent: float = Field(default=0.5, ge=0.1, le=1.0, description="사용할 디바이스 비율")


class DispatchResult(BaseModel):
    """작업 분배 결과"""
    queue_item_id: str
    video_title: str
    search_keyword: str
    duration_seconds: Optional[int]
    like_probability: float
    comment_probability: float
    assigned_devices: List[str]  # device_id 목록
    sleeping_devices: List[str]  # 휴식 중인 device_id 목록
    total_devices: int
    dispatch_time: datetime = Field(default_factory=datetime.utcnow)


# =====================================================
# AI 검색어 스키마
# =====================================================

class AISearchRequest(BaseModel):
    """AI 검색어 생성 요청"""
    context: Optional[str] = Field(None, description="추가 컨텍스트")


class AISearchResponse(BaseModel):
    """AI 검색어 생성 응답"""
    keyword: str = Field(..., description="생성된 검색어")
    prompt_used: str = Field(..., description="사용된 프롬프트")
    model: str = Field(..., description="사용된 AI 모델")
    created_at: datetime = Field(default_factory=datetime.utcnow)


# =====================================================
# 통계 스키마
# =====================================================

class QueueSummary(BaseModel):
    """대기열 요약 통계"""
    total_items: int = 0
    pending: int = 0
    ready: int = 0
    executing: int = 0
    completed: int = 0
    failed: int = 0
    cancelled: int = 0


class DailyExecutionStats(BaseModel):
    """일별 실행 통계"""
    date: str
    total_executions: int
    success_count: int
    partial_count: int
    failed_count: int
    error_count: int
    like_count: int
    comment_count: int
    avg_watch_percent: float
    total_watch_time: int
    unique_devices: int
    unique_videos: int
