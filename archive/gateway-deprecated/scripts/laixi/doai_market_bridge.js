/**
 * DoAi.ME Market Bridge v4.0
 * 
 * 아키텍처:
 * - Node (노드) = PC (이 Bridge가 실행되는 컴퓨터)
 * - Device (디바이스) = 스마트폰 (ADB/Laixi로 연결된 기기)
 * 
 * 기능:
 * 1. 로컬 디바이스(스마트폰) 상태 수집 및 보고
 * 2. 영상 시청 명령 수신 및 실행
 * 3. 시청 진행 상황 실시간 보고
 * 4. Laixi 끊김/디바이스 오프라인 복구
 * 
 * @author Axon (Tech Lead)
 * @version 4.0.0
 */

const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// SDK 로드
const laixiSDKPath = path.join(__dirname, '../../../sdk/laixi_wsapi_test/Node/node/laixi');
let laixi;
try {
  laixi = require(laixiSDKPath);
  console.log('[INFO] Laixi SDK loaded successfully');
} catch (e) {
  console.warn('[WARN] Laixi SDK not found, using built-in commands');
  laixi = null;
}

// ============================================
// 설정
// ============================================

const CONFIG = {
  WS_PORT: parseInt(process.env.DOAI_WS_PORT || '8080'),
  LAIXI_WS_URL: process.env.LAIXI_WS_URL || 'ws://127.0.0.1:22221',
  
  // 타이밍
  REPORT_INTERVAL: 5000,          // 5초마다 상태 브로드캐스트
  HEALTH_CHECK_INTERVAL: 30000,   // 30초마다 헬스체크
  DEVICE_TIMEOUT: 60000,          // 60초 응답 없으면 오프라인
  
  // 재연결
  RECONNECT_DELAY: 3000,
  MAX_RECONNECT_ATTEMPTS: 10,
  
  // 디바이스 복구
  MAX_RECOVERY_ATTEMPTS: 3,
  RECOVERY_DELAY: 5000,
  
  // 보상
  REWARD_PER_VIEW: 100,
};

// ============================================
// Node(PC) 정보 생성
// ============================================

function generateNodeId() {
  const networkInterfaces = os.networkInterfaces();
  let macAddress = '';
  
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    if (name.startsWith('lo')) continue;
    const iface = interfaces.find(i => !i.internal && i.mac !== '00:00:00:00:00:00');
    if (iface) {
      macAddress = iface.mac;
      break;
    }
  }
  
  const seed = macAddress || os.hostname() + Date.now();
  return 'node_' + crypto.createHash('md5').update(seed).digest('hex').slice(0, 8);
}

function getLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const [, interfaces] of Object.entries(networkInterfaces)) {
    const iface = interfaces.find(i => !i.internal && i.family === 'IPv4');
    if (iface) return iface.address;
  }
  return '127.0.0.1';
}

// ============================================
// 상태 관리
// ============================================

const state = {
  // 노드(PC) 정보
  node: {
    id: generateNodeId(),
    hostname: os.hostname(),
    platform: os.platform(),
    ipAddress: getLocalIpAddress(),
    status: 'online',
    deviceCount: 0,
    onlineDeviceCount: 0,
    laixiConnected: false,
    lastSeen: new Date().toISOString(),
    reconnectAttempts: 0,
  },
  
  // 디바이스(스마트폰) 목록
  devices: new Map(),
  
  // 실행 중인 작업
  runningTasks: new Map(),
  
  // WebSocket
  wss: null,
  clients: new Set(),
  laixiWs: null,
  
  // 재연결
  reconnectAttempts: 0,
  reconnectTimer: null,
  
  // 통계
  stats: {
    totalViews: 0,
    totalRewards: 0,
    totalErrors: 0,
  },
};

// ============================================
// 로깅
// ============================================

const LOG_LEVELS = {
  debug: { color: '\x1b[90m', label: 'DEBUG' },
  info: { color: '\x1b[36m', label: 'INFO' },
  success: { color: '\x1b[32m', label: 'SUCCESS' },
  warn: { color: '\x1b[33m', label: 'WARN' },
  error: { color: '\x1b[31m', label: 'ERROR' },
};

