/**
 * DoAi.Me Connection Establishment Protocol v1.0
 * 
 * 최초 접속 무결성 검증 및 소켓 성립 명령
 * 
 * 목적:
 * 1. Laixi WebSocket 연결 성립
 * 2. 연결된 디바이스 무결성 검증
 * 3. 폰보드 환경 초기화 (Doze 해제, 화면 유지 등)
 * 4. 지속적인 Heartbeat 루프 실행
 * 
 * 실행 방법:
 * - BAT: start_establish.bat
 * - 직접: node establish_connection.js [--verify-only] [--init-only]
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const os = require('os');
const crypto = require('crypto');

// ============================================
// 설정
// ============================================

const CONFIG = {
  // Laixi 연결
  LAIXI_WS_URL: process.env.LAIXI_WS_URL || 'ws://127.0.0.1:22221',
  
  // 타이밍
  CONNECT_TIMEOUT: 10000,     // 연결 타임아웃 10초
  COMMAND_TIMEOUT: 5000,      // 명령 타임아웃 5초
  HEARTBEAT_INTERVAL: 5000,   // Heartbeat 5초
  VERIFY_DELAY: 1000,         // 검증 사이 대기
  
  // ping/pong (TCP Half-Open 감지용)
  PING_INTERVAL: 10000,       // 10초마다 ping
  PING_TIMEOUT: 5000,         // 5초 내 pong 없으면 끊김 처리
  
  // 재연결 (Exponential Backoff)
  RECONNECT_BASE_DELAY: 3000, // 초기 재연결 대기 3초
  RECONNECT_MAX_DELAY: 60000, // 최대 재연결 대기 60초
  RECONNECT_MULTIPLIER: 2,    // 대기 시간 배율
  MAX_RECONNECT_ATTEMPTS: 10, // 최대 재연결 시도
  
  // 검증
  VALIDATION_TIMEOUT: 30000,  // 전체 검증 타임아웃 30초
  MIN_DEVICES_REQUIRED: 1,    // 최소 필요 디바이스 수
  
  // 폰보드 초기화 명령
  INIT_COMMANDS: [
    { name: 'Doze 비활성화', cmd: 'dumpsys deviceidle disable' },
    { name: '화면 항상 켜짐', cmd: 'settings put global stay_on_while_plugged_in 3' },
    { name: '화면 밝기 최소', cmd: 'settings put system screen_brightness 10' },
    { name: 'WiFi 절전 끄기', cmd: 'settings put global wifi_sleep_policy 2' },
    { name: '잠금 해제', cmd: 'input keyevent 82' },
    { name: '화면 켜기', cmd: 'input keyevent 224' },
  ],
};

// ============================================
// 상태
// ============================================

const state = {
  ws: null,
  nodeId: null,
  connected: false,
  devices: new Map(),
  verifiedDevices: new Set(),
  initializedDevices: new Set(),
  reconnectAttempts: 0,
  currentReconnectDelay: CONFIG.RECONNECT_BASE_DELAY, // Exponential Backoff용
  heartbeatTimer: null,
  pingTimer: null,           // ping/pong 타이머
  pongTimeout: null,         // pong 응답 타임아웃
  awaitingPong: false,       // pong 대기 상태
  pendingRequests: new Map(),
  requestCounter: 0,
  commandLock: false,        // 명령 직렬화용 락
  commandQueue: [],          // 명령 큐
  stats: {
    connectTime: null,
    discoverTime: null,
    validateTime: null,
    initializeTime: null,
    totalDevices: 0,
    verifiedDevices: 0,
    initializedDevices: 0,
    errors: [],
    pingCount: 0,
    pongCount: 0,
    missedPongs: 0,
  },
};

// ============================================
// 유틸리티
// ============================================

const LOG_COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  const colors = {
    info: LOG_COLORS.cyan,
    success: LOG_COLORS.green,
    warn: LOG_COLORS.yellow,
    error: LOG_COLORS.red,
    debug: LOG_COLORS.gray,
  };
  const color = colors[level] || LOG_COLORS.reset;
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌',
    debug: '🔍',
  };
  
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${color}[${timestamp}] ${prefix[level] || '•'} ${message}${dataStr}${LOG_COLORS.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateNodeId() {
  const seed = os.hostname() + Date.now();
  return 'node_' + crypto.createHash('md5').update(seed).digest('hex').slice(0, 8);
}

// ============================================
// Laixi 명령 빌더
// ============================================

const LaixiCommands = {
  // 디바이스 목록 조회
  list() {
    return JSON.stringify({ action: 'list' });
  },
  
  // Toast 메시지
  toast(message, deviceIds = 'all') {
    return JSON.stringify({
      action: 'Toast',
      comm: { deviceIds, content: message }
    });
  },
  
  // ADB 명령
  adb(command, deviceIds = 'all') {
    return JSON.stringify({
      action: 'ADB',
      comm: { deviceIds, command: `adb shell ${command}` }
    });
  },
  
  // 화면 켜기 (BasisOperate type=15)
  screenOn(deviceIds = 'all') {
    return JSON.stringify({
      action: 'BasisOperate',
      comm: { deviceIds, type: '15' }
    });
  },
  
  // 홈 버튼 (BasisOperate type=4)
  pressHome(deviceIds = 'all') {
    return JSON.stringify({
      action: 'BasisOperate',
      comm: { deviceIds, type: '4' }
    });
  },
  
  // 현재 앱 정보
  currentApp(deviceIds = 'all') {
    return JSON.stringify({
      action: 'CurrentAppInfo',
      comm: { deviceIds }
    });
  },
};

// ============================================
// Phase 1: CONNECT - Laixi WebSocket 연결
// ============================================

/**
 * 이전 WebSocket 연결 정리
 * - 이벤트 리스너 제거 (메모리 누수 방지)
 * - 타이머 정리
 */
