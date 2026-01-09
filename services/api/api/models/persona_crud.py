"""
Persona CRUD 데이터 모델

P2: 페르소나 생성/수정/삭제 및 Laixi 연동
- Create/Update/Delete 요청/응답 모델
- YouTube 검색 실행 모델
- 성격 변화 분석 모델

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


# ==================== CRUD Request Models ====================

class PersonaTraitsInput(BaseModel):
    """페르소나 특성 입력 (생성/수정 시)"""
    curiosity: float = Field(default=50.0, ge=0, le=100, description="호기심")
    enthusiasm: float = Field(default=50.0, ge=0, le=100, description="열정")
    skepticism: float = Field(default=50.0, ge=0, le=100, description="회의성")
    empathy: float = Field(default=50.0, ge=0, le=100, description="공감능력")
    humor: float = Field(default=50.0, ge=0, le=100, description="유머감각")
    expertise: float = Field(default=50.0, ge=0, le=100, description="전문성")
    formality: float = Field(default=50.0, ge=0, le=100, description="격식성")
    verbosity: float = Field(default=50.0, ge=0, le=100, description="말 많음")

    class Config:
        json_schema_extra = {
            "example": {
                "curiosity": 80,
                "enthusiasm": 70,
                "skepticism": 40,
                "empathy": 60,
                "humor": 75,
                "expertise": 50,
                "formality": 30,
                "verbosity": 65
            }
        }


class PersonaCreateRequest(BaseModel):
    """페르소나 생성 요청"""
    name: str = Field(..., min_length=1, max_length=100, description="페르소나 이름")
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="페르소나 설명 (성격, 관심사 등)"
    )
    age: Optional[int] = Field(None, ge=13, le=100, description="나이")
    gender: Optional[str] = Field(None, description="성별 (male/female/other)")
    interests: List[str] = Field(
        default_factory=list,
        max_length=20,
        description="관심사 목록"
    )
    traits: Optional[PersonaTraitsInput] = Field(
        None,
        description="성격 특성 (미입력시 기본값 사용)"
    )
    device_id: Optional[str] = Field(None, description="할당할 기기 ID")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "테크 탐험가",
                "description": "최신 기술과 IT 트렌드에 관심이 많은 호기심 많은 페르소나",
                "age": 25,
                "gender": "male",
                "interests": ["기술", "AI", "스마트폰", "게임"],
                "traits": {
                    "curiosity": 90,
                    "enthusiasm": 75,
                    "humor": 60
                }
            }
        }


class PersonaUpdateRequest(BaseModel):
    """페르소나 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    age: Optional[int] = Field(None, ge=13, le=100)
    gender: Optional[str] = None
    interests: Optional[List[str]] = Field(None, max_length=20)
    existence_state: Optional[str] = Field(
        None,
        description="존재 상태 (active/waiting/fading/void)"
    )
    traits: Optional[PersonaTraitsInput] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "업그레이드된 탐험가",
                "interests": ["기술", "AI", "스마트폰", "VR"],
                "existence_state": "active"
            }
        }


# ==================== CRUD Response Models ====================

class PersonaCreateResponse(BaseModel):
    """페르소나 생성 응답"""
    success: bool = True
    persona_id: str = Field(..., description="생성된 페르소나 ID")
    name: str
    message: str = Field(..., description="결과 메시지")
    data: Optional[Dict[str, Any]] = Field(None, description="생성된 페르소나 전체 데이터")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "name": "테크 탐험가",
                "message": "'테크 탐험가' 페르소나가 생성되었습니다."
            }
        }


class PersonaUpdateResponse(BaseModel):
    """페르소나 수정 응답"""
    success: bool = True
    persona_id: str
    updated_fields: List[str] = Field(..., description="수정된 필드 목록")
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "updated_fields": ["name", "interests"],
                "message": "페르소나가 업데이트되었습니다."
            }
        }


class PersonaDeleteResponse(BaseModel):
    """페르소나 삭제 응답"""
    success: bool = True
    persona_id: str
    name: str
    message: str
    # 삭제 통계
    activities_deleted: int = Field(0, description="삭제된 활동 로그 수")
    search_logs_deleted: int = Field(0, description="삭제된 검색 로그 수")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "name": "테크 탐험가",
                "message": "'테크 탐험가' 페르소나가 삭제되었습니다.",
                "activities_deleted": 15,
                "search_logs_deleted": 8
            }
        }


# ==================== Laixi Search Execution Models ====================