function log(level, message, data = null) {
  const config = LOG_LEVELS[level] || LOG_LEVELS.info;
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${config.color}[${timestamp}] [${config.label}]\x1b[0m ${message}${dataStr}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateDeviceId(serial) {
  return 'device_' + crypto.createHash('md5').update(serial).digest('hex').slice(0, 8);
}

// ============================================
// Laixi 명령어
// ============================================

const LaixiCommands = {
  toast(message, deviceIds = 'all') {
    return JSON.stringify({
      action: 'Toast',
      comm: { deviceIds, text: message }
    });
  },

  adb(command, deviceIds = 'all') {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command }
    });
  },

  openYouTubeVideo(videoUrl, deviceIds = 'all') {
    return JSON.stringify({
      action: 'ADB',
      comm: {
        deviceIds,
        command: `adb shell am start -a android.intent.action.VIEW -d "${videoUrl}" com.google.android.youtube`
      }
    });
  },
  
  screenOn(deviceIds = 'all') {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command: 'adb shell input keyevent 224' }
    });
  },
  
  pressHome(deviceIds = 'all') {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command: 'adb shell input keyevent 3' }
    });
  },
  
  swipe(deviceIds, x1, y1, x2, y2, duration = 300) {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command: `adb shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}` }
    });
  },
  
  tap(deviceIds, x, y) {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command: `adb shell input tap ${x} ${y}` }
    });
  },

  runScript(scriptContent, deviceIds = 'all') {
    return JSON.stringify({
      action: 'RunScript',
      comm: { deviceIds, script: scriptContent }
    });
  },
};

// ============================================
// Laixi 연결 관리
// ============================================

function connectToLaixi() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  
  log('info', `Laixi 연결 중: ${CONFIG.LAIXI_WS_URL}...`);
  
  try {
    state.laixiWs = new WebSocket(CONFIG.LAIXI_WS_URL);
    
    state.laixiWs.on('open', () => {
      log('success', '✓ Laixi 연결 성공');
      state.reconnectAttempts = 0;
      state.node.laixiConnected = true;
      state.node.status = 'online';
      state.node.reconnectAttempts = 0;
      
      // 클라이언트에 알림
      broadcastToClients({
        type: 'LAIXI_CONNECTED',
        nodeId: state.node.id,
      });
      
      // 토스트로 연결 알림
      sendToLaixi(LaixiCommands.toast('DoAi.ME 연결됨 ✓', 'all'));
      
      // 디바이스 탐색
      discoverDevices();
    });
    
    state.laixiWs.on('message', (data) => {
      try {
        const dataStr = data.toString();
        try {
          const message = JSON.parse(dataStr);
          handleLaixiMessage(message);
        } catch (e) {
          handleLaixiTextMessage(dataStr);
        }
      } catch (error) {
        log('error', 'Laixi 메시지 처리 오류', error.message);
      }
    });
    
    state.laixiWs.on('close', (code, reason) => {
      log('warn', `Laixi 연결 끊김 (code: ${code})`);
      handleLaixiDisconnect();
    });
    
    state.laixiWs.on('error', (error) => {
      log('error', 'Laixi 연결 오류', error.message);
    });
    
  } catch (error) {
    log('error', 'Laixi 연결 실패', error.message);
    handleLaixiDisconnect();
  }
}

function handleLaixiDisconnect() {
  state.node.laixiConnected = false;
  
  // 모든 디바이스 오프라인 처리
  state.devices.forEach((device, id) => {
    device.status = 'offline';
    device.currentTask = null;
  });
  
  // 클라이언트에 알림
  broadcastToClients({
    type: 'LAIXI_DISCONNECTED',
    nodeId: state.node.id,
  });
  
  broadcastState();
  
  // 재연결 시도
  scheduleLaixiReconnect();
}

function scheduleLaixiReconnect() {
  if (state.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
    log('error', `최대 재연결 시도 (${CONFIG.MAX_RECONNECT_ATTEMPTS}) 초과`);
    state.node.status = 'offline';
    broadcastToClients({
      type: 'LAIXI_RECONNECT_FAILED',
      nodeId: state.node.id,
      message: '최대 재연결 시도 초과',
    });
    return;
  }
  
  state.reconnectAttempts++;
  state.node.reconnectAttempts = state.reconnectAttempts;
  
  log('info', `${CONFIG.RECONNECT_DELAY / 1000}초 후 재연결 (${state.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})`);
  
  // 클라이언트에 재연결 시도 알림
  broadcastToClients({
    type: 'LAIXI_RECONNECTING',
    nodeId: state.node.id,
    attempt: state.reconnectAttempts,
  });
  
  state.reconnectTimer = setTimeout(connectToLaixi, CONFIG.RECONNECT_DELAY);
}