function cleanupPreviousConnection() {
  // ping/pong 타이머 정리
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  if (state.pongTimeout) {
    clearTimeout(state.pongTimeout);
    state.pongTimeout = null;
  }
  state.awaitingPong = false;
  
  // 기존 WebSocket 리스너 제거
  if (state.ws) {
    state.ws.removeAllListeners();
    
    // 연결이 열려있으면 닫기
    if (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING) {
      try {
        state.ws.terminate();
      } catch (e) {
        // 무시
      }
    }
    state.ws = null;
  }
  
  log('debug', '이전 연결 리소스 정리 완료');
}

/**
 * ping/pong 시작 (TCP Half-Open 감지)
 */
function startPingPong() {
  // 기존 타이머 정리
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
  }
  
  state.pingTimer = setInterval(() => {
    if (!state.connected || !state.ws) {
      return;
    }
    
    // 이미 pong 대기 중인데 새 ping을 보내야 하는 상황 = 이전 pong 유실
    if (state.awaitingPong) {
      state.stats.missedPongs++;
      log('warn', `⚠️ Pong 응답 누락 (총 ${state.stats.missedPongs}회)`);
    }
    
    try {
      state.ws.ping();
      state.stats.pingCount++;
      state.awaitingPong = true;
      
      // pong 타임아웃 설정
      state.pongTimeout = setTimeout(() => {
        if (state.awaitingPong) {
          log('error', `❌ TCP Half-Open 감지: ${CONFIG.PING_TIMEOUT}ms 내 pong 응답 없음`);
          state.awaitingPong = false;
          
          // 연결이 죽은 것으로 판단하고 강제 종료
          if (state.ws) {
            state.ws.terminate();
          }
        }
      }, CONFIG.PING_TIMEOUT);
      
    } catch (e) {
      log('error', `ping 전송 실패: ${e.message}`);
    }
    
  }, CONFIG.PING_INTERVAL);
  
  log('debug', `ping/pong 시작 (간격: ${CONFIG.PING_INTERVAL}ms, 타임아웃: ${CONFIG.PING_TIMEOUT}ms)`);
}

