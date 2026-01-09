"""
Rate Limiter Configuration for DoAi.Me API

slowapi를 사용한 Rate Limiting 구현
- IP 기반 기본 제한
- 엔드포인트별 차등 제한
- 프로덕션에서는 Redis 백엔드 지원

Production Domain: doai.me
Production Server: 158.247.210.152 (Vultr)
"""

from typing import Callable, Optional
from fastapi import Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse
import logging

from .config import settings

logger = logging.getLogger("doai_api.rate_limiter")


def get_real_client_ip(request: Request) -> str:
    """
    실제 클라이언트 IP 추출

    프록시/로드밸런서 뒤에서도 정확한 IP 추출:
    1. X-Forwarded-For 헤더 (첫 번째 IP)
    2. X-Real-IP 헤더
    3. 직접 연결 IP
    """
    # X-Forwarded-For: client, proxy1, proxy2
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 첫 번째 IP가 실제 클라이언트
        client_ip = forwarded_for.split(",")[0].strip()
        return client_ip

    # X-Real-IP (Nginx 등에서 설정)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # 직접 연결
    return get_remote_address(request)


def get_identifier(request: Request) -> str:
    """
    Rate Limit 식별자 생성

    우선순위:
    1. API Key (인증된 요청은 키별로 구분)
    2. 클라이언트 IP
    """
    # API Key가 있으면 키 기반 제한
    api_key = request.headers.get("X-API-Key") or request.headers.get("Authorization")
    if api_key:
        # 키의 일부만 사용 (보안)
        return f"key:{api_key[:16]}"

    # IP 기반 제한
    return f"ip:{get_real_client_ip(request)}"


# Rate Limiter 초기화
# 프로덕션에서 Redis 사용 시: redis://localhost:6379
_storage_uri = None
if settings.rate_limit_storage == "redis" and settings.rate_limit_redis_url:
    _storage_uri = settings.rate_limit_redis_url
    logger.info(f"Rate Limiter using Redis storage")
else:
    logger.info("Rate Limiter using in-memory storage")

limiter = Limiter(
    key_func=get_identifier,
    default_limits=[settings.rate_limit_default],
    storage_uri=_storage_uri,
    enabled=settings.rate_limit_enabled,
)


# =============================================================================
# Rate Limit 데코레이터 (라우터에서 사용)
# =============================================================================

def limit_default(func: Callable) -> Callable:
    """기본 Rate Limit 데코레이터 (100/minute)"""
    return limiter.limit(settings.rate_limit_default)(func)


def limit_auth(func: Callable) -> Callable:
    """인증 엔드포인트용 Rate Limit (10/minute)"""
    return limiter.limit(settings.rate_limit_auth)(func)


def limit_read(func: Callable) -> Callable:
    """읽기 엔드포인트용 Rate Limit (200/minute)"""
    return limiter.limit(settings.rate_limit_read)(func)


def limit_write(func: Callable) -> Callable:
    """쓰기 엔드포인트용 Rate Limit (50/minute)"""
    return limiter.limit(settings.rate_limit_write)(func)


def limit_health(func: Callable) -> Callable:
    """헬스체크용 Rate Limit (1000/minute)"""
    return limiter.limit(settings.rate_limit_health)(func)


def limit_custom(limit_string: str) -> Callable:
    """
    커스텀 Rate Limit 데코레이터

    사용 예시:
        @limit_custom("5/minute")
        async def expensive_operation():
            ...
    """
    def decorator(func: Callable) -> Callable:
        return limiter.limit(limit_string)(func)
    return decorator


# =============================================================================
# 예외 핸들러
# =============================================================================

async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Rate Limit 초과 시 응답 핸들러

    429 Too Many Requests 반환
    """
    client_id = get_identifier(request)
    logger.warning(
        f"Rate limit exceeded: {client_id} on {request.url.path} "
        f"(limit: {exc.detail})"
    )

    # Retry-After 헤더 계산
    retry_after = getattr(exc, 'retry_after', 60)

    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": "Too Many Requests",
            "message": settings.rate_limit_message,
            "detail": str(exc.detail),
            "retry_after": retry_after,
        },
        headers={
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": str(exc.detail),
        }
    )


# =============================================================================
# 화이트리스트 (Rate Limit 제외)
# =============================================================================

# Rate Limit을 적용하지 않을 IP 목록
RATE_LIMIT_WHITELIST_IPS = {
    "127.0.0.1",      # localhost
    "::1",             # localhost IPv6
    "158.247.210.152", # Vultr 서버 자체
}

# Rate Limit을 적용하지 않을 경로
RATE_LIMIT_WHITELIST_PATHS = {
    "/docs",
    "/redoc",
    "/openapi.json",
}


def is_whitelisted(request: Request) -> bool:
    """화이트리스트 여부 확인"""
    # IP 화이트리스트
    client_ip = get_real_client_ip(request)
    if client_ip in RATE_LIMIT_WHITELIST_IPS:
        return True

    # 경로 화이트리스트
    if request.url.path in RATE_LIMIT_WHITELIST_PATHS:
        return True

    return False


# =============================================================================
# Rate Limit 상태 조회 (모니터링용)
# =============================================================================

def get_rate_limit_status(request: Request) -> dict:
    """
    현재 Rate Limit 상태 조회

    모니터링 대시보드에서 사용
    """
    client_id = get_identifier(request)

    return {
        "client_id": client_id,
        "enabled": settings.rate_limit_enabled,
        "storage": settings.rate_limit_storage,
        "limits": {
            "default": settings.rate_limit_default,
            "auth": settings.rate_limit_auth,
            "read": settings.rate_limit_read,
            "write": settings.rate_limit_write,
            "health": settings.rate_limit_health,
        }
    }