function sendToLaixi(command) {
  if (state.laixiWs && state.laixiWs.readyState === WebSocket.OPEN) {
    state.laixiWs.send(command);
    return true;
  }
  log('warn', 'Laixi 연결 안됨');
  return false;
}

// ============================================
// 디바이스 관리
// ============================================

function discoverDevices() {
  log('info', 'ADB로 디바이스 탐색 중...');
  sendToLaixi(LaixiCommands.adb('adb devices -l', 'all'));
}

function handleDeviceList(rawDevices) {
  if (!Array.isArray(rawDevices)) return;
  
  log('info', `${rawDevices.length}개 디바이스 처리 중...`);
  
  const TRAITS = ['Analytic', 'Emotional', 'Cynical', 'Fast', 'Observer', 'Poetic'];
  let newCount = 0;
  let updateCount = 0;
  
  rawDevices.forEach((rawDevice, index) => {
    const serial = rawDevice.serial || rawDevice.id || `unknown_${index}`;
    const deviceId = generateDeviceId(serial);
    
    const existingDevice = state.devices.get(deviceId);
    const isNew = !existingDevice;
    
    let displayName = rawDevice.model || '';
    if (!displayName || displayName === 'Unknown') {
      displayName = `Galaxy S9+ #${String(state.devices.size + 1).padStart(2, '0')}`;
    }
    
    const isOnline = rawDevice.adbStatus === 'device' || rawDevice.online;
    
    const device = {
      id: deviceId,
      serial: serial,
      name: displayName,
      model: rawDevice.model || 'SM-G965U1',
      status: isOnline ? 'idle' : 'offline',
      wallet: existingDevice?.wallet || Math.floor(Math.random() * 1000),
      currentTask: existingDevice?.currentTask || null,
      lastSeen: new Date().toISOString(),
      traits: existingDevice?.traits || [TRAITS[index % TRAITS.length]],
      nodeId: state.node.id,
      errorMessage: null,
      recoveryAttempts: existingDevice?.recoveryAttempts || 0,
    };
    
    state.devices.set(deviceId, device);
    
    if (isNew) newCount++;
    else updateCount++;
  });
  
  // 노드 상태 업데이트
  updateNodeDeviceCount();
  
  if (newCount > 0) {
    log('success', `✓ ${newCount}개 새 디바이스 등록`);
  }
  if (updateCount > 0) {
    log('info', `${updateCount}개 디바이스 업데이트`);
  }
  
  broadcastState();
}

function updateNodeDeviceCount() {
  const deviceArray = Array.from(state.devices.values());
  state.node.deviceCount = deviceArray.length;
  state.node.onlineDeviceCount = deviceArray.filter(d => d.status !== 'offline').length;
  state.node.lastSeen = new Date().toISOString();
}

// ============================================
// 디바이스 복구 로직
// ============================================

async function attemptDeviceRecovery(deviceId) {
  const device = state.devices.get(deviceId);
  if (!device) return false;
  
  if (device.recoveryAttempts >= CONFIG.MAX_RECOVERY_ATTEMPTS) {
    log('error', `디바이스 복구 실패 (최대 시도 초과): ${device.name}`);
    device.status = 'error';
    device.errorMessage = '복구 실패';
    broadcastToClients({
      type: 'DEVICE_ERROR',
      deviceId: device.id,
      error: '복구 실패 (최대 시도 초과)',
    });
    return false;
  }
  
  device.recoveryAttempts++;
  log('info', `디바이스 복구 시도 (${device.recoveryAttempts}/${CONFIG.MAX_RECOVERY_ATTEMPTS}): ${device.name}`);
  
  // 화면 켜기 시도
  sendToLaixi(LaixiCommands.screenOn(device.serial));
  await sleep(1000);
  
  // 홈 버튼 누르기
  sendToLaixi(LaixiCommands.pressHome(device.serial));
  await sleep(1000);
  
  // ADB 연결 확인
  sendToLaixi(LaixiCommands.adb(`adb -s ${device.serial} shell echo "recovery_test"`, device.serial));
  
  await sleep(CONFIG.RECOVERY_DELAY);
  
  // 디바이스 다시 탐색하여 상태 확인
  discoverDevices();
  
  return true;
}

// ============================================
// Laixi 메시지 처리
// ============================================

