@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔═══════════════════════════════════════════════════════════╗
echo ║  Test 3: Frontend (apps/web)                              ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo [1/4] 디렉토리 확인...
if not exist "apps\web" (
    echo [FAIL] apps\web 디렉토리가 없습니다.
    exit /b 1
)
echo [OK] apps\web 존재

echo.
echo [2/4] 필수 파일 확인...
if not exist "apps\web\package.json" (
    echo [FAIL] package.json 파일이 없습니다.
    exit /b 1
)
if not exist "apps\web\next.config.js" (
    echo [WARN] next.config.js 파일이 없습니다. (선택사항)
)
echo [OK] 필수 파일 존재

echo.
echo [3/4] Node.js 환경 확인...
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js가 설치되지 않았습니다.
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION%

echo.
echo [4/4] Frontend 빌드 테스트...
cd apps\web

REM node_modules가 없으면 설치
if not exist "node_modules" (
    echo [INFO] 의존성 설치 중...
    call npm install
)

REM 환경변수 파일 확인
if not exist ".env.local" (
    echo [INFO] .env.local 생성 중...
    echo NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000 > .env.local
)

echo.
echo [INFO] Next.js 개발 서버를 시작합니다...
echo [INFO] 15초 후 헬스체크를 수행합니다...

REM 백그라운드에서 서버 시작
start /b npm run dev

REM 서버 시작 대기 (Next.js는 시간이 더 걸림)
timeout /t 15 /nobreak >nul

REM 헬스체크
echo.
echo [INFO] 헬스체크 수행 중...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [PASS] Frontend 테스트 성공!                             ║
    echo ║  http://localhost:3000 → 200 OK                           ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im node.exe >nul 2>&1
    exit /b 0
) else (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [FAIL] Frontend 테스트 실패                              ║
    echo ║  HTTP Status: %STATUS%                                     ║
    echo ║                                                           ║
    echo ║  문제 해결:                                                ║
    echo ║  1. 포트 3000이 사용 중인지 확인                           ║
    echo ║  2. apps\web\package.json 확인                            ║
    echo ║  3. 로그 확인: npm run dev                                ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im node.exe >nul 2>&1
    exit /b 1
)
