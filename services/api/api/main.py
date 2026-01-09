"""
DoAi.Me Backend API - FastAPI 메인 애플리케이션

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-01
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 라우터 임포트 (Docker/standalone 호환)
try:
    from .routers import (
        commissions,
        laixi,
        maintenance,
        monitoring,
        nocturne,
        personas,
        wifi,
        youtube,
        youtube_channels,
    )
    from .routers.oob import router as oob_router
    from .services.nocturne_scheduler import start_nocturne_scheduler, stop_nocturne_scheduler
    from .services.youtube_monitor import (
        start_youtube_monitor_scheduler,
        stop_youtube_monitor_scheduler,
    )
except ImportError:
    from routers import (
        commissions,
        laixi,
        maintenance,
        monitoring,
        nocturne,
        personas,
        wifi,
        youtube,
        youtube_channels,
    )
    from routers.oob import router as oob_router
    from services.nocturne_scheduler import start_nocturne_scheduler, stop_nocturne_scheduler
    from services.youtube_monitor import (
        start_youtube_monitor_scheduler,
        stop_youtube_monitor_scheduler,
    )

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("doai_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 라이프사이클 관리"""
    logger.info("🚀 DoAi.Me Backend API 시작")

    # Nocturne Scheduler 시작 (매일 자정 00:00:15)
    async def on_nocturne_generated(line: str):
        """Nocturne Line 생성 시 콜백"""
        logger.info(f"🌙 밤의 상징문장: {line}")
        # TODO: Discord/Slack 알림 전송

    await start_nocturne_scheduler(on_generate=on_nocturne_generated)
    logger.info("🌙 Nocturne Scheduler 시작됨")

    # YouTube 채널 모니터 스케줄러 시작 (30분 주기)
    import asyncio

    asyncio.create_task(start_youtube_monitor_scheduler(interval_minutes=30))
    logger.info("📺 YouTube Monitor Scheduler 시작됨")

    yield

    # 종료 처리
    await stop_youtube_monitor_scheduler()
    logger.info("📺 YouTube Monitor Scheduler 종료됨")
    await stop_nocturne_scheduler()
    logger.info("🌙 Nocturne Scheduler 종료됨")
    logger.info("👋 DoAi.Me Backend API 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="DoAi.Me Backend API",
    description="YouTube 자동화 및 분산 제어 시스템 API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={process_time:.3f}s"
    )

    response.headers["X-Process-Time"] = str(process_time)
    return response


# 전역 예외 핸들러
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if app.debug else "An unexpected error occurred",
        },
    )


# 라우터 등록
app.include_router(youtube.router, prefix="/api")
app.include_router(commissions.router, prefix="/api")
app.include_router(maintenance.router, prefix="/api")
app.include_router(personas.router, prefix="/api")
app.include_router(wifi.router)  # /api/v1/wifi (prefix 내장)
app.include_router(nocturne.router, prefix="/api")  # /api/nocturne
app.include_router(oob_router, prefix="/api")  # /api/oob - OOB 관리
app.include_router(laixi.router)  # /api/laixi - Laixi 로컬 디바이스 제어
app.include_router(youtube_channels.router, prefix="/api")  # /api/youtube-channels
app.include_router(monitoring.router)  # /metrics + /api/monitoring/* - 모니터링


# 기본 엔드포인트
@app.get("/")
async def root():
    return {"name": "DoAi.Me Backend API", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/api/info")
async def api_info():
    """API 정보"""
    return {
        "endpoints": {
            "youtube": {
                "GET /api/youtube/videos": "영상 목록 조회",
                "POST /api/youtube/videos": "영상 추가",
                "POST /api/youtube/results": "시청 결과 저장",
                "GET /api/youtube/stats": "통계 조회",
                "DELETE /api/youtube/videos/{id}": "영상 삭제",
            },
            "wifi": {
                "POST /api/v1/wifi/connect": "WiFi 연결",
                "GET /api/v1/wifi/status": "전체 기기 WiFi 상태",
                "GET /api/v1/wifi/status/{device_id}": "특정 기기 WiFi 상태",
                "POST /api/v1/wifi/verify": "WiFi 연결 검증",
                "POST /api/v1/wifi/disconnect": "WiFi 연결 해제",
            },
            "nocturne": {
                "GET /api/nocturne/today": "오늘의 밤의 상징문장",
                "GET /api/nocturne/history": "최근 N일간 히스토리",
                "GET /api/nocturne/date/{date}": "특정 날짜 조회",
                "POST /api/nocturne/generate": "수동 생성",
                "GET /api/nocturne/random": "랜덤 생성 (데모)",
            },
            "oob": {
                "POST /api/oob/metrics": "노드 메트릭 업데이트",
                "GET /api/oob/nodes": "모든 노드 건강 상태",
                "GET /api/oob/evaluate/{node_id}": "노드 상태 평가",
                "POST /api/oob/recover": "복구 실행",
                "POST /api/oob/box/test": "박스 프로토콜 테스트",
                "POST /api/oob/box/command": "박스 명령 실행",
            },
            "laixi": {
                "GET /api/laixi/health": "Laixi 연결 상태 확인",
                "GET /api/laixi/devices": "연결된 디바이스 목록",
                "POST /api/laixi/watch": "YouTube 영상 시청 명령",
                "POST /api/laixi/stop": "YouTube 시청 중지",
                "POST /api/laixi/screenshot": "디바이스 스크린샷",
            },
            "youtube_channels": {
                "GET /api/youtube-channels": "등록된 채널 목록",
                "POST /api/youtube-channels": "새 채널 등록",
                "DELETE /api/youtube-channels/{channel_id}": "채널 비활성화",
                "POST /api/youtube-channels/scan": "수동 스캔 트리거",
                "GET /api/youtube-channels/scan/single/{channel_id}": "단일 채널 스캔",
                "GET /api/youtube-channels/queue": "Video Queue 조회",
                "GET /api/youtube-channels/queue/stats": "Queue 통계",
            },
            "commissions": "작업 위임 관리",
            "maintenance": "유지보수 작업",
            "personas": {
                "GET /api/personas": "페르소나 목록 조회",
                "GET /api/personas/{id}": "페르소나 상세 조회",
                "POST /api/personas/{id}/idle-search": "IDLE 상태 검색 트리거 (P1 핵심)",
                "GET /api/personas/{id}/search-history": "검색 기록 조회",
                "GET /api/personas/{id}/search-profile": "검색 프로필 (고유성 분석)",
            },
            "monitoring": {
                "GET /metrics": "Prometheus 메트릭 (텍스트 포맷)",
                "GET /api/monitoring/health": "상세 헬스체크",
                "GET /api/monitoring/summary": "시스템 요약",
                "GET /api/monitoring/alerts": "알림 목록 조회",
                "POST /api/monitoring/alerts": "알림 전송 (Slack/Discord)",
                "GET /api/monitoring/network": "네트워크 건강 상태",
            },
        }
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