function handleLaixiMessage(message) {
  if (message.StatusCode !== undefined) {
    handleLaixiApiResponse(message);
    return;
  }
  
  const type = message.type || message.action || message.event;
  
  switch (type) {
    case 'DeviceList':
    case 'devices':
      handleDeviceList(message.devices || message.data || []);
      break;
      
    case 'DeviceStatus':
    case 'status':
      handleDeviceStatus(message);
      break;
      
    case 'TaskResult':
    case 'ScriptResult':
    case 'result':
      handleTaskResult(message);
      break;
      
    default:
      log('debug', `알 수 없는 Laixi 메시지: ${type}`);
  }
}

function handleLaixiApiResponse(response) {
  if (response.StatusCode !== 200) {
    log('error', `Laixi API 오류: StatusCode ${response.StatusCode}`);
    return;
  }
  
  let result;
  try {
    result = typeof response.result === 'string' 
      ? JSON.parse(response.result) 
      : response.result;
  } catch (e) {
    result = response.result;
  }
  
  if (Array.isArray(result)) {
    handleDeviceResults(result);
  } else if (typeof result === 'object' && result !== null) {
    handleAdbResults(result);
  }
}

function handleDeviceResults(results) {
  const errors = results.filter(r => !r.success);
  const success = results.filter(r => r.success);
  
  if (errors.length > 0) {
    const firstError = errors[0].errmsg || '';
    
    if (firstError.includes('来喜APP') || firstError.includes('最新版本')) {
      log('warn', `⚠️ ${errors.length}개 기기에서 Laixi 앱 업데이트 필요`);
      const deviceIds = results.map(r => r.deviceid);
      registerDevicesFromIds(deviceIds);
    } else {
      errors.forEach(r => {
        const deviceId = generateDeviceId(r.deviceid);
        const device = state.devices.get(deviceId);
        if (device) {
          device.status = 'error';
          device.errorMessage = r.errmsg;
          
          broadcastToClients({
            type: 'DEVICE_ERROR',
            deviceId: device.id,
            error: r.errmsg,
          });
          
          // 복구 시도
          attemptDeviceRecovery(device.id);
        }
      });
    }
  }
  
  if (success.length > 0) {
    log('success', `✓ ${success.length}개 기기 명령 성공`);
    
    success.forEach(r => {
      const deviceId = generateDeviceId(r.deviceid);
      const device = state.devices.get(deviceId);
      if (device) {
        // 이전에 에러 상태였다면 복구 알림
        if (device.status === 'error') {
          device.recoveryAttempts = 0;
          device.errorMessage = null;
          broadcastToClients({
            type: 'DEVICE_RECOVERED',
            deviceId: device.id,
          });
        }
        device.status = device.currentTask ? 'busy' : 'idle';
        device.lastSeen = new Date().toISOString();
      }
    });
    
    updateNodeDeviceCount();
    broadcastState();
  }
}

function handleAdbResults(results) {
  const deviceSerials = Object.keys(results);
  
  if (deviceSerials.length === 0) {
    log('warn', 'ADB 결과에 디바이스 없음');
    return;
  }
  
  const firstSerial = deviceSerials[0];
  const lines = results[firstSerial];
  
  if (Array.isArray(lines) && lines.some(l => l.includes('List of devices attached'))) {
    const devices = parseAdbDevicesOutput(lines);
    if (devices.length > 0) {
      log('success', `✓ ADB로 ${devices.length}개 디바이스 발견`);
      handleDeviceList(devices);
    }
  }
}

function parseAdbDevicesOutput(lines) {
  const devices = [];
  
  lines.forEach(line => {
    const match = line.match(/^(\S+)\s+(device|offline|unauthorized)\s+(.*)$/);
    
    if (match) {
      const [, serial, status, info] = match;
      const modelMatch = info.match(/model:(\S+)/);
      const productMatch = info.match(/product:(\S+)/);
      
      devices.push({
        serial: serial,
        adbStatus: status,
        model: modelMatch ? modelMatch[1].replace(/_/g, ' ') : 'Unknown',
        product: productMatch ? productMatch[1] : '',
        online: status === 'device',
      });
    }
  });
  
  return devices;
}

function registerDevicesFromIds(serials) {
  const devices = serials.map(serial => ({
    serial: serial,
    adbStatus: 'device',
    model: 'SM-G965U1',
    online: true,
  }));
  
  handleDeviceList(devices);
}

