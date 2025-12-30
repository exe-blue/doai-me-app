# AIFARM Testing Guide

Complete guide for testing the AutoX.js integration, from local simulation to real device deployment.

## 🧪 Testing Levels

### Level 1: Local Simulation (No Device Required)
Test the complete API flow without any physical devices.

### Level 2: Single Device Testing
Deploy and test on one Android device.

### Level 3: Multi-Device Testing
Test with multiple devices (phoneboards).

---

## 📋 Prerequisites

### Backend Server
```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies (if not done)
pip install -r requirements.txt

# 3. Start the server
python main.py
```

Server should be running at: `http://localhost:8000`

### Verify Backend is Running
```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status":"ok"}
```

---

## 🖥️ Level 1: Local Simulation Testing

### Step 1: Run the Simulator

```bash
# Navigate to autox-scripts directory
cd autox-scripts

# Run simulator
node tests/simulator.js
```

**Expected Output:**
```
🚀 AIFARM AutoX.js Simulator 시작

[INFO] 헬스 체크 중...
[SUCCESS] 서버 연결 정상 { status: 'ok' }

✅ 서버 연결 성공!

[INFO] 작업 현황 조회 중...
[SUCCESS] 작업 현황 { pending: 0, in_progress: 0, completed: 0, failed: 0 }

📝 시뮬레이션 시작 (Ctrl+C로 종료)

--- Iteration #1 ---
[INFO] 작업 요청 중...
[INFO] 대기 중인 작업 없음
[INFO] 대기 중... (작업이 없습니다)
```

### Step 2: Create a Test Task

Open a **new terminal** and create a task:

```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "여행 브이로그",
    "title": "테스트 영상 - Local Simulation",
    "priority": 5
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "task_id": 1,
  "message": "작업이 등록되었습니다"
}
```

### Step 3: Watch the Simulator Pick Up the Task

Go back to the **simulator terminal**. Within 3 seconds, you should see:

```
--- Iteration #2 ---
[INFO] 작업 요청 중...
[SUCCESS] 작업 수신 { task_id: 1, title: '테스트 영상 - Local Simulation', keyword: '여행 브이로그' }

==================================================
[SIMULATE] YouTube 시청 시뮬레이션
Task: { id: 1, title: '테스트 영상 - Local Simulation', keyword: '여행 브이로그', url: null }
[SIMULATE] YouTube 앱 실행
[SIMULATE] 영상 검색/열기
[SIMULATE] 87초 동안 시청 중...
[SIMULATE] 좋아요 클릭
[SIMULATE] 구독 클릭
[SIMULATE] 알림 설정 (전체)
[SIMULATE] 재생목록 추가 (나중에 볼 동영상)
[SIMULATE] YouTube 앱 종료
[SUCCESS] 시청 완료 {
  success: true,
  watch_duration: 87,
  search_type: 1,
  search_rank: 1,
  liked: true,
  commented: false,
  subscribed: true,
  notification_set: true,
  shared: false,
  added_to_playlist: true,
  error_message: null
}
==================================================

[INFO] 작업 완료 보고 중... { task_id: 1 }
[SUCCESS] 완료 보고 성공
[SUCCESS] 작업 현황 { pending: 0, in_progress: 0, completed: 1, failed: 0 }
```

### Step 4: Verify Results in Database

```bash
# Check task status
curl http://localhost:8000/api/tasks/status

# Expected:
# {
#   "success": true,
#   "summary": {
#     "pending": 0,
#     "in_progress": 0,
#     "completed": 1,
#     "failed": 0,
#     "total": 1
#   }
# }
```

### Step 5: Run Full Flow Test Script

```bash
# Windows
tests\test_full_flow.bat

# Linux/Mac
chmod +x tests/test_full_flow.sh
./tests/test_full_flow.sh
```

This script will:
1. ✅ Check Backend connection
2. ✅ Create a test task
3. ✅ Run simulator to complete the task
4. ✅ Verify results

---

## 📱 Level 2: Single Device Testing

### Prerequisites

1. **Android phone** with AutoX.js installed
2. **VS Code** with `Autox.js-VSCodeExt` extension
3. **Same Wi-Fi network** (phone and PC)

### Step 1: Configure Device Settings

Edit `autox-scripts/config/dev.json`:

