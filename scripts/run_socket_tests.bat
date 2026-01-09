@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

:: ============================================================
:: Socket Connection Resilience Tests Runner
:: DoAi.Me Project
:: ============================================================

title Socket Resilience Tests

:menu
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║       Socket Connection Resilience Tests                   ║
echo  ║       DoAi.Me - Connection Stability Verification          ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [자동화 테스트]
echo    1. Laixi 서버 강제 종료 및 재연결 테스트
echo    2. 동시 명령 5개 전송 테스트
echo    3. 메모리 모니터링 (1시간)
echo    4. 메모리 모니터링 (24시간)
echo    5. 전체 자동화 테스트 (메모리 제외)
echo.
echo  [수동 테스트 가이드]
echo    6. 수동 테스트 문서 열기 (MANUAL_TESTS.md)
echo.
echo  [기타]
echo    7. 테스트 결과 폴더 열기
echo    0. 종료
echo.
set /p choice=선택하세요 (0-7): 

if "%choice%"=="1" goto test_crash
if "%choice%"=="2" goto test_concurrent
if "%choice%"=="3" goto test_memory_1h
if "%choice%"=="4" goto test_memory_24h
if "%choice%"=="5" goto test_all
if "%choice%"=="6" goto open_manual
if "%choice%"=="7" goto open_results
if "%choice%"=="0" goto end

echo.
echo 잘못된 선택입니다. 다시 선택해주세요.
timeout /t 2 > nul
goto menu

:: ============================================================
:: Test 1: Laixi Crash Recovery
:: ============================================================
:test_crash
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  Test 1: Laixi 서버 강제 종료 및 재연결 테스트             ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [준비 사항]
echo    - Laixi 서버 (touping.exe) 실행 중이어야 합니다
echo    - establish_connection.js가 실행 중이면 더 정확한 테스트 가능
echo.
echo  [테스트 내용]
echo    1. Laixi WebSocket에 연결
echo    2. 연결 확인 후 Laixi 프로세스 강제 종료
echo    3. 재연결 시도 모니터링
echo    4. 재연결 성공 여부 검증
echo.
pause

cd /d "%~dp0"
python test_socket_resilience.py --test crash

echo.
pause
goto menu

:: ============================================================
:: Test 3: Concurrent Commands
:: ============================================================
:test_concurrent
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  Test 3: 동시 명령 5개 전송 테스트                         ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [준비 사항]
echo    - Laixi 서버 (touping.exe) 실행 중이어야 합니다
echo    - 디바이스가 연결되어 있어야 합니다
echo.
echo  [테스트 내용]
echo    1. WebSocket 연결
echo    2. 5개 명령 동시 전송 (Toast, List, Home, Back, ScreenOn)
echo    3. 응답 수신 순서 기록
echo    4. FIFO 매칭 오류 여부 검증
echo.
pause

cd /d "%~dp0"
python test_socket_resilience.py --test concurrent

echo.
pause
goto menu

:: ============================================================
:: Test 4: Memory Monitoring (1 hour)
:: ============================================================
:test_memory_1h
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  Test 4: 메모리 모니터링 (1시간)                           ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [준비 사항]
echo    - establish_connection.js 또는 Node.js 프로세스 실행 중
echo    - psutil 패키지 설치: pip install psutil
echo.
echo  [테스트 내용]
echo    1. 프로세스 메모리 사용량 모니터링
echo    2. 1분 간격으로 스냅샷 저장
echo    3. 1시간 후 메모리 증가율 분석
echo    4. 결과는 scripts/test_results/ 폴더에 CSV로 저장
echo.
echo  [중단하려면 Ctrl+C를 누르세요]
echo.
pause

cd /d "%~dp0"
python test_socket_resilience.py --test memory --duration 1

echo.
pause
goto menu

:: ============================================================
:: Test 4: Memory Monitoring (24 hours)
:: ============================================================
:test_memory_24h
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  Test 4: 메모리 모니터링 (24시간)                          ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [경고] 이 테스트는 24시간 동안 실행됩니다!
echo.
echo  [준비 사항]
echo    - establish_connection.js 또는 Node.js 프로세스 실행 중
echo    - psutil 패키지 설치: pip install psutil
echo    - 컴퓨터 절전 모드 비활성화 권장
echo.
echo  [테스트 내용]
echo    1. 프로세스 메모리 사용량 모니터링
echo    2. 1분 간격으로 스냅샷 저장
echo    3. 24시간 후 메모리 증가율 분석
echo    4. 20%% 이상 증가 시 FAIL
echo    5. 결과는 scripts/test_results/ 폴더에 CSV로 저장
echo.
echo  [중단하려면 Ctrl+C를 누르세요]
echo.

set /p confirm=정말 24시간 테스트를 시작하시겠습니까? (y/n): 
if /i not "%confirm%"=="y" goto menu

cd /d "%~dp0"
python test_socket_resilience.py --test memory --duration 24

echo.
pause
goto menu

:: ============================================================
:: Run All Tests
:: ============================================================
:test_all
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  전체 자동화 테스트 (메모리 모니터링 제외)                  ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  [실행할 테스트]
echo    1. Laixi 서버 강제 종료 및 재연결 테스트
echo    2. 동시 명령 5개 전송 테스트
echo.
echo  [준비 사항]
echo    - Laixi 서버 (touping.exe) 실행 중
echo    - 디바이스 연결됨
echo.
pause

cd /d "%~dp0"
python test_socket_resilience.py --test all

echo.
pause
goto menu

:: ============================================================
:: Open Manual Tests Document
:: ============================================================
:open_manual
cls
echo.
echo  수동 테스트 문서를 엽니다...
echo.

if exist "%~dp0MANUAL_TESTS.md" (
    start "" "%~dp0MANUAL_TESTS.md"
) else (
    echo  오류: MANUAL_TESTS.md 파일을 찾을 수 없습니다.
    pause
)

goto menu

:: ============================================================
:: Open Test Results Folder
:: ============================================================
:open_results
cls
echo.
echo  테스트 결과 폴더를 엽니다...
echo.

if not exist "%~dp0test_results" (
    mkdir "%~dp0test_results"
)

start "" "%~dp0test_results"

goto menu

:: ============================================================
:: End
:: ============================================================
:end
echo.
echo  테스트 종료
echo.
exit /b 0
