"""
휴먼 패턴 관련 스키마 정의
- PDF 문서 기반 시청/터치/스크롤/인터랙션 패턴
"""
from datetime import datetime
from typing import Optional, List, Tuple
from enum import Enum
from pydantic import BaseModel, Field
import uuid


class PatternType(str, Enum):
    """패턴 유형"""
    WATCH = "watch"                 # 시청 패턴
    TOUCH = "touch"                 # 터치 패턴
    SCROLL = "scroll"               # 스크롤 패턴
    INTERACTION = "interaction"     # 인터랙션 패턴 (좋아요/댓글)
    SEARCH = "search"               # 검색/타이핑 패턴


# ==================== 시청 패턴 ====================

class WatchDistribution(str, Enum):
    """시청 시간 분포 타입"""
    BETA = "beta"               # Beta 분포 (Long-tail, 기본)
    NORMAL = "normal"           # 정규 분포
    UNIFORM = "uniform"         # 균등 분포


class WatchPatternConfig(BaseModel):
    """시청 패턴 설정"""
    distribution: WatchDistribution = WatchDistribution.BETA
    
    # Beta 분포 파라미터 (alpha=2, beta=5 → 초반 이탈 많음)
    alpha: float = Field(default=2.0, ge=0.1, le=10.0)
    beta: float = Field(default=5.0, ge=0.1, le=10.0)
    
    min_watch_seconds: int = Field(default=10, ge=1, description="최소 시청 시간 (초)")
    full_watch_probability: float = Field(default=0.05, ge=0, le=1, description="완전 시청 확률")
    
    # Seek (앞으로 가기) 설정
    seek_enabled: bool = True
    seek_count_min: int = Field(default=5, ge=0)
    seek_count_max: int = Field(default=20, ge=0)
    seek_direction: str = Field(default="forward", pattern="^(forward|backward|both)$")


class WatchPatternResult(BaseModel):
    """시청 패턴 생성 결과"""
    watch_time: int = Field(..., description="시청 시간 (초)")
    watch_percent: float = Field(..., description="시청 비율 (%)")
    is_full_watch: bool = Field(default=False)
    seek_count: int = Field(default=0)
    seek_timings: List[int] = Field(default_factory=list, description="Seek 실행 타이밍 (초)")


# ==================== 터치 패턴 ====================

class TouchAccuracy(str, Enum):
    """터치 정확도 레벨"""
    PRECISE = "precise"         # 정확 (봇처럼)
    NORMAL = "normal"           # 일반
    SLOPPY = "sloppy"           # 부정확


class TouchPatternConfig(BaseModel):
    """터치 패턴 설정"""
    accuracy: TouchAccuracy = TouchAccuracy.NORMAL
    
    # 터치 위치 분산 (정규분포 표준편차, 버튼 크기 대비 비율)
    position_std_ratio: float = Field(default=0.167, ge=0, le=0.5, 
                                       description="1/6 = 버튼 크기의 16.7%")
    
    # 터치 지속 시간 (ms)
    duration_min: int = Field(default=50, ge=10)
    duration_max: int = Field(default=200, ge=50)
    duration_mean: int = Field(default=100)
    duration_std: int = Field(default=30)
    
    # 더블 탭 간격 (ms)
    double_tap_interval_min: int = Field(default=100, ge=50)
    double_tap_interval_max: int = Field(default=300, ge=100)


class TouchPoint(BaseModel):
    """터치 포인트"""
    x: int
    y: int
    duration: int = Field(default=100, description="터치 지속 시간 (ms)")


class TouchPatternResult(BaseModel):
    """터치 패턴 생성 결과"""
    tap_point: TouchPoint
    is_offset: bool = Field(default=True, description="중심에서 오프셋 적용됨")
    offset_x: int = 0
    offset_y: int = 0


# ==================== 스크롤/스와이프 패턴 ====================

class SwipeEasing(str, Enum):
    """스와이프 이징 함수"""
    LINEAR = "linear"
    EASE_IN = "ease_in"
    EASE_OUT = "ease_out"
    EASE_IN_OUT = "ease_in_out"     # Smoothstep (기본)
    BEZIER = "bezier"               # 베지어 곡선


class ScrollPatternConfig(BaseModel):
    """스크롤/스와이프 패턴 설정"""
    easing: SwipeEasing = SwipeEasing.EASE_IN_OUT
    
    # 속도 변화
    duration_min: int = Field(default=200, ge=100, description="최소 스와이프 시간 (ms)")
    duration_max: int = Field(default=600, ge=200, description="최대 스와이프 시간 (ms)")
    
    # 노이즈 (무작위 흔들림)
    noise_enabled: bool = True
    noise_std: float = Field(default=2.0, ge=0, le=10, description="노이즈 표준편차 (px)")
    
    # 스크롤 후 대기 시간
    pause_after_min: int = Field(default=500, ge=0)
    pause_after_max: int = Field(default=2000, ge=0)
    
    # 즉시 스킵 확률 (1초 이내)
    instant_skip_probability: float = Field(default=0.25, ge=0, le=1)
    
    # 짧은 시청 확률 (1-3초)
    short_view_probability: float = Field(default=0.30, ge=0, le=1)


