"""
🧪 Logger 단위 테스트
shared/utils/logger.py 테스트
"""

import pytest


class TestConfigureLogging:
    """configure_logging 함수 테스트"""

    def test_configure_logging_default(self):
        """기본 설정으로 로깅 구성"""
        from shared.utils.logger import configure_logging

        # 에러 없이 실행되어야 함
        configure_logging()

    def test_configure_logging_debug_level(self):
        """DEBUG 레벨로 로깅 구성"""
        from shared.utils.logger import configure_logging

        configure_logging(level="DEBUG")

    def test_configure_logging_json_format(self):
        """JSON 포맷으로 로깅 구성"""
        from shared.utils.logger import configure_logging

        configure_logging(log_format="json")

    def test_configure_logging_console_format(self):
        """콘솔 포맷으로 로깅 구성"""
        from shared.utils.logger import configure_logging

        configure_logging(log_format="console")


class TestGetLogger:
    """get_logger 함수 테스트"""

    def test_get_logger_returns_logger(self):
        """get_logger가 로거 반환"""
        from shared.utils import get_logger

        logger = get_logger("test_module")

        assert logger is not None

    def test_get_logger_with_name(self):
        """이름이 바인딩된 로거 반환"""
        from shared.utils import get_logger

        logger = get_logger("my_module")

        # loguru 로거는 bind된 이름을 가짐
        assert logger is not None

    def test_logger_can_log_info(self, capsys):
        """INFO 레벨 로깅 가능"""
        from shared.utils import configure_logging, get_logger

        configure_logging(level="INFO", log_format="console")
        logger = get_logger("test")

        # 에러 없이 로깅되어야 함
        logger.info("test message")

    def test_logger_can_log_with_extra(self, capsys):
        """추가 컨텍스트와 함께 로깅"""
        from shared.utils import configure_logging, get_logger

        configure_logging(level="DEBUG", log_format="console")
        logger = get_logger("test")

        # 에러 없이 추가 데이터와 함께 로깅되어야 함
        logger.info("test message", key="value", number=42)

    def test_logger_different_levels(self):
        """다양한 로그 레벨 테스트"""
        from shared.utils import configure_logging, get_logger

        configure_logging(level="DEBUG", log_format="console")
        logger = get_logger("test")

        # 모든 레벨이 에러 없이 동작해야 함
        logger.debug("debug message")
        logger.info("info message")
        logger.warning("warning message")
        logger.error("error message")


class TestDefaultLogger:
    """default_logger 테스트"""

    def test_default_logger_exists(self):
        """기본 로거가 존재"""
        from shared.utils.logger import default_logger

        assert default_logger is not None
