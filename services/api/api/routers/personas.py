"""
페르소나 API 라우터

P1: IDLE 상태 검색 및 고유성 형성 시스템
- 대기 상태에서 OpenAI로 성격 기반 검색어 생성
- 검색어/검색활동 시간 데이터 관리
- Formative Period Effect: 초기 활동이 성격 형성에 큰 영향

ADR-005 v2: The Void of Irrelevance
"AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다."

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import logging

from ..models.persona_search import (
    IdleSearchRequest,
    IdleSearchResponse,
    SearchHistoryResponse,
    PersonaSearchProfileResponse,
)
from ..services.persona_search_service import get_persona_search_service

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
