"""
📝 DoAi.Me 표준 로거
loguru 기반 프로젝트 전체 로깅 표준화

왜 loguru인가?
- 기존 프로젝트에서 이미 사용 중
- 간결한 API, 자동 포맷팅
- 구조화된 로깅 지원 (JSON 출력)
"""

import sys
from typing import Any

from loguru import logger

# 설정 로드 시 순환 참조 방지를 위해 지연 로드
_configured = False


def configure_logging(
    level: str = "INFO",
    log_format: str = "console",
    serialize: bool = False,
) -> None:
    """
    프로젝트 전체 로깅 설정

    Args:
        level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: 출력 포맷 ("json" 또는 "console")
        serialize: JSON 직렬화 여부 (log_format="json"일 때 자동 True)

    사용 예:
        from shared.utils import configure_logging
        configure_logging(level="DEBUG", log_format="console")
    """
    global _configured

    # 기존 핸들러 제거
    logger.remove()

    # JSON 포맷 요청 시 serialize 활성화
    if log_format == "json":
        serialize = True

    if serialize:
        # JSON 출력 (프로덕션용)
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
            level=level,
            serialize=True,
            backtrace=True,
            diagnose=False,  # 프로덕션에서는 보안상 비활성화
        )
    else:
        # 컬러 콘솔 출력 (개발용)
        logger.add(
            sys.stdout,
            format=(
                "<green>{time:HH:mm:ss.SSS}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                "<level>{message}</level>"
            ),
            level=level,
            colorize=True,
            backtrace=True,
            diagnose=True,
        )

    _configured = True
    logger.debug(f"로깅 설정 완료: level={level}, format={log_format}")


def get_logger(name: str) -> Any:
    """
    모듈별 로거 반환

    Args:
        name: 로거 이름 (보통 __name__ 사용)

    Returns:
        loguru logger with bound name

    사용 예:
        from shared.utils import get_logger
        logger = get_logger(__name__)
        logger.info("메시지", extra_key="value")
    """
    global _configured

    # 설정이 안 되어 있으면 기본 설정 적용
    if not _configured:
        # 순환 참조 방지를 위해 여기서 settings 로드
        try:
            from shared.config import settings

            configure_logging(
                level=settings.log_level,
                log_format=settings.log_format,
            )
        except Exception:
            # 설정 로드 실패 시 기본값 사용
            configure_logging(level="INFO", log_format="console")

    return logger.bind(name=name)


# 편의를 위한 기본 로거
default_logger = logger
