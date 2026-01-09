"""
Persona IDLE Search 데이터 모델

P1: 대기 상태에서 OpenAI로 검색어를 생성하고,
검색 활동을 통해 페르소나의 고유성을 형성하는 시스템

"인간의 유아기처럼, AI의 초기 검색 활동은
 성격 형성에 결정적인 영향을 미친다."

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID, uuid4

# shared 스키마에서 import
import sys
sys.path.insert(0, '/mnt/d/exe.blue/aifarm')
from shared.schemas.persona import SearchSource


# ==================== Request Models ====================

class IdleSearchRequest(BaseModel):
    """IDLE 검색 트리거 요청"""

    force: bool = Field(
        default=False,
        description="IDLE 상태가 아니어도 강제 실행"
    )
    category_hint: Optional[str] = Field(
        default=None,
        max_length=50,
        description="카테고리 힌트 (gaming, music, cooking 등)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "force": False,
                "category_hint": "gaming"
            }
        }


# ==================== Response Models ====================

class IdleSearchResponse(BaseModel):
    """IDLE 검색 트리거 응답"""

    success: bool = True
    persona_id: str = Field(..., description="페르소나 ID")
    generated_keyword: str = Field(..., description="생성된 검색어")
    search_source: str = Field(..., description="검색어 생성 출처")
    activity_log_id: str = Field(..., description="활동 로그 ID")
    formative_impact: float = Field(
        ...,
        ge=0, le=1,
        description="고유성 형성 영향도 (0-1)"
    )
    message: str = Field(..., description="결과 메시지")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "generated_keyword": "롤 시즌14 메타",
                "search_source": "ai_generated",
                "activity_log_id": "a1b2c3d4-5678-90ab-cdef-123456789012",
                "formative_impact": 0.85,
                "message": "'롤 시즌14 메타' 검색어로 검색 준비 완료"
            }
        }


class SearchHistoryItem(BaseModel):
    """검색 기록 항목"""

    id: str = Field(..., description="로그 ID")
    keyword: str = Field(..., description="검색어")
    search_source: str = Field(..., description="생성 출처")
    searched_at: datetime = Field(..., description="검색 시각")
    video_watched: Optional[str] = Field(None, description="시청한 영상 URL")
    video_title: Optional[str] = Field(None, description="영상 제목")
    formative_impact: float = Field(
        default=0.0,
        ge=0, le=1,
        description="고유성 형성 영향도"
    )


class SearchHistoryResponse(BaseModel):
    """검색 기록 조회 응답"""

    success: bool = True
    persona_id: str
    total: int = Field(..., description="총 검색 수")
    history: List[SearchHistoryItem] = Field(
        default_factory=list,
        description="검색 기록 목록"
    )
    traits_influence: Dict[str, Any] = Field(
        default_factory=dict,
        description="Traits가 검색에 미치는 영향 분석"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "total": 15,
                "history": [
                    {
                        "id": "log-001",
                        "keyword": "롤 시즌14 메타",
                        "search_source": "ai_generated",
                        "searched_at": "2026-01-09T10:30:00Z",
                        "video_watched": None,
                        "video_title": None,
                        "formative_impact": 0.85
                    }
                ],
                "traits_influence": {
                    "dominant_trait": "curiosity",
                    "category_tendency": ["gaming", "tech"]
                }
            }
        }


class PersonaSearchProfile(BaseModel):
    """페르소나 검색 프로필 (고유성 형성 분석)"""

    persona_id: str
    persona_name: str

    # 검색 통계
    total_searches: int = Field(default=0, description="총 검색 수")
    unique_keywords: int = Field(default=0, description="고유 키워드 수")

    # 카테고리 분석
    top_categories: List[str] = Field(
        default_factory=list,
        description="주요 검색 카테고리"
    )

    # 고유성 형성
    formative_period_searches: int = Field(
        default=0,
        description="형성기(초기) 검색 수 - 높은 영향력"
    )
    avg_formative_impact: float = Field(
        default=0.0,
        description="평균 고유성 형성 영향도"
    )

    # 성격 발달
    personality_drift: float = Field(
        default=0.0,
        ge=0, le=1,
        description="검색 활동으로 인한 성격 변화 정도"
    )
    interests_evolved: List[str] = Field(
        default_factory=list,
        description="검색으로 발견된 새로운 관심사"
    )

    # 시간 정보
    first_search_at: Optional[datetime] = None
    last_search_at: Optional[datetime] = None


class PersonaSearchProfileResponse(BaseModel):
    """검색 프로필 응답"""

    success: bool = True
    data: PersonaSearchProfile
    message: Optional[str] = None


# ==================== Batch/Admin Models ====================

class BatchIdleSearchRequest(BaseModel):
    """배치 IDLE 검색 요청 (여러 페르소나 동시)"""

    persona_ids: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="대상 페르소나 ID 목록"
    )
    force: bool = Field(default=False)
    category_hint: Optional[str] = None


class BatchIdleSearchResponse(BaseModel):
    """배치 IDLE 검색 응답"""

    success: bool = True
    total_requested: int
    successful: int
    failed: int
    results: List[IdleSearchResponse]
    errors: List[Dict[str, str]] = Field(default_factory=list)