function handleLaixiTextMessage(text) {
  if (text.includes('List of devices attached') || text.includes('device:')) {
    const lines = text.split('\n').filter(line => line.trim());
    const devices = [];
    
    lines.forEach(line => {
      const match = line.match(/^([^\s]+)\s+(device|offline|unauthorized)/);
      if (match) {
        devices.push({
          serial: match[1],
          adbStatus: match[2],
        });
      }
    });
    
    if (devices.length > 0) {
      handleDeviceList(devices);
    }
  }
}

function handleDeviceStatus(message) {
  const { deviceId, serial, status, currentTask } = message;
  const id = deviceId || (serial ? generateDeviceId(serial) : null);
  
  if (!id) return;
  
  const device = state.devices.get(id);
  if (device) {
    device.status = status || device.status;
    device.currentTask = currentTask || null;
    device.lastSeen = new Date().toISOString();
    
    broadcastToClients({
      type: 'DEVICE_STATUS',
      deviceId: device.id,
      status: device.status,
      currentTask: device.currentTask,
    });
  }
}

function handleTaskResult(message) {
  const { deviceId, serial, videoId, success, watchedSeconds, liked, error } = message;
  const id = deviceId || (serial ? generateDeviceId(serial) : null);
  
  log(success ? 'success' : 'error', 
    `작업 결과 [${id}]: ${success ? '성공' : '실패'}`, 
    { videoId, watchedSeconds, error }
  );
  
  if (success) {
    state.stats.totalViews++;
    state.stats.totalRewards += CONFIG.REWARD_PER_VIEW;
    
    const device = state.devices.get(id);
    if (device) {
      device.wallet += CONFIG.REWARD_PER_VIEW;
      device.status = 'idle';
      device.currentTask = null;
    }
  } else {
    state.stats.totalErrors++;
    
    const device = state.devices.get(id);
    if (device) {
      device.status = 'error';
      device.currentTask = null;
      device.errorMessage = error;
      
      // 복구 시도
      attemptDeviceRecovery(device.id);
    }
  }
  
  const taskKey = `${id}_${videoId}`;
  state.runningTasks.delete(taskKey);
  
  broadcastToClients({
    type: 'VIDEO_PROGRESS',
    videoId,
    deviceId: id,
    nodeId: state.node.id,
    success,
    watchedSeconds,
    liked,
    error,
  });
  
  updateNodeDeviceCount();
  broadcastState();
}

// ============================================
// 영상 시청 명령
// ============================================

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sendWatchCommand(deviceId, video, options = {}) {
  const device = state.devices.get(deviceId);
  if (!device) {
    log('error', `디바이스 없음: ${deviceId}`);
    return false;
  }
  
  if (device.status === 'offline' || device.status === 'error') {
    log('warn', `디바이스 사용 불가: ${device.name} (${device.status})`);
    return false;
  }
  
  if (!state.laixiWs || state.laixiWs.readyState !== WebSocket.OPEN) {
    log('error', 'Laixi 연결 안됨');
    return false;
  }
  
  const taskKey = `${deviceId}_${video.id}`;
  if (state.runningTasks.has(taskKey)) {
    log('debug', `이미 실행 중: ${taskKey}`);
    return false;
  }
  
  device.status = 'busy';
  device.currentTask = { videoId: video.id, title: video.title };
  
  const watchDuration = randomBetween(
    options.minWatchSeconds || 30,
    options.maxWatchSeconds || 120
  );
  
  state.runningTasks.set(taskKey, {
    video,
    deviceId,
    startTime: Date.now(),
    watchDuration,
    options,
  });
  
  executeWatchSequence(device, video, watchDuration, options);
  
  return true;
}

