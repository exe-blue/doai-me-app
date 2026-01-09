"""
Backend API 테스트

실행 방법:
1. 서버를 먼저 실행:
   cd backend/api
   uvicorn main:app --reload --port 8001

2. 다른 터미널에서 테스트 실행:
   python test_api.py
"""

import sys

try:
    import httpx
except ImportError:
    print("httpx 패키지가 필요합니다: pip install httpx")
    sys.exit(1)


BASE_URL = "http://localhost:8001"


def test_root():
    """/ 엔드포인트 테스트"""
    response = httpx.get(f"{BASE_URL}/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "DoAi.Me Backend API"
    print("✅ test_root PASSED")


def test_health():
    """Health check 테스트"""
    response = httpx.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✅ test_health PASSED")


def test_api_info():
    """API info 테스트"""
    response = httpx.get(f"{BASE_URL}/api/info")
    assert response.status_code == 200
    data = response.json()
    assert "endpoints" in data
    print("✅ test_api_info PASSED")


def test_process_time_header():
    """X-Process-Time 헤더 테스트"""
    response = httpx.get(f"{BASE_URL}/health")
    assert "x-process-time" in response.headers
    print("✅ test_process_time_header PASSED")


def run_all_tests():
    """모든 테스트 실행"""
    print(f"\n🔍 Testing Backend API at {BASE_URL}\n")
    
    tests = [
        test_root,
        test_health,
        test_api_info,
        test_process_time_header,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except httpx.ConnectError:
            print(f"❌ 서버 연결 실패 - 서버가 실행 중인지 확인하세요")
            print(f"   실행 명령: uvicorn main:app --reload --port 8001")
            return
        except AssertionError as e:
            print(f"❌ {test.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__} ERROR: {e}")
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    run_all_tests()