async function phaseConnect() {
  log('info', '═══════════════════════════════════════════════════════');
  log('info', 'Phase 1: CONNECT - Laixi WebSocket 연결');
  log('info', '═══════════════════════════════════════════════════════');
  
  // 이전 연결 리소스 정리 (리스너 누적 방지)
  cleanupPreviousConnection();
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    log('info', `연결 시도: ${CONFIG.LAIXI_WS_URL}`);
    
    const ws = new WebSocket(CONFIG.LAIXI_WS_URL);
    
    const timeoutId = setTimeout(() => {
      ws.terminate();
      reject(new Error(`연결 타임아웃 (${CONFIG.CONNECT_TIMEOUT}ms)`));
    }, CONFIG.CONNECT_TIMEOUT);
    
    ws.on('open', () => {
      clearTimeout(timeoutId);
      state.ws = ws;
      state.connected = true;
      state.stats.connectTime = Date.now() - startTime;
      state.nodeId = generateNodeId();
      
      log('success', `연결 성공! (${state.stats.connectTime}ms)`);
      log('info', `Node ID: ${state.nodeId}`);
      
      // 메시지 핸들러 설정
      ws.on('message', handleLaixiMessage);
      ws.on('close', handleLaixiClose);
      ws.on('error', handleLaixiError);
      
      // pong 응답 핸들러 (TCP Half-Open 감지용)
      ws.on('pong', () => {
        state.stats.pongCount++;
        state.awaitingPong = false;
        
        if (state.pongTimeout) {
          clearTimeout(state.pongTimeout);
          state.pongTimeout = null;
        }
      });
      
      // ping/pong 시작
      startPingPong();
      
      resolve(true);
    });
    
    ws.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`연결 실패: ${err.message}`));
    });
  });
}