async function executeWatchSequence(device, video, watchDuration, options) {
  const serial = device.serial;
  const taskKey = `${device.id}_${video.id}`;
  
  log('info', `▶ [${device.name}] 시청 시작: "${video.title}" (${watchDuration}초)`);
  
  // 1. 화면 켜기
  sendToLaixi(LaixiCommands.screenOn(serial));
  await sleep(500);
  
  // 2. YouTube 앱으로 영상 열기
  const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  sendToLaixi(LaixiCommands.openYouTubeVideo(videoUrl, serial));
  
  // 3. 영상 로드 대기
  await sleep(randomBetween(4000, 7000));
  
  // 4. 진행 상황 보고
  const progressInterval = setInterval(() => {
    const task = state.runningTasks.get(taskKey);
    if (!task) {
      clearInterval(progressInterval);
      return;
    }
    
    const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
    broadcastToClients({
      type: 'WATCH_PROGRESS',
      deviceId: device.id,
      videoId: video.id,
      elapsed,
      total: watchDuration,
      progress: Math.min(100, Math.round((elapsed / watchDuration) * 100)),
    });
  }, 10000);
  
  // 5. 시청 대기
  const watchStartTime = Date.now();
  
  while (Date.now() - watchStartTime < watchDuration * 1000) {
    const action = Math.random();
    
    if (action < 0.1) {
      sendToLaixi(LaixiCommands.swipe(serial, 500, 1500, 500, 800, 500));
    } else if (action < 0.15) {
      sendToLaixi(LaixiCommands.tap(serial, 900, 300));
    }
    
    await sleep(randomBetween(5000, 15000));
  }
  
  clearInterval(progressInterval);
  
  // 6. 좋아요 (옵션)
  let liked = false;
  if (options.like && Math.random() < 0.8) {
    sendToLaixi(LaixiCommands.tap(serial, 140, 1120));
    await sleep(500);
    liked = true;
  }
  
  // 7. 완료 처리
  handleTaskResult({
    deviceId: device.id,
    videoId: video.id,
    success: true,
    watchedSeconds: watchDuration,
    liked,
  });
  
  // 8. 홈으로 이동
  sendToLaixi(LaixiCommands.pressHome(serial));
  
  log('success', `✓ [${device.name}] 시청 완료: "${video.title}"`);
}

function distributeVideo(video, targetViews, options = {}) {
  const availableDevices = Array.from(state.devices.values())
    .filter(d => d.status === 'idle');
  
  if (availableDevices.length === 0) {
    log('warn', '사용 가능한 디바이스 없음');
    broadcastToClients({
      type: 'DISTRIBUTION_FAILED',
      videoId: video.id,
      reason: '활성화된 디바이스가 없습니다',
    });
    return 0;
  }
  
  const devicesToUse = Math.min(targetViews, availableDevices.length);
  const selectedDevices = availableDevices.slice(0, devicesToUse);
  
  log('info', `📺 영상 배분: "${video.title}" → ${devicesToUse}개 디바이스`);
  
  let successCount = 0;
  selectedDevices.forEach(device => {
    if (sendWatchCommand(device.id, video, options)) {
      successCount++;
    }
  });
  
  broadcastToClients({
    type: 'VIDEO_DISTRIBUTED',
    videoId: video.id,
    distributedCount: successCount,
    totalDevices: devicesToUse,
  });
  
  return successCount;
}

// ============================================
// WebSocket 서버
// ============================================

function startWebSocketServer() {
  state.wss = new WebSocket.Server({ port: CONFIG.WS_PORT });
  
  log('info', `WebSocket 서버 시작: 포트 ${CONFIG.WS_PORT}`);
  
  state.wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log('info', `클라이언트 연결: ${clientIp}`);
    
    state.clients.add(ws);
    
    // 초기 상태 전송
    ws.send(JSON.stringify({
      type: 'INIT',
      node: state.node,
      devices: Array.from(state.devices.values()),
      stats: state.stats,
      laixiConnected: state.node.laixiConnected,
    }));
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch (e) {
        log('error', '클라이언트 메시지 오류', e.message);
      }
    });
    
    ws.on('close', () => {
      log('info', `클라이언트 연결 해제: ${clientIp}`);
      state.clients.delete(ws);
    });
    
    ws.on('error', (error) => {
      log('error', '클라이언트 WebSocket 오류', error.message);
      state.clients.delete(ws);
    });
  });
}

