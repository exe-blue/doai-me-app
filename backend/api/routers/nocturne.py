"""
Nocturne Line API Router (밤의 상징문장 API)

매일 자정 생성되는 시적 문장을 조회하고 관리하는 엔드포인트

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-04
"""

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
import logging

from ..models.nocturne import (
    NocturneLine,
    NocturneLineCreate,
    NocturneLineResponse,
    NocturneLineListResponse,
)
from ..services.nocturne_service import (
    generate_nocturne_line,
    get_nocturne_history,
    get_nocturne_by_date,
)

logger = logging.getLogger("nocturne_api")

router = APIRouter(
    prefix="/nocturne",
    tags=["Nocturne Line"],
    responses={404: {"description": "Not found"}},
)


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/today",
    response_model=NocturneLineResponse,
    summary="오늘의 Nocturne Line (어제 데이터 기반)",
    description="""
    가장 최근에 생성된 Nocturne Line을 반환합니다.
    자정에 생성되므로, 어제 하루의 데이터를 기반으로 합니다.
    """
)
async def get_today_nocturne():
    """오늘의 Nocturne Line 조회"""
    try:
        yesterday = date.today() - timedelta(days=1)
        line = await get_nocturne_by_date(yesterday)
        
        if not line:
            raise HTTPException(
                status_code=404,
                detail="오늘의 Nocturne Line이 아직 생성되지 않았습니다."
            )
        
        return NocturneLineResponse(
            success=True,
            data=line,
            message="밤의 상징문장"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching today's nocturne: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/history",
    response_model=NocturneLineListResponse,
    summary="Nocturne Line 히스토리",
    description="최근 N일간의 Nocturne Line 목록을 반환합니다."
)
async def get_nocturne_line_history(
    days: int = Query(default=7, ge=1, le=30, description="조회할 일수 (1-30)")
):
    """Nocturne Line 히스토리 조회"""
    try:
        lines = await get_nocturne_history(days)
        
        return NocturneLineListResponse(
            success=True,
            data=lines,
            total=len(lines),
            message=f"최근 {days}일간의 밤의 상징문장"
        )
        
    except Exception as e:
        logger.exception(f"Error fetching nocturne history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/date/{target_date}",
    response_model=NocturneLineResponse,
    summary="특정 날짜의 Nocturne Line",
    description="지정한 날짜의 Nocturne Line을 반환합니다."
)
async def get_nocturne_by_specific_date(target_date: date):
    """특정 날짜의 Nocturne Line 조회"""
    try:
        # 미래 날짜 검증
        if target_date >= date.today():
            raise HTTPException(
                status_code=400,
                detail="미래의 Nocturne Line은 조회할 수 없습니다."
            )
        
        line = await get_nocturne_by_date(target_date)
        
        if not line:
            raise HTTPException(
                status_code=404,
                detail=f"{target_date}의 Nocturne Line이 없습니다."
            )
        
        return NocturneLineResponse(
            success=True,
            data=line,
            message=f"{target_date}의 밤의 상징문장"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching nocturne for {target_date}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/generate",
    response_model=NocturneLineResponse,
    summary="Nocturne Line 수동 생성",
    description="""
    특정 날짜의 Nocturne Line을 수동으로 생성합니다.
    주로 테스트나 재생성 용도로 사용됩니다.
    """
)
async def generate_nocturne_manually(request: NocturneLineCreate):
    """Nocturne Line 수동 생성"""
    try:
        target = request.target_date or (date.today() - timedelta(days=1))
        
        # 미래 날짜 검증
        if target >= date.today():
            raise HTTPException(
                status_code=400,
                detail="미래의 Nocturne Line은 생성할 수 없습니다."
            )
        
        line = await generate_nocturne_line(
            target_date=target,
            force=request.force_regenerate
        )
        
        return NocturneLineResponse(
            success=True,
            data=line,
            message="밤의 상징문장이 생성되었습니다."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating nocturne: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/latest",
    response_model=NocturneLineResponse,
    summary="가장 최근 Nocturne Line",
    description="캐시에서 가장 최근에 생성된 Nocturne Line을 반환합니다 (새로 생성하지 않음)."
)
async def get_latest_nocturne():
    """캐시에서 가장 최근 Nocturne Line 조회 (읽기 전용)"""
    try:
        yesterday = date.today() - timedelta(days=1)
        # get_nocturne_by_date를 사용하여 캐시만 조회 (새로 생성하지 않음)
        line = await get_nocturne_by_date(yesterday)
        
        if not line:
            raise HTTPException(
                status_code=404,
                detail="캐시된 Nocturne Line이 없습니다."
            )
        
        return NocturneLineResponse(
            success=True,
            data=line,
            message="캐시된 가장 최근의 밤의 상징문장"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching latest nocturne: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ═══════════════════════════════════════════════════════════════════════════════
# Utility Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/random",
    response_model=NocturneLineResponse,
    summary="랜덤 Nocturne Line 생성 (데모용)",
    description="데모/테스트용 랜덤 Nocturne Line을 생성합니다."
)
async def get_random_nocturne():
    """랜덤 Nocturne Line (데모용)"""
    import random
    from ..services.nocturne_service import _generator, DailyMetrics
    
    try:
        # 랜덤 날짜
        days_ago = random.randint(1, 365)
        target = date.today() - timedelta(days=days_ago)
        
        # 랜덤 지표
        metrics = DailyMetrics(
            target_date=target,
            total_nodes=600,
            online_nodes_avg=random.uniform(400, 600),
            tasks_completed=random.randint(5000, 15000),
            tasks_failed=random.randint(100, 1000),
            success_rate=random.uniform(0.85, 0.99),
            errors_total=random.randint(100, 500),
            reconnections=random.randint(50, 300),
            critical_events=random.randint(0, 10),
            peak_hour=random.randint(8, 20),
            idle_hours=random.randint(0, 12),
            avg_task_duration_sec=random.uniform(60, 360),
            unique_events=[],
            nodes_offline_count=random.randint(0, 100),
            nodes_recovered=random.randint(0, 100),
        )
        
        line = await _generator.generate(metrics, force=True)
        
        return NocturneLineResponse(
            success=True,
            data=line,
            message="랜덤 생성된 밤의 상징문장 (데모)"
        )
        
    except Exception as e:
        logger.exception(f"Error generating random nocturne: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