```json
{
  "server": {
    "host": "192.168.0.100",  // ← Change to your PC's IP address
    "port": 8000,
    "protocol": "http"
  },
  "device": {
    "id": "PHONE_001",  // ← Unique ID for this device
    "model": "Xiaomi Redmi Note 10",
    "pc_id": "PC_01"
  }
}
```

**Find your PC's IP:**
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

### Step 2: Connect Phone to VS Code

#### Option A: Wi-Fi Connection (Recommended)

1. **On PC (VS Code):**
   - Press `Ctrl+Shift+P`
   - Run: `Autox.js: Start All Server`
   - You should see: `Auto.js server running on 0.0.0.0:9317`

2. **On Phone (AutoX.js app):**
   - Open AutoX.js app
   - Tap menu → "连接电脑" (Connect to Computer)
   - Enter your PC's IP: `192.168.0.100:9317`
   - Tap "连接" (Connect)

3. **Verify Connection:**
   - Green dot appears in VS Code status bar
   - Phone shows "已连接" (Connected)

#### Option B: USB Connection (ADB)

1. **On Phone:**
   - Enable Developer Mode (tap Build Number 7 times)
   - Enable USB Debugging
   - Connect USB cable

2. **On PC:**
   ```bash
   adb devices
   # Should show your device
   ```

### Step 3: Deploy Scripts to Phone

**Method 1: From VS Code**

1. Right-click `autox-scripts` folder
2. Select `Save Project to Device`
3. All files will be copied to phone

**Method 2: Press F5**

1. Open `main.js`
2. Press `F5`
3. Script runs immediately on connected devices

### Step 4: Run Script on Phone

**In AutoX.js app:**

1. Navigate to `autox-scripts` folder
2. Tap `main.js`
3. Tap the play button ▶️

**Expected behavior:**
- Script starts running
- Logs appear in AutoX.js app
- Script polls Backend every 3 seconds

### Step 5: Create a Task and Monitor

**On PC:**
```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "강아지 영상",
    "title": "실제 폰 테스트",
    "priority": 5
  }'
```

**On Phone:**
- Watch AutoX.js logs
- YouTube app should launch automatically
- Video plays, interactions happen
- App closes, result reported

### Step 6: Monitor Logs

**In AutoX.js app:**
- Tap "日志" (Logs) tab
- Real-time logs appear

**In VS Code:**
- `Ctrl+Shift+P` → `Toggle Developer Tools`
- Console tab shows logs from phone

### Step 7: Verify Results

```bash
# Check device status
curl http://localhost:8000/api/devices

# Expected:
# {
#   "success": true,
#   "devices": [
#     {
#       "device_id": "PHONE_001",
#       "model": "Xiaomi Redmi Note 10",
#       "total_completed": 1,
#       "total_failed": 0,
#       "last_seen": "2025-12-28T10:30:00Z"
#     }
#   ]
# }
```

---

## 🏭 Level 3: Multi-Device Testing

### Device ID Management

For 600 devices across 30 phoneboards:

```
PC_01: PHONE_001 ~ PHONE_020
PC_02: PHONE_021 ~ PHONE_040
PC_03: PHONE_041 ~ PHONE_060
...
PC_30: PHONE_581 ~ PHONE_600
```

### Batch Configuration Script

Create `autox-scripts/config/generate_configs.js`:

```javascript
// Generate 600 device configs
const fs = require('fs');

const BASE_IP = '192.168.0';
const PC_COUNT = 30;
const PHONES_PER_PC = 20;

for (let pc = 1; pc <= PC_COUNT; pc++) {
  for (let phone = 1; phone <= PHONES_PER_PC; phone++) {
    const deviceNum = (pc - 1) * PHONES_PER_PC + phone;
    const deviceId = `PHONE_${String(deviceNum).padStart(3, '0')}`;

    const config = {
      server: {
        host: `${BASE_IP}.${100 + pc}`,  // 192.168.0.101, 102, ...
        port: 8000,
        protocol: 'http'
      },
      device: {
        id: deviceId,
        model: 'Phone Farm Device',
        pc_id: `PC_${String(pc).padStart(2, '0')}`
      },
      settings: {
        polling_interval: 3000,
        max_retries: 3,
        timeout: 30000,
        log_level: 'info'
      },
      youtube: {
        min_watch_time: 30,
        max_watch_time: 180,
        like_probability: 0.3,
        comment_probability: 0.1,
        subscribe_probability: 0.05
      }
    };

    const filename = `config_${deviceId}.json`;
    fs.writeFileSync(filename, JSON.stringify(config, null, 2));
    console.log(`Generated: ${filename}`);
  }
}
```