function handleClientMessage(ws, message) {
  const action = message.type || message.action;
  
  switch (action) {
    case 'GET_STATE':
      ws.send(JSON.stringify({
        type: 'STATE_UPDATE',
        node: state.node,
        devices: Array.from(state.devices.values()),
        stats: state.stats,
      }));
      break;
      
    case 'INJECT_VIDEO':
    case 'WATCH_VIDEO': {
      const { video, targetViews = 1, options = {} } = message;
      if (!video) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Video data required' }));
        return;
      }
      
      const count = distributeVideo(video, targetViews, options);
      ws.send(JSON.stringify({
        type: 'INJECT_RESULT',
        success: count > 0,
        distributedCount: count,
        reason: count === 0 ? '활성 디바이스 없음' : null,
      }));
      break;
    }
      
    case 'SEND_COMMAND': {
      const { deviceId, command, params } = message;
      handleDeviceCommand(deviceId, command, params);
      break;
    }
      
    case 'REFRESH_DEVICES':
      discoverDevices();
      break;
      
    case 'TOAST': {
      const { text, deviceIds = 'all' } = message;
      sendToLaixi(LaixiCommands.toast(text, deviceIds));
      break;
    }
      
    case 'RECOVER_DEVICE': {
      const { deviceId } = message;
      attemptDeviceRecovery(deviceId);
      break;
    }
      
    default:
      log('debug', `알 수 없는 클라이언트 액션: ${action}`);
  }
}

function handleDeviceCommand(deviceId, command, params = {}) {
  const device = state.devices.get(deviceId);
  if (!device && deviceId !== 'all') {
    log('error', `디바이스 없음: ${deviceId}`);
    return;
  }
  
  const serial = device?.serial || 'all';
  
  switch (command) {
    case 'screen_on':
      sendToLaixi(LaixiCommands.screenOn(serial));
      break;
    case 'home':
      sendToLaixi(LaixiCommands.pressHome(serial));
      break;
    case 'tap':
      sendToLaixi(LaixiCommands.tap(serial, params.x || 500, params.y || 500));
      break;
    case 'swipe':
      sendToLaixi(LaixiCommands.swipe(serial, 
        params.x1 || 500, params.y1 || 1500, 
        params.x2 || 500, params.y2 || 500, 
        params.duration || 300));
      break;
    case 'adb':
      sendToLaixi(LaixiCommands.adb(params.command, serial));
      break;
    default:
      log('warn', `알 수 없는 명령: ${command}`);
  }
}

function broadcastToClients(message) {
  const data = JSON.stringify(message);
  state.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastState() {
  broadcastToClients({
    type: 'STATE_UPDATE',
    node: state.node,
    devices: Array.from(state.devices.values()),
    stats: state.stats,
  });
}

// ============================================
// 주기적 작업
// ============================================

function startPeriodicTasks() {
  // 상태 브로드캐스트 + 디바이스 갱신
  setInterval(() => {
    state.node.lastSeen = new Date().toISOString();
    
    if (state.node.laixiConnected) {
      discoverDevices();
    }
    
    broadcastState();
  }, CONFIG.REPORT_INTERVAL);
  
  // 헬스체크
  setInterval(() => {
    const now = Date.now();
    let offlineCount = 0;
    
    state.devices.forEach((device) => {
      const lastSeen = new Date(device.lastSeen).getTime();
      if (now - lastSeen > CONFIG.DEVICE_TIMEOUT && device.status !== 'offline') {
        device.status = 'offline';
        device.currentTask = null;
        offlineCount++;
        
        log('warn', `디바이스 타임아웃: ${device.name}`);
        
        broadcastToClients({
          type: 'DEVICE_STATUS',
          deviceId: device.id,
          status: 'offline',
          currentTask: null,
        });
      }
    });
    
    if (offlineCount > 0) {
      log('warn', `${offlineCount}개 디바이스 오프라인`);
      updateNodeDeviceCount();
      broadcastState();
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL);
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           DoAi.ME Market Bridge v4.0                      ║');
  console.log('║   Node(PC) + Device(Smartphone) + Recovery                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  log('info', `Node ID: ${state.node.id}`);
  log('info', `Hostname: ${state.node.hostname}`);
  log('info', `IP Address: ${state.node.ipAddress}`);
  log('info', `Platform: ${state.node.platform}`);
  console.log('');
  
  // 1. WebSocket 서버 시작
  startWebSocketServer();
  
  // 2. Laixi 연결
  connectToLaixi();
  
  // 3. 주기적 작업 시작
  startPeriodicTasks();
  
  log('success', '✓ Bridge 시작 완료');
  log('info', `Market 연결: ws://localhost:${CONFIG.WS_PORT}`);
  log('info', `Laixi 연결: ${CONFIG.LAIXI_WS_URL}`);
}

// 프로세스 종료 핸들링
process.on('SIGINT', () => {
  log('info', '종료 중...');
  
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
  }
  if (state.wss) {
    state.wss.close();
  }
  if (state.laixiWs) {
    state.laixiWs.close();
  }
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', error.message);
  console.error(error.stack);
});

main();
