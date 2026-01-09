@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔═══════════════════════════════════════════════════════════╗
echo ║  Test 1: Cloud Gateway                                    ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo [1/4] 디렉토리 확인...
if not exist "services\cloud-gateway" (
    echo [FAIL] services\cloud-gateway 디렉토리가 없습니다.
    exit /b 1
)
echo [OK] services\cloud-gateway 존재

echo.
echo [2/4] 필수 파일 확인...
if not exist "services\cloud-gateway\main.py" (
    echo [FAIL] main.py 파일이 없습니다.
    exit /b 1
)
if not exist "services\cloud-gateway\requirements.txt" (
    echo [FAIL] requirements.txt 파일이 없습니다.
    exit /b 1
)
echo [OK] 필수 파일 존재

echo.
echo [3/4] Python 환경 확인...
python --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Python이 설치되지 않았습니다.
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PY_VERSION=%%i
echo [OK] Python %PY_VERSION%

echo.
echo [4/4] Cloud Gateway 실행 테스트...
cd services\cloud-gateway

REM 가상환경이 없으면 생성
if not exist "venv" (
    echo [INFO] 가상환경 생성 중...
    python -m venv venv
)

REM 가상환경 활성화 및 의존성 설치
call venv\Scripts\activate.bat
pip install -r requirements.txt -q

echo.
echo [INFO] Cloud Gateway를 백그라운드에서 시작합니다...
echo [INFO] 5초 후 헬스체크를 수행합니다...

REM 백그라운드에서 서버 시작
start /b python main.py

REM 서버 시작 대기
timeout /t 5 /nobreak >nul

REM 헬스체크
echo.
echo [INFO] 헬스체크 수행 중...
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [PASS] Cloud Gateway 테스트 성공!                        ║
    echo ║  http://localhost:8000/health → 200 OK                    ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im python.exe >nul 2>&1
    exit /b 0
) else (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [FAIL] Cloud Gateway 테스트 실패                         ║
    echo ║  HTTP Status: %STATUS%                                     ║
    echo ║                                                           ║
    echo ║  문제 해결:                                                ║
    echo ║  1. 포트 8000이 사용 중인지 확인                           ║
    echo ║  2. services\cloud-gateway\main.py 확인                   ║
    echo ║  3. 로그 확인: python main.py                             ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im python.exe >nul 2>&1
    exit /b 1
)
