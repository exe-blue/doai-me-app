@echo off
REM PC Agent 시작 스크립트 (Windows)
REM 사용법: start_agent.bat PC1 https://your-server.com your-api-key

SET PC_ID=%1
SET SERVER_URL=%2
SET API_KEY=%3

IF "%PC_ID%"=="" (
    echo 사용법: start_agent.bat [PC_ID] [SERVER_URL] [API_KEY]
    echo 예시: start_agent.bat PC1 https://api.example.com test-key-123
    exit /b 1
)

IF "%SERVER_URL%"=="" SET SERVER_URL=http://localhost:8000
IF "%API_KEY%"=="" SET API_KEY=test-key-123

echo ========================================
echo PC Agent 시작
echo PC ID: %PC_ID%
echo Server: %SERVER_URL%
echo ========================================

python pc_agent.py --pc-id %PC_ID% --server %SERVER_URL% --api-key %API_KEY%

pause

