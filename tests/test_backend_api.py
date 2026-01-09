"""
Backend API 테스트

실행: 
  cd backend/api && python -m pytest -v
또는:
  uvicorn main:app --reload  # 서버 실행 후 수동 테스트
"""

import pytest
import sys
from pathlib import Path


class TestBackendConfig:
    """Backend 설정 테스트"""
    
    def test_import_config(self):
        """config 모듈 import 테스트"""
        sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "api"))
        
        try:
            from config import Settings
            assert Settings is not None
        except Exception as e:
            # 환경변수 누락 시 예상되는 오류
            assert "환경 변수" in str(e) or "required" in str(e).lower()
        finally:
            sys.path.pop(0)


class TestBackendAPIIntegration:
    """
    Backend API 통합 테스트
    
    이 테스트들은 backend/api 디렉토리에서 실행해야 합니다.
    또는 실행 중인 서버에 HTTP 요청으로 테스트합니다.
    """
    
    @pytest.mark.skip(reason="서버 실행 상태에서만 테스트 가능")
    def test_root_endpoint_live(self):
        """/ 엔드포인트 라이브 테스트"""
        import httpx
        
        response = httpx.get("http://localhost:8001/")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "DoAi.Me Backend API"
    
    @pytest.mark.skip(reason="서버 실행 상태에서만 테스트 가능")
    def test_health_endpoint_live(self):
        """Health check 엔드포인트 라이브 테스트"""
        import httpx
        
        response = httpx.get("http://localhost:8001/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"


# Backend API 디렉토리에서 직접 실행할 때 사용하는 테스트
# cd backend/api && python -m pytest test_api.py -v
_BACKEND_TEST_CODE = '''
"""
Backend API In-Directory 테스트

실행: cd backend/api && python -m pytest test_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root():
    """/ 엔드포인트 테스트"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "DoAi.Me Backend API"


def test_health():
    """Health check 테스트"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_api_info():
    """API info 테스트"""
    response = client.get("/api/info")
    assert response.status_code == 200
    data = response.json()
    assert "endpoints" in data


def test_process_time_header():
    """X-Process-Time 헤더 테스트"""
    response = client.get("/health")
    assert "x-process-time" in response.headers


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''


def create_backend_test_file():
    """backend/api/test_api.py 파일 생성"""
    test_path = Path(__file__).parent.parent / "backend" / "api" / "test_api.py"
    test_path.write_text(_BACKEND_TEST_CODE)
    return test_path


if __name__ == "__main__":
    # backend/api/test_api.py 파일 자동 생성
    create_backend_test_file()
    pytest.main([__file__, "-v"])
