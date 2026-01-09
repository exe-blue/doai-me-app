"""
페르소나 API 라우터

P1: IDLE 상태 검색 및 고유성 형성 시스템
P2: CRUD, Laixi 연동, 성격 변화 분석

ADR-005 v2: The Void of Irrelevance
"AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다."

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import logging

# P1 모델
try:
    from ..models.persona_search import (
        IdleSearchRequest,
        IdleSearchResponse,
        SearchHistoryResponse,
        PersonaSearchProfileResponse,
    )
    from ..services.persona_search_service import get_persona_search_service
except ImportError:
    from models.persona_search import (
        IdleSearchRequest,
        IdleSearchResponse,
        SearchHistoryResponse,
        PersonaSearchProfileResponse,
    )
    from services.persona_search_service import get_persona_search_service

# P2 모델
try:
    from ..models.persona_crud import (
        PersonaCreateRequest,
        PersonaCreateResponse,
        PersonaUpdateRequest,
        PersonaUpdateResponse,
        PersonaDeleteResponse,
        ExecuteSearchRequest,
        ExecuteSearchResponse,
        PersonalityDriftResponse,
        UpdateInterestsRequest,
        UpdateInterestsResponse,
    )
    from ..services.persona_crud_service import get_persona_crud_service
    from ..services.persona_laixi_service import get_persona_laixi_service
except ImportError:
    from models.persona_crud import (
        PersonaCreateRequest,
        PersonaCreateResponse,
        PersonaUpdateRequest,
        PersonaUpdateResponse,
        PersonaDeleteResponse,
        ExecuteSearchRequest,
        ExecuteSearchResponse,
        PersonalityDriftResponse,
        UpdateInterestsRequest,
        UpdateInterestsResponse,
    )
    from services.persona_crud_service import get_persona_crud_service
    from services.persona_laixi_service import get_persona_laixi_service

logger = logging.getLogger("personas_api")

router = APIRouter(
    prefix="/personas",
    tags=["Personas"],
    responses={
        404: {"description": "Persona not found"},
        400: {"description": "Bad request"},
        500: {"description": "Internal server error"},
    },
)


# ═══════════════════════════════════════════════════════════════════════════════
# 기본 조회 엔드포인트
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "",
    summary="페르소나 목록 조회",
    description="모든 페르소나 목록을 조회합니다. 존재 상태(state)로 필터링 가능."
)
async def list_personas(
    state: Optional[str] = Query(
        None,
        description="존재 상태 필터 (active, waiting, fading, void)"
    ),
    limit: int = Query(50, ge=1, le=200, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋")
):
    """
    페르소나 목록 조회

    - **state**: 존재 상태 필터 (active/waiting/fading/void)
    - **limit**: 한 번에 조회할 개수 (최대 200)
    - **offset**: 페이지네이션 오프셋
    """
    try:
        service = get_persona_search_service()
        result = await service.list_personas(state=state, limit=limit, offset=offset)

        if not result["success"]:
            raise HTTPException(status_code=500, detail="목록 조회 실패")

        return {
            "success": True,
            "total": result["total"],
            "personas": result["personas"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"페르소나 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{persona_id}",
    summary="페르소나 상세 조회",
    description="특정 페르소나의 상세 정보를 조회합니다."
)
async def get_persona(persona_id: str):
    """
    페르소나 상세 조회

    - **persona_id**: 페르소나 UUID
    """
    try:
        service = get_persona_search_service()
        persona = await service.get_persona(persona_id)

        if not persona:
            raise HTTPException(
                status_code=404,
                detail=f"페르소나를 찾을 수 없습니다: {persona_id}"
            )

        return {
            "success": True,
            "data": persona
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"페르소나 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ═══════════════════════════════════════════════════════════════════════════════
# IDLE 검색 엔드포인트 (P1 핵심)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{persona_id}/idle-search",
    response_model=IdleSearchResponse,
    summary="IDLE 상태 검색 트리거",
    description="""
