@echo off
chcp 65001 > nul
title DoAi.Me Connection Establishment Protocol

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║   DoAi.Me Connection Establishment Protocol v1.0          ║
echo ║              최초 접속 무결성 검증 시스템                    ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM =========================================
REM 설정 (필요 시 수정)
REM =========================================
set LAIXI_WS_URL=ws://127.0.0.1:22221

REM =========================================
REM Laixi 실행 확인
REM =========================================
echo [체크] Laixi 앱 실행 상태 확인 중...

REM Laixi 프로세스 확인 (Laixi.exe)
tasklist /FI "IMAGENAME eq Laixi.exe" 2>NUL | find /I /N "Laixi.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Laixi 앱이 실행 중입니다.
) else (
    echo [경고] Laixi 앱이 실행되지 않았습니다.
    echo        Laixi.exe를 먼저 실행하세요.
    echo.
    set /p CONTINUE="계속 진행하시겠습니까? (Y/N): "
    if /I not "%CONTINUE%"=="Y" (
        echo 종료합니다.
        pause
        exit /b 1
    )
)
echo.

REM =========================================
REM Node.js 확인
REM =========================================
echo [체크] Node.js 설치 확인 중...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo        https://nodejs.org 에서 다운로드하세요.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% 감지
echo.

REM =========================================
REM 현재 디렉토리 설정
REM =========================================
cd /d "%~dp0"
echo [INFO] 실행 위치: %CD%

REM =========================================
REM 의존성 설치 확인
REM =========================================
if not exist "node_modules" (
    echo [INFO] 의존성 설치 중...
    call npm install ws --save
    echo.
)

REM =========================================
REM 옵션 선택
REM =========================================
echo.
echo ════════════════════════════════════════════════════════════
echo  실행 모드를 선택하세요:
echo ════════════════════════════════════════════════════════════
echo.
echo   1. 전체 실행 (연결 + 검증 + 초기화 + Heartbeat)
echo   2. 검증만 실행 (연결 + 검증 후 종료)
echo   3. 초기화만 실행 (검증 스킵, 바로 초기화)
echo   4. 종료
echo.
set /p MODE="선택 (1-4): "

if "%MODE%"=="4" (
    echo 종료합니다.
    exit /b 0
)

set ARGS=
if "%MODE%"=="2" set ARGS=--verify-only
if "%MODE%"=="3" set ARGS=--init-only

REM =========================================
REM 성립 명령 실행
REM =========================================
echo.
echo ════════════════════════════════════════════════════════════
echo  성립 명령 실행 중...
echo  종료하려면 Ctrl+C를 누르세요.
echo ════════════════════════════════════════════════════════════
echo.

node establish_connection.js %ARGS%

echo.
echo [INFO] 프로세스가 종료되었습니다.
pause
