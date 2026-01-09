@echo off
REM DoAi.Me NodeRunner - Production Start Script

REM 환경변수 설정
set NODE_ID=%COMPUTERNAME%
set CENTRAL_URL=wss://api.doai.me/ws/node
set LAIXI_HOST=127.0.0.1
set LAIXI_PORT=22221
set LAIXI_PATH=C:\Program Files\Laixi\Laixi.exe

echo ============================================
echo DoAi.Me NodeRunner - The Muscle
echo NODE_ID: %NODE_ID%
echo CENTRAL: %CENTRAL_URL%
echo ============================================

REM 실행
python noderunner.py

pause