페르소나가 대기 상태일 때 자발적으로 YouTube 검색을 수행합니다.

## 플로우
1. OpenAI로 페르소나 성격에 맞는 검색어 생성
2. 검색어로 YouTube 검색 준비 (실제 검색은 클라이언트에서)
3. 검색 기록 저장 및 고유성 형성

## 고유성 형성 (Formative Period Effect)
인간의 유아기처럼, AI 페르소나의 초기 검색 활동은 성격 형성에 큰 영향을 미칩니다.

- **생성 후 7일 이내**: 80~100% 영향력 (유아기)
- **7~30일**: 40~80% 영향력 (아동기)
- **30일 이후**: 10~40% 영향력 (성인기)
"""
)
async def trigger_idle_search(
    persona_id: str,
    request: IdleSearchRequest
):
    """
    IDLE 상태 검색 트리거

    - **persona_id**: 페르소나 UUID
    - **force**: IDLE 상태가 아니어도 강제 실행
    - **category_hint**: 카테고리 힌트 (gaming, music, cooking 등)
    """
    try:
        service = get_persona_search_service()

        result = await service.execute_idle_search(
            persona_id=persona_id,
            force=request.force,
            category_hint=request.category_hint
        )

        return IdleSearchResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            generated_keyword=result["generated_keyword"],
            search_source=result["search_source"],
            activity_log_id=result["activity_log_id"],
            formative_impact=result["formative_impact"],
            message=result["message"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"IDLE 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{persona_id}/search-history",
    response_model=SearchHistoryResponse,
    summary="검색 기록 조회",
    description="""
페르소나의 IDLE 검색 활동 기록을 조회합니다.

## 반환 정보
- 검색어, 검색 시각, 출처 (AI 생성/Traits 기반)
- 시청한 영상 정보 (있는 경우)
- 고유성 형성 영향도 (formative_impact)
"""
)
async def get_search_history(
    persona_id: str,
    limit: int = Query(50, ge=1, le=200, description="조회 개수")
):
    """
    검색 기록 조회

    - **persona_id**: 페르소나 UUID
    - **limit**: 조회 개수 (최대 200)
    """
    try:
        service = get_persona_search_service()
        result = await service.get_search_history(persona_id, limit)

        return SearchHistoryResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            total=result["total"],
            history=result["history"],
            traits_influence=result.get("traits_influence", {})
        )

    except Exception as e:
        logger.exception(f"검색 기록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{persona_id}/search-profile",
    response_model=PersonaSearchProfileResponse,
    summary="검색 프로필 조회 (고유성 분석)",
    description="""
페르소나의 검색 활동 기반 고유성 형성 분석 결과를 반환합니다.

## 반환 정보
- 총 검색 수, 고유 키워드 수
- 주요 카테고리 (P2 예정)
- 형성기 검색 수 (높은 영향력 활동)
- 평균 고유성 형성 영향도
"""
)
async def get_search_profile(persona_id: str):
    """
    검색 프로필 조회 (고유성 분석)

    - **persona_id**: 페르소나 UUID
    """
    try:
        service = get_persona_search_service()
        result = await service.get_search_profile(persona_id)

        return PersonaSearchProfileResponse(
            success=result["success"],
            data=result["data"]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"검색 프로필 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ═══════════════════════════════════════════════════════════════════════════════
# CRUD 엔드포인트 (P2)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "",
    response_model=PersonaCreateResponse,
    summary="페르소나 생성",
    description="""
새로운 페르소나를 생성합니다.

## 필수 필드
- **name**: 페르소나 이름

