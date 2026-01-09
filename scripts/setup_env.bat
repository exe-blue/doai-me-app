@echo off
chcp 65001 >nul
setlocal

echo ╔═══════════════════════════════════════════════════════════╗
echo ║  DoAi.Me 환경 변수 설정                                    ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo [1/3] Cloud Gateway .env 설정...
if not exist "services\cloud-gateway\.env" (
    if exist "services\cloud-gateway\env.example" (
        copy "services\cloud-gateway\env.example" "services\cloud-gateway\.env" >nul
        echo [OK] services\cloud-gateway\.env 생성됨
    ) else (
        echo [SKIP] env.example 파일 없음
    )
) else (
    echo [SKIP] .env 이미 존재
)

echo.
echo [2/3] Local Gateway .env 설정...
if not exist "local\gateway\.env" (
    if exist "local\gateway\config.example.env" (
        copy "local\gateway\config.example.env" "local\gateway\.env" >nul
        echo [OK] local\gateway\.env 생성됨
    ) else (
        echo [SKIP] config.example.env 파일 없음
    )
) else (
    echo [SKIP] .env 이미 존재
)

echo.
echo [3/3] Frontend .env.local 설정...
if not exist "apps\web\.env.local" (
    if exist "apps\web\env.local.example" (
        copy "apps\web\env.local.example" "apps\web\.env.local" >nul
        echo [OK] apps\web\.env.local 생성됨
    ) else (
        echo [SKIP] env.local.example 파일 없음
    )
) else (
    echo [SKIP] .env.local 이미 존재
)

echo.
echo ═══════════════════════════════════════════════════════════
echo  설정 완료!
echo ═══════════════════════════════════════════════════════════
echo.
echo 다음 단계:
echo   1. 각 .env 파일을 열어 필요한 값을 입력하세요
echo   2. Supabase 연결: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
echo   3. 실행: scripts\test_all.bat
echo.
echo 설정 파일 위치:
echo   - services\cloud-gateway\.env
echo   - local\gateway\.env  
echo   - apps\web\.env.local
echo.
pause