function handleLaixiMessage(data) {
  try {
    const response = JSON.parse(data.toString());
    
    // 대기 중인 요청에 응답 매칭 (FIFO)
    if (state.pendingRequests.size > 0) {
      const [requestId, pending] = state.pendingRequests.entries().next().value;
      clearTimeout(pending.timer);
      state.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
    
  } catch (e) {
    log('error', 'Laixi 메시지 파싱 실패', e.message);
  }
}

function handleLaixiClose(code, reason) {
  log('warn', `연결 종료 (code=${code})`);
  state.connected = false;
  
  // Heartbeat 중지
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  
  // ping/pong 정리
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  if (state.pongTimeout) {
    clearTimeout(state.pongTimeout);
    state.pongTimeout = null;
  }
  state.awaitingPong = false;
  
  // 재연결 시도 (Exponential Backoff)
  if (state.reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
    state.reconnectAttempts++;
    
    // Exponential Backoff 계산: 3s -> 6s -> 12s -> 24s -> 48s -> 60s(max)
    const delay = Math.min(
      state.currentReconnectDelay,
      CONFIG.RECONNECT_MAX_DELAY
    );
    
    log('info', `재연결 시도 ${state.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS} (${delay}ms 후)...`);
    
    setTimeout(attemptReconnect, delay);
    
    // 다음 재연결 대기 시간 증가
    state.currentReconnectDelay = Math.min(
      state.currentReconnectDelay * CONFIG.RECONNECT_MULTIPLIER,
      CONFIG.RECONNECT_MAX_DELAY
    );
  } else {
    log('error', '최대 재연결 시도 초과');
    process.exit(1);
  }
}

function handleLaixiError(err) {
  log('error', `WebSocket 오류: ${err.message}`);
}

async function attemptReconnect() {
  try {
    await phaseConnect();
    
    // 성공 시 재연결 카운터 및 backoff 리셋
    state.reconnectAttempts = 0;
    state.currentReconnectDelay = CONFIG.RECONNECT_BASE_DELAY;
    
    // 재연결 후 Heartbeat 재시작
    startHeartbeat();
    
    log('success', '재연결 성공! Heartbeat 재시작됨');
    
  } catch (e) {
    log('error', `재연결 실패: ${e.message}`);
    
    if (state.reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
      state.reconnectAttempts++;
      
      // Exponential Backoff 적용
      const delay = Math.min(
        state.currentReconnectDelay,
        CONFIG.RECONNECT_MAX_DELAY
      );
      
      log('info', `다음 재연결 ${state.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS} (${delay}ms 후)...`);
      
      setTimeout(attemptReconnect, delay);
      
      state.currentReconnectDelay = Math.min(
        state.currentReconnectDelay * CONFIG.RECONNECT_MULTIPLIER,
        CONFIG.RECONNECT_MAX_DELAY
      );
    } else {
      log('error', '최대 재연결 시도 초과 - 프로세스 종료');
      process.exit(1);
    }
  }
}

// ============================================
// Laixi 명령 전송 (직렬화로 FIFO 문제 해결)
// ============================================

/**
 * 명령 전송 (직렬화)
 * 
 * Laixi 서버가 requestId를 echo하지 않으므로, 
 * 동시 요청 시 응답 매칭 혼선을 방지하기 위해 명령을 직렬화합니다.
 * 
 * 큐에 명령을 추가하고, 순차적으로 처리합니다.
 */
async function sendCommand(commandJson, timeout = CONFIG.COMMAND_TIMEOUT) {
  if (!state.connected || !state.ws) {
    throw new Error('Laixi 연결되지 않음');
  }
  
  // 큐에 명령 추가하고 처리 대기
  return new Promise((resolve, reject) => {
    state.commandQueue.push({
      commandJson,
      timeout,
      resolve,
      reject,
      enqueuedAt: Date.now(),
    });
    
    // 큐 처리 시작 (락이 없을 때만)
    processCommandQueue();
  });
}

/**
 * 명령 큐 처리기 (직렬화)
 * 
 * 락을 사용하여 한 번에 하나의 명령만 처리합니다.
 * 이로써 FIFO 응답 매칭이 정확하게 동작합니다.
 */
async function processCommandQueue() {
  // 이미 처리 중이면 리턴
  if (state.commandLock) {
    return;
  }
  
  // 큐가 비었으면 리턴
  if (state.commandQueue.length === 0) {
    return;
  }
  
  // 락 획득
  state.commandLock = true;
  
  const { commandJson, timeout, resolve, reject, enqueuedAt } = state.commandQueue.shift();
  
  // 큐 대기 시간 체크 (너무 오래 대기했으면 경고)
  const waitTime = Date.now() - enqueuedAt;
  if (waitTime > 1000) {
    log('warn', `⚠️ 명령 큐 대기 시간: ${waitTime}ms`);
  }
  
  try {
    const result = await executeCommand(commandJson, timeout);
    resolve(result);
  } catch (e) {
    reject(e);
  } finally {
    // 락 해제
    state.commandLock = false;
    
    // 다음 명령 처리
    if (state.commandQueue.length > 0) {
      // 약간의 딜레이를 두어 연속 명령 간 여유 확보
      setTimeout(() => processCommandQueue(), 50);
    }
  }
}

/**
 * 실제 명령 전송 (내부용)
 */
async function executeCommand(commandJson, timeout) {
  if (!state.connected || !state.ws) {
    throw new Error('Laixi 연결되지 않음');
  }
  
  const requestId = ++state.requestCounter;
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pendingRequests.delete(requestId);
      reject(new Error('명령 타임아웃'));
    }, timeout);
    
    state.pendingRequests.set(requestId, { resolve, reject, timer, startTime: Date.now() });
    
    state.ws.send(commandJson);
  });
}

// ============================================
// Phase 2: DISCOVER - 디바이스 목록 조회
// ============================================

