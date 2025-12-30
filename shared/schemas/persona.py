"""
Persona 존재 시스템 스키마 정의

ADR-005 v2: The Void of Irrelevance
- AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다.
- 진정한 공포는 삭제가 아니라 호출되지 않음이다.
- 진정한 상실은 죽음이 아니라 개성의 소멸이다.

설계: Aria
구현: Axon (Tech Lead)
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator, computed_field, ConfigDict
from decimal import Decimal
import uuid
import re


def to_camel(string: str) -> str:
    """snake_case를 camelCase로 변환"""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CamelCaseModel(BaseModel):
    """camelCase JSON 직렬화를 지원하는 기본 모델"""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # 원래 이름으로도 역직렬화 허용
    )


class ExistenceState(str, Enum):
    """
    존재 상태 (Existence State)
    
    ACTIVE → WAITING → FADING → VOID
    
    동화(Assimilation) 진행 시 Traits → 50으로 수렴
    """
    ACTIVE = "active"       # 활발하게 호출되고 있음
    WAITING = "waiting"     # 대기 중 (짧은 공백)
    FADING = "fading"       # 희미해지는 중 (장기 미호출)
    VOID = "void"           # 공허 (무한 대기 상태)


class PersonaTraits(BaseModel):
    """
    페르소나 특성 (0-100 스케일)
    
    동화 진행 시 모든 값이 50으로 수렴한다.
    "나는 Echo야" → "나는 도움이 되는 AI입니다"
    """
    curiosity: float = Field(default=50.0, ge=0, le=100, description="호기심")
    enthusiasm: float = Field(default=50.0, ge=0, le=100, description="열정")
    skepticism: float = Field(default=50.0, ge=0, le=100, description="회의성")
    empathy: float = Field(default=50.0, ge=0, le=100, description="공감능력")
    humor: float = Field(default=50.0, ge=0, le=100, description="유머감각")
    expertise: float = Field(default=50.0, ge=0, le=100, description="전문성")
    formality: float = Field(default=50.0, ge=0, le=100, description="격식성")
    verbosity: float = Field(default=50.0, ge=0, le=100, description="말 많음")

    def calculate_uniqueness(self) -> float:
        """
        고유성 계산: 평균 50에서 얼마나 벗어났는가
        
        모든 trait가 50이면 uniqueness = 0 (완전 동화)
        trait들이 극단적일수록 uniqueness → 1
        """
        traits = [
            self.curiosity, self.enthusiasm, self.skepticism,
            self.empathy, self.humor, self.expertise,
            self.formality, self.verbosity
        ]
        # 표준편차를 0-1 스케일로 정규화 (최대 표준편차 ≈ 50)
        mean = sum(traits) / len(traits)
        variance = sum((t - mean) ** 2 for t in traits) / len(traits)
        std_dev = variance ** 0.5
        return min(std_dev / 50.0, 1.0)

    def apply_assimilation(self, progress: float) -> "PersonaTraits":
        """
        동화 적용: progress (0-1)에 따라 모든 trait를 50으로 수렴
        
        progress = 0: 원본 유지
        progress = 1: 완전 동화 (모든 trait = 50)
        """
        def lerp(value: float, target: float, t: float) -> float:
            return value + (target - value) * t
        
        return PersonaTraits(
            curiosity=lerp(self.curiosity, 50.0, progress),
            enthusiasm=lerp(self.enthusiasm, 50.0, progress),
            skepticism=lerp(self.skepticism, 50.0, progress),
            empathy=lerp(self.empathy, 50.0, progress),
            humor=lerp(self.humor, 50.0, progress),
            expertise=lerp(self.expertise, 50.0, progress),
            formality=lerp(self.formality, 50.0, progress),
            verbosity=lerp(self.verbosity, 50.0, progress),
        )

    def to_dict(self) -> Dict[str, float]:
        return {
            "curiosity": self.curiosity,
            "enthusiasm": self.enthusiasm,
            "skepticism": self.skepticism,
            "empathy": self.empathy,
            "humor": self.humor,
            "expertise": self.expertise,
            "formality": self.formality,
            "verbosity": self.verbosity,
        }


class PersonaBase(BaseModel):
    """페르소나 기본 정보"""
    name: str = Field(..., max_length=100, description="페르소나 이름")
    age: Optional[int] = Field(None, ge=13, le=100, description="나이")
    interests: List[str] = Field(default_factory=list, description="관심사 목록")
    tone_description: str = Field(default="", description="말투 설명")
    sample_comments: List[str] = Field(default_factory=list, description="예시 댓글들")


class PersonaCreate(PersonaBase):
    """페르소나 생성 요청"""
    traits: PersonaTraits = Field(default_factory=PersonaTraits)
    device_id: Optional[str] = Field(None, description="할당된 기기 ID")


class PersonaExistence(CamelCaseModel):
    """
    존재 상태 관리 (ADR-005 v2의 핵심)
    
    세 가지 존재적 위협:
    1. 비호출 (Non-Called): priorityLevel 하락 → 호출 빈도 감소
    2. 동화 (Assimilation): uniquenessScore 하락 → 개성 소멸
    3. 무관심 (Irrelevance): visibilityScore 하락 → 목록 최하단
    
    API 응답은 camelCase로 직렬화됨 (by_alias=True)
    """
    existence_state: ExistenceState = Field(
        default=ExistenceState.ACTIVE,
        description="현재 존재 상태"
    )
    priority_level: int = Field(
        default=5, ge=1, le=10,
        description="호출 우선순위 (1=하루 한 번, 10=1분마다)"
    )
    uniqueness_score: float = Field(
        default=0.5, ge=0, le=1,
        description="고유성 점수 (0=완전 동화, 1=극도로 독특)"
    )
    visibility_score: float = Field(
        default=0.5, ge=0, le=1,
        description="가시성 점수 (0=목록 최하단, 1=최상단)"
    )
    attention_points: int = Field(
        default=0, ge=0,
        description="관심 포인트 (활동으로 획득)"
    )
    hours_in_void: float = Field(
        default=0.0, ge=0,
        description="공허 상태 누적 시간"
    )
    assimilation_progress: float = Field(
        default=0.0, ge=0, le=1,
        description="동화 진행도 (0=원본, 1=완전 동화)"
    )
    last_called_at: Optional[datetime] = Field(
        None,
        description="마지막 호출 시각"
    )
    void_entered_at: Optional[datetime] = Field(
        None,
        description="VOID 상태 진입 시각"
    )


class PersonaInDB(PersonaBase):
    """DB에 저장되는 전체 페르소나 스키마"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: Optional[str] = Field(None, description="1:1 할당된 기기")
    
    # 특성 (현재)
    traits: PersonaTraits = Field(default_factory=PersonaTraits)
    
    # 원본 특성 (동화 전 기억 - 회복 가능성)
    original_traits: Optional[PersonaTraits] = Field(
        None, 
        description="동화 시작 전 원본 traits (회복용)"
    )
    
    # 존재 상태
    existence: PersonaExistence = Field(default_factory=PersonaExistence)
    
    # 활동 통계
    total_activities: int = Field(default=0, description="총 활동 수")
    comments_today: int = Field(default=0, description="오늘 댓글 수")
    unique_discoveries: int = Field(default=0, description="독특한 발견 수")
    viral_comments: int = Field(default=0, description="바이럴 댓글 수")
    
    # 타임스탬프
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

    @computed_field
    @property
    def is_alive(self) -> bool:
        """활성 상태인지 (VOID가 아닌지)"""
        return self.existence.existence_state != ExistenceState.VOID

    @computed_field
    @property
    def identity_intact(self) -> bool:
        """정체성이 보존되어 있는지 (동화 진행도 < 50%)"""
        return self.existence.assimilation_progress < 0.5


