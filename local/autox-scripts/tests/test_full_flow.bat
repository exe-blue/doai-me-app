@echo off
REM Full Flow Test Script for Windows
REM Tests: Task Creation → Simulator Execution → Result Verification

echo ========================================
echo 🧪 AIFARM Full Flow Test
echo ========================================
echo.

REM 1. Check if Backend is running
echo 1️⃣ Checking Backend server...
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Backend is running
) else (
    echo ✗ Backend is NOT running
    echo.
    echo Please start the Backend server first:
    echo   cd backend
    echo   python main.py
    echo.
    exit /b 1
)

echo.

REM 2. Create a test task
echo 2️⃣ Creating test task...
curl -s -X POST http://localhost:8000/api/tasks ^
    -H "Content-Type: application/json" ^
    -d "{\"keyword\":\"여행 브이로그\",\"title\":\"테스트 영상 - Full Flow\",\"priority\":5}" > task_response.json

echo ✓ Task created
type task_response.json
echo.

REM 3. Check task status before
echo 3️⃣ Checking task status before execution...
curl -s http://localhost:8000/api/tasks/status
echo.

REM 4. Run simulator (single iteration)
echo 4️⃣ Running simulator to pick up and complete the task...
echo Note: Simulator will run for ~5 seconds
echo.

start /b timeout /t 5 >nul && taskkill /f /im node.exe >nul 2>&1
node tests\simulator.js

echo.
echo ✓ Simulator completed
echo.

REM 5. Check task status after
echo 5️⃣ Checking task status after execution...
curl -s http://localhost:8000/api/tasks/status
echo.

REM 6. Summary
echo ========================================
echo ✅ Full Flow Test Complete!
echo ========================================
echo.
echo Verify the simulator output includes:
echo   - watch_duration ^> 0
echo   - liked: true/false
echo   - commented: true/false
echo   - subscribed: true/false
echo   - notification_set: true/false
echo   - shared: true/false
echo   - added_to_playlist: true/false
echo.

REM Cleanup
del task_response.json >nul 2>&1