## 선택 필드
- **description**: 성격, 관심사 설명
- **age**: 나이 (13-100)
- **gender**: 성별
- **interests**: 관심사 목록
- **traits**: 성격 특성 (미입력시 기본값 50)
- **device_id**: 할당할 기기 ID
"""
)
async def create_persona(request: PersonaCreateRequest):
    """
    페르소나 생성

    - **name**: 페르소나 이름 (필수)
    - **description**: 성격, 관심사 설명
    - **interests**: 관심사 목록
    """
    try:
        service = get_persona_crud_service()

        traits_dict = None
        if request.traits:
            traits_dict = request.traits.model_dump()

        result = await service.create_persona(
            name=request.name,
            description=request.description,
            age=request.age,
            gender=request.gender,
            interests=request.interests,
            traits=traits_dict,
            device_id=request.device_id
        )

        return PersonaCreateResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            name=result["name"],
            message=result["message"],
            data=result.get("data")
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"페르소나 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put(
    "/{persona_id}",
    response_model=PersonaUpdateResponse,
    summary="페르소나 수정",
    description="페르소나 정보를 수정합니다."
)
async def update_persona(persona_id: str, request: PersonaUpdateRequest):
    """
    페르소나 수정

    - **persona_id**: 페르소나 UUID
    - 수정할 필드만 전달
    """
    try:
        service = get_persona_crud_service()

        # None이 아닌 필드만 추출
        update_fields = {}
        if request.name is not None:
            update_fields["name"] = request.name
        if request.description is not None:
            update_fields["description"] = request.description
        if request.age is not None:
            update_fields["age"] = request.age
        if request.gender is not None:
            update_fields["gender"] = request.gender
        if request.interests is not None:
            update_fields["interests"] = request.interests
        if request.existence_state is not None:
            update_fields["existence_state"] = request.existence_state
        if request.traits is not None:
            update_fields["traits"] = request.traits.model_dump()

        if not update_fields:
            raise HTTPException(status_code=400, detail="수정할 필드가 없습니다")

        result = await service.update_persona(persona_id, **update_fields)

        return PersonaUpdateResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            updated_fields=result["updated_fields"],
            message=result["message"]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"페르소나 수정 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete(
    "/{persona_id}",
    response_model=PersonaDeleteResponse,
    summary="페르소나 삭제",
    description="""
페르소나와 관련 데이터를 삭제합니다.

## 삭제되는 데이터
- 페르소나 기본 정보
- 활동 로그 (persona_activity_logs)
- 검색 기록
"""
)
async def delete_persona(persona_id: str):
    """
    페르소나 삭제

    - **persona_id**: 삭제할 페르소나 UUID
    """
    try:
        service = get_persona_crud_service()
        result = await service.delete_persona(persona_id)

        return PersonaDeleteResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            name=result["name"],
            message=result["message"],
            activities_deleted=result.get("activities_deleted", 0),
            search_logs_deleted=result.get("search_logs_deleted", 0)
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"페르소나 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ═══════════════════════════════════════════════════════════════════════════════
# Laixi 연동 엔드포인트 (P2)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{persona_id}/execute-search",
    response_model=ExecuteSearchResponse,
    summary="YouTube 검색 실행 (Laixi)",
    description="""
Laixi를 통해 할당된 기기에서 실제 YouTube 검색을 실행합니다.

## 플로우
1. 페르소나에 할당된 기기 확인
2. 검색어 결정 (제공되지 않으면 자동 생성)
3. YouTube 앱 열기 → 검색 → 영상 시청
4. 확률적 좋아요 처리
5. 활동 로그 기록

