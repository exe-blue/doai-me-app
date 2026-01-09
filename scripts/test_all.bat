@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                                                                   ║
echo ║   DoAi.Me - 전체 통합 테스트                                       ║
echo ║                                                                   ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

set PASS_COUNT=0
set FAIL_COUNT=0

echo ═══════════════════════════════════════════════════════════════════
echo  Phase 1: 환경 검증
echo ═══════════════════════════════════════════════════════════════════
echo.

REM Python 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Python 미설치
    set /a FAIL_COUNT+=1
) else (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do echo [OK] Python %%i
    set /a PASS_COUNT+=1
)

REM Node.js 확인
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js 미설치
    set /a FAIL_COUNT+=1
) else (
    for /f "tokens=1" %%i in ('node --version 2^>^&1') do echo [OK] Node.js %%i
    set /a PASS_COUNT+=1
)

REM curl 확인
curl --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] curl 미설치
    set /a FAIL_COUNT+=1
) else (
    echo [OK] curl 설치됨
    set /a PASS_COUNT+=1
)

echo.
echo ═══════════════════════════════════════════════════════════════════
echo  Phase 2: 디렉토리 구조 검증
echo ═══════════════════════════════════════════════════════════════════
echo.

if exist "services\cloud-gateway" (
    echo [OK] services\cloud-gateway
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] services\cloud-gateway 없음
    set /a FAIL_COUNT+=1
)

if exist "local\gateway" (
    echo [OK] local\gateway
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] local\gateway 없음
    set /a FAIL_COUNT+=1
)

if exist "apps\web" (
    echo [OK] apps\web
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] apps\web 없음
    set /a FAIL_COUNT+=1
)

echo.
echo ═══════════════════════════════════════════════════════════════════
echo  Phase 3: 서비스 시작
echo ═══════════════════════════════════════════════════════════════════
echo.

REM 이전 프로세스 정리
echo [INFO] 기존 프로세스 정리 중...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM 1. Cloud Gateway 시작
echo.
echo [1/3] Cloud Gateway 시작 중...
cd services\cloud-gateway
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
start /b python main.py
cd "%PROJECT_ROOT%"

REM 2. Local Gateway 시작
echo [2/3] Local Gateway 시작 중...
cd local\gateway
if not exist "node_modules" (
    call npm install --silent
)
set MOCK_DEVICES=true
set VULTR_ENABLED=false
start /b npm start
cd "%PROJECT_ROOT%"

REM 3. Frontend 시작
echo [3/3] Frontend 시작 중...
cd apps\web
if not exist "node_modules" (
    call npm install --silent
)
if not exist ".env.local" (
    echo NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000 > .env.local
)
start /b npm run dev
cd "%PROJECT_ROOT%"

echo.
echo [INFO] 모든 서비스 시작 완료. 20초 대기 중...
timeout /t 20 /nobreak >nul

echo.
echo ═══════════════════════════════════════════════════════════════════
echo  Phase 4: 헬스체크
echo ═══════════════════════════════════════════════════════════════════
echo.

REM Cloud Gateway 헬스체크
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health > temp_cg.txt 2>nul
set /p CG_STATUS=<temp_cg.txt
del temp_cg.txt 2>nul

if "%CG_STATUS%"=="200" (
    echo [PASS] Cloud Gateway  : http://localhost:8000  → 200 OK
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] Cloud Gateway  : http://localhost:8000  → %CG_STATUS%
    set /a FAIL_COUNT+=1
)

REM Local Gateway 헬스체크
curl -s -o nul -w "%%{http_code}" http://localhost:3100/health > temp_lg.txt 2>nul
set /p LG_STATUS=<temp_lg.txt
del temp_lg.txt 2>nul

if "%LG_STATUS%"=="200" (
    echo [PASS] Local Gateway  : http://localhost:3100  → 200 OK
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] Local Gateway  : http://localhost:3100  → %LG_STATUS%
    set /a FAIL_COUNT+=1
)

REM Frontend 헬스체크
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > temp_fe.txt 2>nul
set /p FE_STATUS=<temp_fe.txt
del temp_fe.txt 2>nul

if "%FE_STATUS%"=="200" (
    echo [PASS] Frontend       : http://localhost:3000  → 200 OK
    set /a PASS_COUNT+=1
) else (
    echo [FAIL] Frontend       : http://localhost:3000  → %FE_STATUS%
    set /a FAIL_COUNT+=1
)

echo.
echo ═══════════════════════════════════════════════════════════════════
echo  결과 요약
echo ═══════════════════════════════════════════════════════════════════
echo.
echo   통과: %PASS_COUNT%
echo   실패: %FAIL_COUNT%
echo.

if %FAIL_COUNT% EQU 0 (
    echo ╔═══════════════════════════════════════════════════════════════════╗
    echo ║                                                                   ║
    echo ║   [SUCCESS] 모든 테스트 통과!                                      ║
    echo ║                                                                   ║
    echo ║   서비스 URL:                                                     ║
    echo ║   - Cloud Gateway : http://localhost:8000                         ║
    echo ║   - Local Gateway : http://localhost:3100                         ║
    echo ║   - Frontend      : http://localhost:3000/admin/command           ║
    echo ║                                                                   ║
    echo ╚═══════════════════════════════════════════════════════════════════╝
) else (
    echo ╔═══════════════════════════════════════════════════════════════════╗
    echo ║                                                                   ║
    echo ║   [FAIL] 일부 테스트 실패                                          ║
    echo ║                                                                   ║
    echo ║   개별 테스트 실행:                                                ║
    echo ║   - scripts\test_1_cloud_gateway.bat                              ║
    echo ║   - scripts\test_2_local_gateway.bat                              ║
    echo ║   - scripts\test_3_frontend.bat                                   ║
    echo ║                                                                   ║
    echo ╚═══════════════════════════════════════════════════════════════════╝
)

echo.
echo [INFO] 테스트 종료. 서비스를 계속 실행하려면 창을 닫지 마세요.
echo [INFO] 서비스 종료: taskkill /f /im python.exe ^& taskkill /f /im node.exe
pause
