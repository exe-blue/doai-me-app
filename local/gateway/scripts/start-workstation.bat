@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ═══════════════════════════════════════════════════════════════
echo   DoAi.Me Workstation Startup
echo   Device → Node → Network → Server
echo ═══════════════════════════════════════════════════════════════
echo.

:: Step 1: Pre-flight checks
echo [1/6] Pre-flight 체크...

where adb >nul 2>&1
if errorlevel 1 (
    echo   ERROR: ADB가 설치되어 있지 않거나 PATH에 없습니다.
    pause
    exit /b 1
)
echo   - ADB 확인됨

where node >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js가 설치되어 있지 않습니다.
    pause
    exit /b 1
)
echo   - Node.js 확인됨

:: Step 2: Check LAIXI.EXE
echo.
echo [2/6] LAIXI.EXE 상태 확인...

tasklist /FI "IMAGENAME eq laixi.exe" 2>nul | find /I "laixi.exe" >nul
if errorlevel 1 (
    echo   WARNING: LAIXI.EXE가 실행되지 않았습니다.
    set /p CONTINUE="LAIXI 없이 계속하시겠습니까? (y/n): "
    if /i not "!CONTINUE!"=="y" exit /b 1
) else (
    echo   - LAIXI.EXE 실행 중
)

:: Step 3: Start ADB server
echo.
echo [3/6] ADB 서버 시작...
adb start-server >nul 2>&1
for /f %%i in ('adb devices ^| find /c /v ""') do set /a DEVICE_COUNT=%%i-2
echo   - 연결된 디바이스: %DEVICE_COUNT%대

:: Step 4: Check Cloud Gateway
echo.
echo [4/6] Cloud Gateway 연결 확인...
curl -s http://158.247.210.152:3100/health >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Cloud Gateway에 연결할 수 없습니다.
) else (
    echo   - Cloud Gateway 접속 가능
)

:: Step 5: Start Local Gateway
echo.
echo [5/6] Local Gateway 시작...
cd /d %~dp0..

curl -s http://localhost:3100/health >nul 2>&1
if not errorlevel 1 (
    echo   - Local Gateway가 이미 실행 중입니다.
    goto :verify
)

start "DoAi-Gateway" cmd /k "npm start"
timeout /t 8 /nobreak >nul

:: Step 6: Verify
:verify
echo.
echo [6/6] 연결 상태 확인...

curl -s http://localhost:3100/health >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Local Gateway 시작 실패
    pause
    exit /b 1
)
echo   - Local Gateway: http://localhost:3100

echo.
echo ═══════════════════════════════════════════════════════════════
echo   Workstation 준비 완료!
echo   테스트: node scripts/test-connection.js
echo ═══════════════════════════════════════════════════════════════
pause
