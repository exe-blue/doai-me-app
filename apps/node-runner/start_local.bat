@echo off
REM DoAi.Me NodeRunner - Local Test Mode (Protocol v1.0)

set NODE_ID=%COMPUTERNAME%
set GATEWAY_URL=ws://localhost:8000/ws/node
set LAIXI_WS_URL=ws://127.0.0.1:22221/

echo ============================================
echo DoAi.Me NodeRunner - LOCAL TEST MODE
echo NODE_ID: %NODE_ID%
echo GATEWAY: %GATEWAY_URL%
echo ============================================

python main.py --local --no-sign

pause