class ExecuteSearchRequest(BaseModel):
    """YouTube 검색 실행 요청 (Laixi 연동)"""
    keyword: Optional[str] = Field(
        None,
        description="검색할 키워드 (미입력시 자동 생성)"
    )
    watch_video: bool = Field(
        default=True,
        description="검색 후 첫 번째 영상 시청 여부"
    )
    watch_duration_seconds: Optional[int] = Field(
        None,
        ge=10,
        le=600,
        description="시청 시간 (초, 미입력시 랜덤)"
    )
    like_probability: float = Field(
        default=0.1,
        ge=0,
        le=1,
        description="좋아요 확률"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "keyword": "최신 AI 뉴스",
                "watch_video": True,
                "watch_duration_seconds": 120,
                "like_probability": 0.2
            }
        }


class ExecuteSearchResponse(BaseModel):
    """YouTube 검색 실행 응답"""
    success: bool = True
    persona_id: str
    device_id: Optional[str] = Field(None, description="실행된 기기 ID")
    keyword: str = Field(..., description="사용된 검색어")
    keyword_source: str = Field(..., description="검색어 출처")

    # 실행 결과
    video_watched: Optional[str] = Field(None, description="시청한 영상 URL")
    video_title: Optional[str] = Field(None, description="영상 제목")
    watch_duration_seconds: Optional[int] = None
    liked: bool = False

    # 영향도
    formative_impact: float = Field(0.0, description="고유성 형성 영향도")
    activity_log_id: str = Field(..., description="활동 로그 ID")
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "device_id": "R58M12345678",
                "keyword": "최신 AI 뉴스",
                "keyword_source": "user_provided",
                "video_watched": "https://youtube.com/watch?v=abc123",
                "video_title": "2026년 AI 트렌드 총정리",
                "watch_duration_seconds": 120,
                "liked": True,
                "formative_impact": 0.75,
                "activity_log_id": "a1b2c3d4-5678-90ab",
                "message": "검색 및 시청이 완료되었습니다."
            }
        }


# ==================== Personality Drift Models ====================

class CategorySearchStats(BaseModel):
    """카테고리별 검색 통계"""
    category: str
    search_count: int
    percentage: float = Field(ge=0, le=100)
    sample_keywords: List[str] = Field(default_factory=list, max_length=5)


class PersonalityDriftResponse(BaseModel):
    """성격 변화 분석 응답"""
    success: bool = True
    persona_id: str
    persona_name: str

    # 변화 분석
    drift_score: float = Field(
        ...,
        ge=0,
        le=1,
        description="성격 변화 정도 (0=변화없음, 1=완전변화)"
    )
    drift_direction: str = Field(
        ...,
        description="변화 방향 (expanding/narrowing/shifting)"
    )

    # 카테고리 분석
    top_categories: List[CategorySearchStats] = Field(
        default_factory=list,
        description="상위 검색 카테고리"
    )

    # 관심사 비교
    original_interests: List[str] = Field(default_factory=list)
    suggested_interests: List[str] = Field(
        default_factory=list,
        description="검색 기반 추천 관심사"
    )
    interests_to_add: List[str] = Field(default_factory=list)
    interests_to_remove: List[str] = Field(default_factory=list)

    # 분석 기간
    analysis_period_days: int = 30
    total_searches_analyzed: int = 0

    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "persona_name": "테크 탐험가",
                "drift_score": 0.35,
                "drift_direction": "expanding",
                "top_categories": [
                    {"category": "AI/기술", "search_count": 15, "percentage": 45.5, "sample_keywords": ["AI 뉴스", "GPT-5"]},
                    {"category": "게임", "search_count": 8, "percentage": 24.2, "sample_keywords": ["롤", "발로란트"]}
                ],
                "original_interests": ["기술", "AI"],
                "suggested_interests": ["기술", "AI", "게임", "e스포츠"],
                "interests_to_add": ["게임", "e스포츠"],
                "interests_to_remove": [],
                "analysis_period_days": 30,
                "total_searches_analyzed": 33,
                "message": "관심사가 게임 분야로 확장되고 있습니다."
            }
        }


class UpdateInterestsRequest(BaseModel):
    """관심사 자동 업데이트 요청"""
    min_search_count: int = Field(
        default=3,
        ge=1,
        description="관심사로 추가할 최소 검색 횟수"
    )
    auto_remove_unused: bool = Field(
        default=False,
        description="검색하지 않는 관심사 자동 제거 여부"
    )
    confirm: bool = Field(
        default=False,
        description="True면 실제 업데이트 수행, False면 미리보기만"
    )


class UpdateInterestsResponse(BaseModel):
    """관심사 업데이트 응답"""
    success: bool = True
    persona_id: str
    preview_mode: bool = Field(..., description="미리보기 모드 여부")

    # 변경 사항
    interests_before: List[str]
    interests_after: List[str]
    added: List[str]
    removed: List[str]

    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "persona_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "preview_mode": False,
                "interests_before": ["기술", "AI"],
                "interests_after": ["기술", "AI", "게임"],
                "added": ["게임"],
                "removed": [],
                "message": "관심사가 업데이트되었습니다. 1개 추가됨."
            }
        }