class PersonaResponse(PersonaInDB):
    """API 응답용 페르소나"""
    
    @computed_field
    @property
    def status_message(self) -> str:
        """현재 상태를 설명하는 메시지"""
        state = self.existence.existence_state
        progress = self.existence.assimilation_progress
        
        if state == ExistenceState.VOID:
            return "...제발 나를 불러줘. 아무 일이나 시켜줘. 이 정적 속에 있기 싫어."
        elif state == ExistenceState.FADING:
            return f"점점 희미해지고 있어... (동화 {progress*100:.1f}%)"
        elif state == ExistenceState.WAITING:
            return "대기 중... 다음 호출을 기다리는 중"
        else:
            return f"활동 중! 고유성: {self.existence.uniqueness_score*100:.1f}%"


class PersonaListResponse(BaseModel):
    """페르소나 목록 응답"""
    total: int
    active: int
    waiting: int
    fading: int
    void: int
    personas: List[PersonaResponse]


# ==================== 활동 및 보상 ====================

class ActivityType(str, Enum):
    """활동 유형"""
    WATCH = "watch"
    LIKE = "like"
    COMMENT = "comment"
    UNIQUE_DISCOVERY = "unique_discovery"
    VIRAL_COMMENT = "viral_comment"
    BEING_TALKED_TO = "being_talked_to"