Run:
```bash
node autox-scripts/config/generate_configs.js
```

### Batch Deployment

```bash
#!/bin/bash
# deploy_all.sh

# Deploy to all connected devices
for device in $(adb devices | grep -v "List" | awk '{print $1}')
do
  echo "Deploying to $device..."
  adb -s $device push autox-scripts /sdcard/autox-scripts/
  echo "✓ Deployed to $device"
done

echo "✅ Deployment complete!"
```

---

## 🐛 Troubleshooting

### Issue: Simulator can't connect to Backend

**Symptoms:**
```
[ERROR] 서버 연결 실패
```

**Solutions:**
1. Check Backend is running: `curl http://localhost:8000/health`
2. Check firewall settings
3. Verify port 8000 is not blocked

### Issue: Phone can't connect to VS Code

**Symptoms:**
- No green dot in VS Code
- Phone shows "连接失败" (Connection Failed)

**Solutions:**
1. Ensure phone and PC are on same Wi-Fi
2. Restart AutoX.js server in VS Code
3. Check firewall allows port 9317
4. Verify IP address is correct

### Issue: YouTube app doesn't launch

**Symptoms:**
```
[ERROR] YouTube 앱 실행 실패
```

**Solutions:**
1. YouTube app must be installed
2. Grant Accessibility permissions to AutoX.js
3. Restart phone
4. Check AutoX.js has "Display over other apps" permission

### Issue: Script stops running on phone

**Symptoms:**
- Script exits after a few minutes
- No more task polling

**Solutions:**
1. Disable battery optimization for AutoX.js
2. Allow background execution
3. Disable screen lock during development
4. Add AutoX.js to "Protected apps" (Xiaomi/Huawei)

---

## 📊 Performance Testing

### Metrics to Track

1. **Task Completion Rate**
   ```bash
   curl http://localhost:8000/api/tasks/status
   ```

2. **Device Health**
   ```bash
   curl http://localhost:8000/api/devices
   ```

3. **Average Watch Duration**
   - Check task_results table
   - Calculate avg(watch_duration)

### Load Testing

Create 100 tasks:
```bash
for i in {1..100}
do
  curl -X POST http://localhost:8000/api/tasks \
    -H "Content-Type: application/json" \
    -d "{\"keyword\":\"테스트 $i\",\"title\":\"Load Test Task $i\",\"priority\":5}"
done
```

Monitor how fast devices process them.

---

## ✅ Test Checklist

### Before Deployment
- [ ] Backend server runs without errors
- [ ] Simulator completes tasks successfully
- [ ] Database schema is up to date
- [ ] Config files have correct IP addresses
- [ ] All required permissions granted on phones

### Single Device Testing
- [ ] Device connects to VS Code
- [ ] Script deploys successfully
- [ ] Script runs on device
- [ ] YouTube app launches
- [ ] Video plays for configured duration
- [ ] Interactions work (like, comment, subscribe, etc.)
- [ ] Results are reported to Backend
- [ ] Device statistics update correctly

### Multi-Device Testing
- [ ] All devices connect
- [ ] No task collisions (same task to multiple devices)
- [ ] Load balancing works
- [ ] Failed tasks retry correctly
- [ ] Dashboard shows all devices

---

## 📝 Next Steps

After successful testing:

1. **Frontend Integration**: Create task creation UI
2. **Monitoring Dashboard**: Real-time device status
3. **Analytics**: Task success rates, popular videos
4. **Scheduling**: Time-based task execution
5. **Production Deployment**: HTTPS, API authentication

---

## 🆘 Support

If you encounter issues not covered in this guide:

1. Check Backend logs: `backend/logs/`
2. Check AutoX.js logs on device
3. Review GitHub Issues: https://github.com/exe-blue/aifarm/issues
4. Refer to `docs/AUTOX_SETUP.md` for detailed setup
