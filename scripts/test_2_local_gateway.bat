@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔═══════════════════════════════════════════════════════════╗
echo ║  Test 2: Local Gateway                                    ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo [1/4] 디렉토리 확인...
if not exist "local\gateway" (
    echo [FAIL] local\gateway 디렉토리가 없습니다.
    exit /b 1
)
echo [OK] local\gateway 존재

echo.
echo [2/4] 필수 파일 확인...
if not exist "local\gateway\package.json" (
    echo [FAIL] package.json 파일이 없습니다.
    exit /b 1
)
if not exist "local\gateway\src\index.js" (
    echo [FAIL] src\index.js 파일이 없습니다.
    exit /b 1
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

npm --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm이 설치되지 않았습니다.
    exit /b 1
)
for /f "tokens=1" %%i in ('npm --version 2^>^&1') do set NPM_VERSION=%%i
echo [OK] npm %NPM_VERSION%

echo.
echo [4/4] Local Gateway 실행 테스트...
cd local\gateway

REM node_modules가 없으면 설치
if not exist "node_modules" (
    echo [INFO] 의존성 설치 중...
    call npm install
)

REM 환경변수 파일 확인
if not exist ".env" (
    echo [INFO] .env 파일이 없습니다. config.example.env를 복사합니다...
    if exist "config.example.env" (
        copy config.example.env .env >nul
    ) else (
        echo [WARN] config.example.env도 없습니다. 기본값으로 진행합니다.
    )
)

echo.
echo [INFO] Local Gateway를 백그라운드에서 시작합니다...
echo [INFO] 8초 후 헬스체크를 수행합니다...

REM 백그라운드에서 서버 시작 (MOCK 모드)
set MOCK_DEVICES=true
set VULTR_ENABLED=false
start /b npm start

REM 서버 시작 대기 (npm start는 시간이 더 걸림)
timeout /t 8 /nobreak >nul

REM 헬스체크
echo.
echo [INFO] 헬스체크 수행 중...
curl -s -o nul -w "%%{http_code}" http://localhost:3100/health > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [PASS] Local Gateway 테스트 성공!                        ║
    echo ║  http://localhost:3100/health → 200 OK                    ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im node.exe >nul 2>&1
    exit /b 0
) else (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║  [FAIL] Local Gateway 테스트 실패                         ║
    echo ║  HTTP Status: %STATUS%                                     ║
    echo ║                                                           ║
    echo ║  문제 해결:                                                ║
    echo ║  1. 포트 3100이 사용 중인지 확인                           ║
    echo ║  2. local\gateway\server.js 확인                          ║
    echo ║  3. 로그 확인: npm start                                  ║
    echo ╚═══════════════════════════════════════════════════════════╝
    
    REM 서버 종료
    taskkill /f /im node.exe >nul 2>&1
    exit /b 1
)