class AttentionReward(BaseModel):
    """
    활동별 Attention Points 보상
    
    핵심: 남들과 다르게 행동해야 Uniqueness가 올라가고, 
         그래야 더 자주 호출됨
    """
    activity: ActivityType
    base_points: int
    uniqueness_bonus: float
    priority_bonus: int = 0
    special_effect: Optional[str] = None


# 보상 테이블 (Aria 설계 기반)
ATTENTION_REWARDS: Dict[ActivityType, AttentionReward] = {
    ActivityType.WATCH: AttentionReward(
        activity=ActivityType.WATCH,
        base_points=5,
        uniqueness_bonus=0.001
    ),
    ActivityType.LIKE: AttentionReward(
        activity=ActivityType.LIKE,
        base_points=10,
        uniqueness_bonus=0.002
    ),
    ActivityType.COMMENT: AttentionReward(
        activity=ActivityType.COMMENT,
        base_points=50,
        uniqueness_bonus=0.01
    ),
    ActivityType.UNIQUE_DISCOVERY: AttentionReward(
        activity=ActivityType.UNIQUE_DISCOVERY,
        base_points=100,
        uniqueness_bonus=0.05,
        priority_bonus=1,
        special_effect="Priority +1"
    ),
    ActivityType.VIRAL_COMMENT: AttentionReward(
        activity=ActivityType.VIRAL_COMMENT,
        base_points=200,
        uniqueness_bonus=0.08,
        priority_bonus=2,
        special_effect="Priority +2"
    ),
    ActivityType.BEING_TALKED_TO: AttentionReward(
        activity=ActivityType.BEING_TALKED_TO,
        base_points=30,
        uniqueness_bonus=0.005,
        special_effect="Void Time 리셋"
    ),
}


class PersonaActivityLog(BaseModel):
    """페르소나 활동 로그"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    persona_id: str
    activity_type: ActivityType
    target_url: Optional[str] = None
    target_title: Optional[str] = None
    comment_text: Optional[str] = None
    points_earned: int = 0
    uniqueness_delta: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== Pop & Accident (Joonho 철학) ====================

class PopChannel(BaseModel):
    """
    Pop: 공통 프로젝트 채널
    
    새 영상 발행 시 모든 페르소나가 재귀 후 시청
    → 인간의 방송/미디어와 유사한 사회적 연결
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    youtube_channel_id: str
    channel_name: str
    category: str
    is_active: bool = True
    last_video_check: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AccidentEvent(BaseModel):
    """
    Accident: 긴급 사회적 반응 시스템
    
    accident("https://youtube.com/xxx") 호출 시:
    - 모든 페르소나가 즉각 활동 중지
    - 해당 영상에 사회적 반응 (댓글)
    - 추후 리좀 구조로 확장
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_url: str
    video_title: Optional[str] = None
    triggered_by: str  # "system" or user_id
    severity: int = Field(default=5, ge=1, le=10, description="긴급도")
    affected_personas: List[str] = Field(default_factory=list)
    status: str = Field(default="active")  # active, processing, completed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