class SwipePoint(BaseModel):
    """스와이프 경로 포인트"""
    x: int
    y: int
    timestamp: int = Field(default=0, description="시작부터의 시간 (ms)")


class ScrollPatternResult(BaseModel):
    """스크롤 패턴 생성 결과"""
    path: List[SwipePoint]
    total_duration: int
    pause_after: int
    easing_applied: SwipeEasing


# ==================== 인터랙션 패턴 ====================

class InteractionPatternConfig(BaseModel):
    """인터랙션 패턴 설정 (좋아요/댓글)"""
    # 좋아요 확률 범위
    like_rate_min: float = Field(default=0.20, ge=0, le=1)
    like_rate_max: float = Field(default=0.70, ge=0, le=1)
    
    # 좋아요 타이밍 분포
    like_timing_immediate: float = Field(default=0.02, description="즉시 (5초 이내)")
    like_timing_middle: float = Field(default=0.35, description="시청 중간")
    like_timing_after: float = Field(default=0.45, description="시청 완료 직후")
    like_timing_delayed: float = Field(default=0.18, description="10초+ 후")
    
    # 댓글 확률 범위
    comment_rate_min: float = Field(default=0.10, ge=0, le=1)
    comment_rate_max: float = Field(default=0.50, ge=0, le=1)
    
    # 댓글 템플릿
    comment_templates: List[str] = Field(default_factory=lambda: [
        "좋은 영상이네요!",
        "정말 유익합니다",
        "잘 봤습니다 👍",
        "도움이 많이 됐어요",
        "감사합니다!"
    ])


class InteractionTiming(BaseModel):
    """인터랙션 타이밍"""
    like_at: Optional[int] = Field(None, description="좋아요 타이밍 (초)")
    comment_at: Optional[int] = Field(None, description="댓글 타이밍 (초)")


class InteractionPatternResult(BaseModel):
    """인터랙션 패턴 생성 결과"""
    should_like: bool
    like_timing: Optional[int] = None
    
    should_comment: bool
    comment_timing: Optional[int] = None
    comment_text: Optional[str] = None


# ==================== 검색/타이핑 패턴 ====================

class TypingPatternConfig(BaseModel):
    """타이핑 패턴 설정"""
    # 타이핑 속도 (글자당 ms)
    char_delay_min: int = Field(default=80, ge=30)
    char_delay_max: int = Field(default=200, ge=50)
    char_delay_mean: int = Field(default=120)
    char_delay_std: int = Field(default=40)
    
    # 오타 확률
    typo_probability: float = Field(default=0.03, ge=0, le=0.2)
    
    # 단어 간 추가 딜레이
    word_pause_min: int = Field(default=100, ge=0)
    word_pause_max: int = Field(default=400, ge=0)
    
    # 중간 멈춤 (생각하는 시간)
    think_pause_probability: float = Field(default=0.1, ge=0, le=0.5)
    think_pause_min: int = Field(default=500, ge=100)
    think_pause_max: int = Field(default=2000, ge=500)


class TypingEvent(BaseModel):
    """타이핑 이벤트"""
    char: str
    delay_before: int = Field(default=0, description="입력 전 대기 (ms)")
    is_typo: bool = False
    is_backspace: bool = False


class TypingPatternResult(BaseModel):
    """
    타이핑 패턴 생성 결과 - Aria's Somatic Engine
    
    "떨리는 손끝과 망설이는 마음"
    """
    events: List[TypingEvent]
    total_duration: int
    typo_count: int
    rewrite_count: int = Field(default=0, description="전체 삭제 후 다시 쓰기 횟수")
    think_pause_count: int = Field(default=0, description="생각하는 시간 멈춤 횟수")


# ==================== 통합 패턴 설정 ====================

class HumanPatternConfig(BaseModel):
    """통합 휴먼 패턴 설정"""
    watch: WatchPatternConfig = Field(default_factory=WatchPatternConfig)
    touch: TouchPatternConfig = Field(default_factory=TouchPatternConfig)
    scroll: ScrollPatternConfig = Field(default_factory=ScrollPatternConfig)
    interaction: InteractionPatternConfig = Field(default_factory=InteractionPatternConfig)
    typing: TypingPatternConfig = Field(default_factory=TypingPatternConfig)
    
    # 랜덤 시청 (탐색 중)
    random_watch_enabled: bool = True
    random_watch_probability: float = Field(default=0.05, ge=0, le=0.2)
    random_watch_duration_min: int = Field(default=5, ge=1)
    random_watch_duration_max: int = Field(default=60, ge=5)


class GeneratedPattern(BaseModel):
    """생성된 패턴 전체"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    config: HumanPatternConfig
    watch: WatchPatternResult
    touch: TouchPatternConfig  # 런타임에 적용
    scroll: ScrollPatternConfig  # 런타임에 적용
    interaction: InteractionPatternResult
    typing: TypingPatternConfig  # 런타임에 적용
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PatternRequest(BaseModel):
    """패턴 생성 요청"""
    video_duration: int = Field(..., ge=1, description="영상 길이 (초)")
    config_override: Optional[HumanPatternConfig] = None


class PatternResponse(BaseModel):
    """패턴 생성 응답"""
    pattern: GeneratedPattern
    recommended_actions: List[str] = Field(default_factory=list)

