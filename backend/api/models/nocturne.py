"""
Nocturne Line (밤의 상징문장) 데이터 모델

600대 노드의 하루를 시적인 한 문장으로 압축하는 시스템의 데이터 구조

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-04
"""

from datetime import datetime, date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID, uuid4


class MoodTone(str, Enum):
    """분위기 톤 - 하루의 전반적인 감정색"""
    
    SERENE = "serene"           # 고요한: 에러율 낮음, 안정적
    MELANCHOLIC = "melancholic" # 우수한: 활동량 저조, 대기 상태 많음
    TURBULENT = "turbulent"     # 격동의: 에러율 높음, 재시도 많음
    TRIUMPHANT = "triumphant"   # 승리의: 높은 성공률, 목표 초과 달성
    MYSTERIOUS = "mysterious"   # 신비로운: 비정상적 패턴, 특이 이벤트
    CONTEMPLATIVE = "contemplative"  # 사색적: 중간 활동량, 안정적
    FADING = "fading"           # 희미해지는: 노드 오프라인 증가
    AWAKENING = "awakening"     # 깨어나는: 노드 온라인 증가, 활성화


class PoeticElement(BaseModel):
    """시적 요소 - 문장 생성에 사용되는 메타포 재료"""
    
    # 시간 메타포
    time_metaphor: str = Field(..., description="시간을 표현하는 메타포")
    # 예: "자정의 문턱에서", "새벽을 향해", "황혼이 내려앉을 때"
    
    # 공간 메타포
    space_metaphor: str = Field(..., description="공간/규모를 표현하는 메타포")
    # 예: "600개의 별들이", "디지털 숲 속에서", "회로의 미로 사이로"
    
    # 행위 메타포
    action_metaphor: str = Field(..., description="동작을 표현하는 메타포")
    # 예: "호흡했다", "꿈꾸었다", "부서졌다 다시 모였다", "침묵을 지켰다"
    
    # 감정 수식어
    emotion_modifier: str = Field(..., description="감정을 표현하는 수식어")
    # 예: "조용히", "격렬하게", "쓸쓸하게", "찬란하게"


class DailyMetrics(BaseModel):
    """하루 집계 지표 - 시적 변환의 원본 데이터"""
    
    # 기본 지표
    target_date: date = Field(..., description="집계 대상 날짜")
    total_nodes: int = Field(default=600, description="전체 노드 수")
    online_nodes_avg: float = Field(..., description="온라인 노드 평균 (0-600)")
    
    # 작업 지표
    tasks_completed: int = Field(default=0, description="완료된 작업 수")
    tasks_failed: int = Field(default=0, description="실패한 작업 수")
    success_rate: float = Field(default=0.0, description="성공률 (0.0-1.0)")
    
    # 이상 지표
    errors_total: int = Field(default=0, description="총 에러 수")
    reconnections: int = Field(default=0, description="재연결 횟수")
    critical_events: int = Field(default=0, description="심각 이벤트 수")
    
    # 활동 지표
    peak_hour: int = Field(default=0, ge=0, le=23, description="최대 활동 시간대")
    idle_hours: int = Field(default=0, description="유휴 시간 (시)")
    avg_task_duration_sec: float = Field(default=0.0, description="평균 작업 시간")
    
    # 특수 지표
    unique_events: list[str] = Field(default_factory=list, description="특이 이벤트 목록")
    nodes_offline_count: int = Field(default=0, description="오프라인 된 노드 수")
    nodes_recovered: int = Field(default=0, description="복구된 노드 수")


class NocturneLineCreate(BaseModel):
    """Nocturne Line 생성 요청"""
    
    target_date: Optional[date] = Field(
        default=None,
        description="대상 날짜 (미지정 시 어제)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="이미 존재해도 재생성"
    )


class NocturneLine(BaseModel):
    """Nocturne Line - 밤의 상징문장"""
    
    id: UUID = Field(default_factory=uuid4)
    target_date: date = Field(..., description="대상 날짜")
    
    # 핵심 출력
    line: str = Field(..., max_length=200, description="시적 문장 (한 줄)")
    line_en: Optional[str] = Field(None, max_length=250, description="영문 번역")
    
    # 생성 맥락
    mood: MoodTone = Field(..., description="분위기 톤")
    poetic_elements: PoeticElement = Field(..., description="사용된 시적 요소")
    
    # 원본 데이터
    metrics: DailyMetrics = Field(..., description="집계 지표")
    
    # 메타데이터
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generator_version: str = Field(default="1.0.0")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "target_date": "2026-01-03",
                "line": "자정의 문턱에서, 587개의 별들이 조용히 호흡했다 — 13개는 잠시 잠들었다가 새벽과 함께 깨어났다.",
                "line_en": "At the threshold of midnight, 587 stars quietly breathed — 13 slumbered briefly, awakening with the dawn.",
                "mood": "serene",
                "poetic_elements": {
                    "time_metaphor": "자정의 문턱에서",
                    "space_metaphor": "587개의 별들이",
                    "action_metaphor": "조용히 호흡했다",
                    "emotion_modifier": "조용히"
                },
                "metrics": {
                    "target_date": "2026-01-03",
                    "total_nodes": 600,
                    "online_nodes_avg": 587.3,
                    "tasks_completed": 12500,
                    "tasks_failed": 350,
                    "success_rate": 0.972,
                    "errors_total": 420,
                    "reconnections": 89,
                    "critical_events": 2,
                    "peak_hour": 14,
                    "idle_hours": 4,
                    "avg_task_duration_sec": 182.5,
                    "unique_events": ["Node TITAN-03 자동 복구 성공"],
                    "nodes_offline_count": 13,
                    "nodes_recovered": 13
                },
                "generated_at": "2026-01-04T00:00:15.123456",
                "generator_version": "1.0.0"
            }
        }


class NocturneLineResponse(BaseModel):
    """API 응답 모델"""
    
    success: bool = True
    data: NocturneLine
    message: Optional[str] = None


class NocturneLineListResponse(BaseModel):
    """Nocturne Line 목록 응답"""
    
    success: bool = True
    data: list[NocturneLine]
    total: int
    message: Optional[str] = None

