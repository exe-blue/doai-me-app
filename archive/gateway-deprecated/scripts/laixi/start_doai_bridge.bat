@echo off
chcp 65001 > nul
title DoAi.ME Market Bridge

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║       DoAi.ME Market Bridge Launcher                 ║
echo ║       Laixi ↔ DoAi.ME 실시간 연결                    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM =========================================
REM 설정 (필요 시 수정)
REM =========================================
set DOAI_API_URL=http://localhost:3000
set DOAI_WS_PORT=8080
set LAIXI_WS_URL=ws://127.0.0.1:22221

REM =========================================
REM Node.js 확인
REM =========================================
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다.
    echo         https://nodejs.org 에서 다운로드하세요.
    pause
    exit /b 1
)

REM =========================================
REM 현재 디렉토리 설정
REM =========================================
cd /d "%~dp0"
echo [INFO] 실행 위치: %CD%
echo.

REM =========================================
REM 의존성 설치 확인
REM =========================================
if not exist "node_modules" (
    echo [INFO] 의존성 설치 중...
    call npm install ws --save
    echo.
)

REM =========================================
REM 브릿지 실행
REM =========================================
echo [INFO] 설정:
echo        - DoAi.ME API: %DOAI_API_URL%
echo        - WebSocket 포트: %DOAI_WS_PORT%
echo        - Laixi 주소: %LAIXI_WS_URL%
echo.
echo [INFO] 브릿지 시작 중...
echo        종료하려면 Ctrl+C를 누르세요.
echo.
echo ════════════════════════════════════════════════════════
echo.

node doai_market_bridge.js

echo.
echo [INFO] 브릿지가 종료되었습니다.
pause

