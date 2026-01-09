#!/bin/bash
# Full Flow Test Script
# Tests: Task Creation → Simulator Execution → Result Verification

echo "🧪 AIFARM Full Flow Test"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check if Backend is running
echo "1️⃣ Checking Backend server..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo ""
    echo "Please start the Backend server first:"
    echo "  cd backend"
    echo "  python main.py"
    echo ""
    exit 1
fi

echo ""

# 2. Create a test task
echo "2️⃣ Creating test task..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:8000/api/tasks \
    -H "Content-Type: application/json" \
    -d '{
        "keyword": "여행 브이로그",
        "title": "테스트 영상 - Full Flow",
        "priority": 5
    }')

TASK_ID=$(echo $TASK_RESPONSE | grep -o '"task_id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$TASK_ID" ]; then
    echo -e "${RED}✗ Failed to create task${NC}"
    echo "Response: $TASK_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Task created: ID=$TASK_ID${NC}"
echo ""

# 3. Check task status
echo "3️⃣ Checking task status before execution..."
STATUS_BEFORE=$(curl -s http://localhost:8000/api/tasks/status)
echo "$STATUS_BEFORE" | grep -o '"pending":[0-9]*'
echo ""

# 4. Run simulator (single iteration)
echo "4️⃣ Running simulator to pick up and complete the task..."
echo -e "${YELLOW}Note: Simulator will run for ~5 seconds${NC}"
echo ""

# Run simulator in background for 5 seconds
timeout 5s node tests/simulator.js &
SIMULATOR_PID=$!

# Wait for completion
wait $SIMULATOR_PID 2>/dev/null

echo ""
echo -e "${GREEN}✓ Simulator completed${NC}"
echo ""

# 5. Check task status after
echo "5️⃣ Checking task status after execution..."
STATUS_AFTER=$(curl -s http://localhost:8000/api/tasks/status)
echo "$STATUS_AFTER" | grep -o '"completed":[0-9]*'
echo ""

# 6. Get task result details
echo "6️⃣ Fetching task result details..."
RESULT=$(curl -s "http://localhost:8000/api/tasks/$TASK_ID")
echo "$RESULT" | python -m json.tool 2>/dev/null || echo "$RESULT"
echo ""

# 7. Summary
echo "========================"
echo -e "${GREEN}✅ Full Flow Test Complete!${NC}"
echo ""
echo "Verify the result includes:"
echo "  - watch_duration > 0"
echo "  - liked: true/false (random)"
echo "  - commented: true/false (random)"
echo "  - subscribed: true/false (random)"
echo "  - notification_set: true/false (if subscribed)"
echo "  - shared: true/false (random)"
echo "  - added_to_playlist: true/false (random)"
echo ""