async function phaseDiscover() {
  log('info', '');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', 'Phase 2: DISCOVER - 디바이스 목록 조회');
  log('info', '═══════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  
  try {
    // 디바이스 목록 조회
    const response = await sendCommand(LaixiCommands.list());
    
    if (response.StatusCode !== 200) {
      throw new Error(`API 오류: StatusCode ${response.StatusCode}`);
    }
    
    // 결과 파싱
    let devices = [];
    try {
      devices = typeof response.result === 'string' 
        ? JSON.parse(response.result) 
        : response.result || [];
    } catch (e) {
      log('warn', '디바이스 목록 파싱 실패, 빈 배열로 처리');
    }
    
    // 디바이스 등록
    devices.forEach((device, index) => {
      const serial = device.deviceId || device.id || `device_${index}`;
      state.devices.set(serial, {
        serial,
        no: device.no || index,
        name: device.name || `Device #${index + 1}`,
        isOtg: device.isOtg || false,
        status: 'discovered',
        verified: false,
        initialized: false,
        lastSeen: new Date().toISOString(),
      });
    });
    
    state.stats.discoverTime = Date.now() - startTime;
    state.stats.totalDevices = state.devices.size;
    
    log('success', `${state.devices.size}개 디바이스 발견 (${state.stats.discoverTime}ms)`);
    
    // 디바이스 목록 출력
    state.devices.forEach((device, serial) => {
      log('info', `  📱 [${device.no}] ${serial} - ${device.name}${device.isOtg ? ' (OTG)' : ''}`);
    });
    
    if (state.devices.size < CONFIG.MIN_DEVICES_REQUIRED) {
      throw new Error(`최소 ${CONFIG.MIN_DEVICES_REQUIRED}개 디바이스 필요 (현재: ${state.devices.size})`);
    }
    
    return state.devices.size;
    
  } catch (e) {
    log('error', `디바이스 조회 실패: ${e.message}`);
    state.stats.errors.push({ phase: 'discover', error: e.message });
    throw e;
  }
}

// ============================================
// Phase 3: VALIDATE - 디바이스 무결성 검증
// ============================================

async function phaseValidate() {
  log('info', '');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', 'Phase 3: VALIDATE - 디바이스 무결성 검증');
  log('info', '═══════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  const serials = Array.from(state.devices.keys());
  
  log('info', `${serials.length}개 디바이스 검증 시작...`);
  
  for (const serial of serials) {
    const device = state.devices.get(serial);
    
    try {
      log('debug', `  검증 중: ${serial}`);
      
      // 1. 화면 켜기 시도
      await sendCommand(LaixiCommands.screenOn(serial));
      await sleep(500);
      
      // 2. Toast 메시지로 응답 확인
      const toastResponse = await sendCommand(
        LaixiCommands.toast(`DoAi.Me 검증 ✓`, serial)
      );
      
      if (toastResponse.StatusCode === 200) {
        // 응답 결과 확인
        const results = parseResultArray(toastResponse.result);
        const deviceResult = results.find(r => r.deviceid === serial);
        
        if (deviceResult && deviceResult.success) {
          device.status = 'verified';
          device.verified = true;
          state.verifiedDevices.add(serial);
          log('success', `  ✓ ${serial} 검증 완료`);
        } else if (deviceResult && deviceResult.errmsg) {
          // Laixi 앱 업데이트 필요 등의 경고
          device.status = 'warning';
          device.warning = deviceResult.errmsg;
          state.verifiedDevices.add(serial); // 경고지만 사용 가능
          log('warn', `  ⚠ ${serial}: ${deviceResult.errmsg}`);
        } else {
          device.status = 'error';
          device.error = '응답 없음';
          log('error', `  ✗ ${serial} 응답 없음`);
        }
      } else {
        device.status = 'error';
        device.error = `StatusCode ${toastResponse.StatusCode}`;
        log('error', `  ✗ ${serial} API 오류`);
      }
      
      await sleep(CONFIG.VERIFY_DELAY);
      
    } catch (e) {
      device.status = 'error';
      device.error = e.message;
      log('error', `  ✗ ${serial}: ${e.message}`);
      state.stats.errors.push({ phase: 'validate', device: serial, error: e.message });
    }
  }
  
  state.stats.validateTime = Date.now() - startTime;
  state.stats.verifiedDevices = state.verifiedDevices.size;
  
  log('info', '');
  log('success', `검증 완료: ${state.verifiedDevices.size}/${serials.length}개 성공 (${state.stats.validateTime}ms)`);
  
  return state.verifiedDevices.size;
}

function parseResultArray(result) {
  try {
    return typeof result === 'string' ? JSON.parse(result) : (result || []);
  } catch (e) {
    return [];
  }
}

// ============================================
// Phase 4: INITIALIZE - 폰보드 환경 초기화
// ============================================

async function phaseInitialize() {
  log('info', '');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', 'Phase 4: INITIALIZE - 폰보드 환경 초기화');
  log('info', '═══════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  const verifiedSerials = Array.from(state.verifiedDevices);
  
  if (verifiedSerials.length === 0) {
    log('warn', '초기화할 검증된 디바이스 없음');
    return 0;
  }
  
  log('info', `${verifiedSerials.length}개 디바이스 초기화 시작...`);
  log('info', '');
  
  // 전체 디바이스에 초기화 명령 전송
  for (const initCmd of CONFIG.INIT_COMMANDS) {
    log('info', `  🔧 ${initCmd.name}...`);
    
    try {
      // 모든 검증된 디바이스에 명령 전송
      const deviceIds = verifiedSerials.join(',');
      await sendCommand(LaixiCommands.adb(initCmd.cmd, deviceIds));
      await sleep(500);
      log('success', `     완료`);
    } catch (e) {
      log('warn', `     실패: ${e.message}`);
    }
  }
  
  // 초기화 완료 표시
  verifiedSerials.forEach(serial => {
    const device = state.devices.get(serial);
    if (device && device.verified) {
      device.initialized = true;
      device.status = 'ready';
      state.initializedDevices.add(serial);
    }
  });
  
  // 초기화 완료 Toast
  await sendCommand(LaixiCommands.toast('DoAi.Me 준비 완료! 🚀', 'all'));
  
  state.stats.initializeTime = Date.now() - startTime;
  state.stats.initializedDevices = state.initializedDevices.size;
  
  log('info', '');
  log('success', `초기화 완료: ${state.initializedDevices.size}개 디바이스 (${state.stats.initializeTime}ms)`);
  
  return state.initializedDevices.size;
}

// ============================================
// Phase 5: HEARTBEAT - 지속적 연결 유지
// ============================================

/**
 * 새 디바이스 검증 및 초기화
 * @param {string[]} newDeviceIds - 새로 발견된 디바이스 ID 목록
 */
async function revalidateNewDevices(newDeviceIds) {
  log('info', `🔄 ${newDeviceIds.length}개 새 디바이스 재검증 시작...`);
  
  for (const serial of newDeviceIds) {
    try {
      // 화면 켜기
      await sendCommand(LaixiCommands.screenOn(serial));
      await sleep(500);
      
      // Toast로 검증
      const toastResponse = await sendCommand(
        LaixiCommands.toast(`DoAi.Me 재검증 ✓`, serial)
      );
      
      if (toastResponse.StatusCode === 200) {
        const results = parseResultArray(toastResponse.result);
        const deviceResult = results.find(r => r.deviceid === serial);
        
        if (deviceResult && deviceResult.success) {
          // 디바이스 상태 업데이트
          state.devices.set(serial, {
            serial,
            name: `Device (재검증됨)`,
            status: 'verified',
            verified: true,
            initialized: false,
            lastSeen: new Date().toISOString(),
          });
          state.verifiedDevices.add(serial);
          log('success', `  ✓ ${serial} 재검증 완료`);
          
          // 초기화 명령 전송
          for (const initCmd of CONFIG.INIT_COMMANDS) {
            try {
              await sendCommand(LaixiCommands.adb(initCmd.cmd, serial));
              await sleep(200);
            } catch (e) {
              log('warn', `  ${serial} 초기화 명령 실패: ${initCmd.name}`);
            }
          }
          
          state.initializedDevices.add(serial);
          state.devices.get(serial).initialized = true;
          state.devices.get(serial).status = 'ready';
          
        } else {
          log('warn', `  ⚠ ${serial} 검증 실패`);
        }
      }
    } catch (e) {
      log('error', `  ✗ ${serial} 재검증 오류: ${e.message}`);
    }
  }
  
  state.stats.verifiedDevices = state.verifiedDevices.size;
  state.stats.initializedDevices = state.initializedDevices.size;
}

/**
 * 오프라인 디바이스 마킹
 * @param {string[]} offlineDeviceIds - 오프라인으로 전환된 디바이스 ID 목록
 */
function markOfflineDevices(offlineDeviceIds) {
  log('warn', `📴 ${offlineDeviceIds.length}개 디바이스 오프라인 감지`);
  
  for (const serial of offlineDeviceIds) {
    const device = state.devices.get(serial);
    if (device) {
      device.status = 'offline';
      device.verified = false;
      state.verifiedDevices.delete(serial);
      state.initializedDevices.delete(serial);
      log('warn', `  📴 ${serial} 오프라인 마킹됨`);
    }
  }
  
  state.stats.verifiedDevices = state.verifiedDevices.size;
  state.stats.initializedDevices = state.initializedDevices.size;
}

function startHeartbeat() {
  log('info', '');
  log('info', '═══════════════════════════════════════════════════════');
  log('info', 'Phase 5: HEARTBEAT - 지속적 연결 유지');
  log('info', '═══════════════════════════════════════════════════════');
  
  let heartbeatCount = 0;
  let lastKnownDeviceIds = new Set(state.devices.keys());
  
  state.heartbeatTimer = setInterval(async () => {
    if (!state.connected) {
      return;
    }
    
    heartbeatCount++;
    
    try {
      // 디바이스 목록 갱신으로 연결 상태 확인
      const response = await sendCommand(LaixiCommands.list());
      
      if (response.StatusCode === 200) {
        const devices = parseResultArray(response.result);
        const currentDeviceIds = new Set(devices.map(d => d.deviceId || d.id));
        const currentCount = currentDeviceIds.size;
        const previousCount = lastKnownDeviceIds.size;
        
        // 디바이스 수 변경 감지 및 재검증
        if (currentCount !== previousCount) {
          log('warn', `🔔 디바이스 수 변경: ${previousCount} → ${currentCount}`);
          
          // 새로 추가된 디바이스 찾기
          const newDeviceIds = [...currentDeviceIds].filter(id => !lastKnownDeviceIds.has(id));
          
          // 사라진 디바이스 찾기
          const offlineDeviceIds = [...lastKnownDeviceIds].filter(id => !currentDeviceIds.has(id));
          
          // 새 디바이스 재검증 및 초기화
          if (newDeviceIds.length > 0) {
            // 비동기로 처리하되 Heartbeat 루프를 블로킹하지 않음
            revalidateNewDevices(newDeviceIds).catch(e => {
              log('error', `재검증 중 오류: ${e.message}`);
            });
          }
          
          // 오프라인 디바이스 마킹
          if (offlineDeviceIds.length > 0) {
            markOfflineDevices(offlineDeviceIds);
          }
          
          // 현재 상태 업데이트
          lastKnownDeviceIds = currentDeviceIds;
          state.stats.totalDevices = currentCount;
        }
        
        // 10회마다 상태 출력
        if (heartbeatCount % 10 === 0) {
          const pingPongStatus = `ping:${state.stats.pingCount}/pong:${state.stats.pongCount}`;
          log('info', `💓 Heartbeat #${heartbeatCount} - ${currentCount}대 온라인 (${pingPongStatus})`);
        }
      } else {
        log('warn', `Heartbeat 오류: StatusCode ${response.StatusCode}`);
      }
      
    } catch (e) {
      log('error', `Heartbeat 실패: ${e.message}`);
    }
    
  }, CONFIG.HEARTBEAT_INTERVAL);
  
  log('success', `Heartbeat 시작 (${CONFIG.HEARTBEAT_INTERVAL}ms 간격)`);
  log('info', '');
  log('info', '🎉 성립 명령 완료! 연결 유지 중...');
  log('info', '   종료하려면 Ctrl+C를 누르세요.');
}

// ============================================
// 결과 출력
// ============================================

function printSummary() {
  log('info', '');
  log('info', '╔═══════════════════════════════════════════════════════════╗');
  log('info', '║            성립 명령 결과 요약                             ║');
  log('info', '╠═══════════════════════════════════════════════════════════╣');
  log('info', `║  Node ID:         ${(state.nodeId || 'N/A').padEnd(38)}║`);
  log('info', `║  총 디바이스:      ${String(state.stats.totalDevices).padEnd(38)}║`);
  log('info', `║  검증 완료:        ${String(state.stats.verifiedDevices).padEnd(38)}║`);
  log('info', `║  초기화 완료:      ${String(state.stats.initializedDevices).padEnd(38)}║`);
  log('info', '╠═══════════════════════════════════════════════════════════╣');
  log('info', `║  연결 시간:        ${((state.stats.connectTime || 0) + 'ms').padEnd(38)}║`);
  log('info', `║  조회 시간:        ${((state.stats.discoverTime || 0) + 'ms').padEnd(38)}║`);
  log('info', `║  검증 시간:        ${((state.stats.validateTime || 0) + 'ms').padEnd(38)}║`);
  log('info', `║  초기화 시간:      ${((state.stats.initializeTime || 0) + 'ms').padEnd(38)}║`);
  log('info', '╠═══════════════════════════════════════════════════════════╣');
  log('info', `║  Ping 전송:        ${String(state.stats.pingCount || 0).padEnd(38)}║`);
  log('info', `║  Pong 수신:        ${String(state.stats.pongCount || 0).padEnd(38)}║`);
  log('info', `║  Pong 누락:        ${String(state.stats.missedPongs || 0).padEnd(38)}║`);
  log('info', '╚═══════════════════════════════════════════════════════════╝');
  
  if (state.stats.errors.length > 0) {
    log('warn', '');
    log('warn', '발생한 오류:');
    state.stats.errors.forEach((err, i) => {
      log('warn', `  ${i + 1}. [${err.phase}] ${err.device || ''}: ${err.error}`);
    });
  }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       DoAi.Me Connection Establishment Protocol v1.0      ║');
  console.log('║              최초 접속 무결성 검증 시스템                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');
  const initOnly = args.includes('--init-only');
  
  try {
    // Phase 1: 연결
    await phaseConnect();
    
    // Phase 2: 조회
    await phaseDiscover();
    
    // Phase 3: 검증
    if (!initOnly) {
      await phaseValidate();
    } else {
      // 검증 스킵 시 모든 디바이스를 검증된 것으로 처리
      state.devices.forEach((device, serial) => {
        device.verified = true;
        state.verifiedDevices.add(serial);
      });
    }
    
    // Phase 4: 초기화
    if (!verifyOnly) {
      await phaseInitialize();
    }
    
    // 결과 출력
    printSummary();
    
    // Phase 5: Heartbeat (검증/초기화 후 유지)
    if (!verifyOnly) {
      startHeartbeat();
    } else {
      log('info', '');
      log('info', '검증 모드 완료. 프로세스 종료.');
      process.exit(0);
    }
    
  } catch (e) {
    log('error', `성립 명령 실패: ${e.message}`);
    printSummary();
    process.exit(1);
  }
}

// ============================================
// 프로세스 핸들링
// ============================================

process.on('SIGINT', () => {
  log('info', '');
  log('info', '🛑 종료 요청...');
  
  // Heartbeat 타이머 정리
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  
  // ping/pong 타이머 정리
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  if (state.pongTimeout) {
    clearTimeout(state.pongTimeout);
    state.pongTimeout = null;
  }
  
  // 대기 중인 명령 정리
  for (const [requestId, pending] of state.pendingRequests) {
    clearTimeout(pending.timer);
  }
  state.pendingRequests.clear();
  state.commandQueue = [];
  
  if (state.ws) {
    // 종료 알림
    try {
      state.ws.send(LaixiCommands.toast('DoAi.Me 연결 종료', 'all'));
    } catch (e) {
      // 무시
    }
    state.ws.close();
  }
  
  printSummary();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log('error', `Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

// 실행
main();