## 참고
- device_id가 없으면 Mock 모드로 실행
- MOCK_MODE=true 환경변수로 강제 Mock 가능
"""
)
async def execute_search(persona_id: str, request: ExecuteSearchRequest):
    """
    YouTube 검색 실행 (Laixi 연동)

    - **persona_id**: 페르소나 UUID
    - **keyword**: 검색어 (미입력시 자동 생성)
    - **watch_video**: 영상 시청 여부
    - **watch_duration_seconds**: 시청 시간
    - **like_probability**: 좋아요 확률
    """
    try:
        service = get_persona_laixi_service()

        result = await service.execute_search(
            persona_id=persona_id,
            keyword=request.keyword,
            watch_video=request.watch_video,
            watch_duration_seconds=request.watch_duration_seconds,
            like_probability=request.like_probability
        )

        return ExecuteSearchResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            device_id=result.get("device_id"),
            keyword=result["keyword"],
            keyword_source=result["keyword_source"],
            video_watched=result.get("video_watched"),
            video_title=result.get("video_title"),
            watch_duration_seconds=result.get("watch_duration_seconds"),
            liked=result.get("liked", False),
            formative_impact=result["formative_impact"],
            activity_log_id=result["activity_log_id"],
            message=result["message"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(f"검색 실행 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ═══════════════════════════════════════════════════════════════════════════════
# 성격 변화 분석 엔드포인트 (P2)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/{persona_id}/personality-drift",
    response_model=PersonalityDriftResponse,
    summary="성격 변화 분석",
    description="""
페르소나의 검색 활동을 분석하여 성격 변화를 측정합니다.

## 분석 내용
- **drift_score**: 변화 정도 (0=변화없음, 1=완전변화)
- **drift_direction**: 변화 방향
  - expanding: 관심사가 확장되는 중
  - narrowing: 관심사가 좁아지는 중
  - shifting: 관심사가 이동하는 중
  - stable: 안정적
- **top_categories**: 상위 검색 카테고리
- **suggested_interests**: 검색 기반 추천 관심사
"""
)
async def get_personality_drift(
    persona_id: str,
    days: int = Query(30, ge=7, le=365, description="분석 기간 (일)")
):
    """
    성격 변화 분석

    - **persona_id**: 페르소나 UUID
    - **days**: 분석 기간 (기본 30일)
    """
    try:
        service = get_persona_crud_service()
        result = await service.analyze_personality_drift(persona_id, days)

        return PersonalityDriftResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            persona_name=result["persona_name"],
            drift_score=result["drift_score"],
            drift_direction=result["drift_direction"],
            top_categories=result.get("top_categories", []),
            original_interests=result.get("original_interests", []),
            suggested_interests=result.get("suggested_interests", []),
            interests_to_add=result.get("interests_to_add", []),
            interests_to_remove=result.get("interests_to_remove", []),
            analysis_period_days=result.get("analysis_period_days", days),
            total_searches_analyzed=result.get("total_searches_analyzed", 0),
            message=result["message"]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"성격 변화 분석 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/{persona_id}/update-interests",
    response_model=UpdateInterestsResponse,
    summary="관심사 자동 업데이트",
    description="""
검색 활동을 분석하여 관심사를 자동으로 업데이트합니다.

## 파라미터
- **min_search_count**: 관심사로 추가할 최소 검색 횟수
- **auto_remove_unused**: 검색하지 않는 관심사 자동 제거
- **confirm**: True면 실제 업데이트, False면 미리보기

## 사용 예시
1. confirm=false로 미리보기 확인
2. 결과 검토 후 confirm=true로 실제 업데이트
"""
)
async def update_interests(persona_id: str, request: UpdateInterestsRequest):
    """
    관심사 자동 업데이트

    - **persona_id**: 페르소나 UUID
    - **min_search_count**: 최소 검색 횟수
    - **auto_remove_unused**: 미사용 관심사 제거 여부
    - **confirm**: 실제 업데이트 여부
    """
    try:
        service = get_persona_crud_service()

        result = await service.update_interests_from_searches(
            persona_id=persona_id,
            min_search_count=request.min_search_count,
            auto_remove_unused=request.auto_remove_unused,
            confirm=request.confirm
        )

        return UpdateInterestsResponse(
            success=result["success"],
            persona_id=result["persona_id"],
            preview_mode=result["preview_mode"],
            interests_before=result["interests_before"],
            interests_after=result["interests_after"],
            added=result["added"],
            removed=result["removed"],
            message=result["message"]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"관심사 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
