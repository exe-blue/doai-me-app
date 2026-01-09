/**
 * DoAi.Me Establish Module for AutoX.js
 * 
 * 디바이스 측 성립 확인 및 초기화
 * 
 * 기능:
 * 1. Gateway 연결 상태 확인
 * 2. 디바이스 자가 진단
 * 3. BroadcastReceiver 상태 확인
 * 4. 초기화 명령 수신 대기
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

// ============================================
// 상수
// ============================================

const ESTABLISH_ACTION = 'com.doai.me.ESTABLISH';
const ESTABLISH_RESPONSE_ACTION = 'com.doai.me.ESTABLISH_RESPONSE';

const STATUS = {
  PENDING: 'PENDING',
  VERIFYING: 'VERIFYING',
  VERIFIED: 'VERIFIED',
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  ERROR: 'ERROR',
};

// ============================================
// EstablishModule 클래스
// ============================================

class EstablishModule {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.deviceId = device.serial || device.getIMEI() || 'unknown';
    this.status = STATUS.PENDING;
    this.receiver = null;
    this.isListening = false;
    this.lastVerifyTime = null;
    this.establishCount = 0;
    
    // 자가 진단 결과
    this.diagnostics = {
      deviceId: this.deviceId,
      model: device.model || 'Unknown',
      brand: device.brand || 'Unknown',
      sdkVersion: device.sdkInt || 0,
      screenWidth: device.width || 0,
      screenHeight: device.height || 0,
      batteryLevel: null,
      wifiConnected: false,
      accessibilityEnabled: false,
      autoJsRunning: true,
      receiverRegistered: false,
    };
  }

  /**
   * 성립 확인 수신 시작
   */
  startListening() {
    if (this.isListening) {
      this.logger.warn('[Establish] 이미 청취 중');
      return;
    }

    this.logger.info('[Establish] 성립 확인 리시버 시작', {
      action: ESTABLISH_ACTION
    });

    try {
      // BroadcastReceiver 등록
      this.receiver = new JavaAdapter(android.content.BroadcastReceiver, {
        onReceive: (ctx, intent) => {
          this._handleEstablishIntent(intent);
        }
      });

      const filter = new android.content.IntentFilter(ESTABLISH_ACTION);
      context.registerReceiver(this.receiver, filter);
      
      this.isListening = true;
      this.diagnostics.receiverRegistered = true;
      this.logger.info('[Establish] ✓ 리시버 등록 완료');

      // 자가 진단 실행
      this._runDiagnostics();

    } catch (e) {
      this.logger.error('[Establish] 리시버 등록 실패', {
        error: e.message
      });
      this.status = STATUS.ERROR;
      
      // 폴백: events.broadcast 사용
      this._registerEventsReceiver();
    }
  }

  /**
   * events.broadcast 폴백
   */
  _registerEventsReceiver() {
    this.logger.info('[Establish] events.broadcast 사용 (폴백)');
    
    events.broadcast.on(ESTABLISH_ACTION, (intent) => {
      this._handleEstablishIntent(intent);
    });

    this.isListening = true;
  }

  /**
   * 성립 확인 Intent 처리
   */
  _handleEstablishIntent(intent) {
    try {
      const command = intent.getStringExtra('command');
      const requestId = intent.getStringExtra('request_id');
      
      this.logger.info('[Establish] 📥 명령 수신', {
        command,
        requestId
      });

      switch (command) {
        case 'PING':
          this._handlePing(requestId);
          break;

        case 'VERIFY':
          this._handleVerify(requestId);
          break;

        case 'INIT':
          this._handleInit(requestId);
          break;

        case 'DIAGNOSTICS':
          this._handleDiagnostics(requestId);
          break;

        case 'STATUS':
          this._handleStatus(requestId);
          break;

        default:
          this.logger.warn('[Establish] 알 수 없는 명령', { command });
      }

    } catch (e) {
      this.logger.error('[Establish] Intent 처리 오류', {
        error: e.message
      });
    }
  }

  /**
   * PING 처리 - 연결 확인
   */
  _handlePing(requestId) {
    this.status = STATUS.VERIFYING;
    
    // PONG 응답 전송
    this._sendResponse(requestId, 'PONG', {
      deviceId: this.deviceId,
      timestamp: Date.now(),
      status: this.status,
    });

    this.logger.info('[Establish] PONG 응답 전송');
  }

  /**
   * VERIFY 처리 - 무결성 검증
   */
  _handleVerify(requestId) {
    this.status = STATUS.VERIFYING;
    this.lastVerifyTime = Date.now();
    
    // 자가 진단 갱신
    this._runDiagnostics();

    // 검증 결과 전송
    this._sendResponse(requestId, 'VERIFIED', {
      deviceId: this.deviceId,
      diagnostics: this.diagnostics,
      verifyTime: this.lastVerifyTime,
    });

    this.status = STATUS.VERIFIED;
    this.logger.info('[Establish] ✓ 검증 완료');

    // Toast 표시
    toast('DoAi.Me 검증 완료 ✓');
  }

  /**
   * INIT 처리 - 초기화
   */
  _handleInit(requestId) {
    this.status = STATUS.INITIALIZING;
    this.establishCount++;
    
    const initResults = [];

    try {
      // 1. 화면 켜기
      device.wakeUpIfNeeded();
      initResults.push({ task: 'wakeUp', success: true });
      sleep(500);

      // 2. 잠금 해제 시도
      try {
        device.dismissKeyguard();
        initResults.push({ task: 'dismissKeyguard', success: true });
      } catch (e) {
        initResults.push({ task: 'dismissKeyguard', success: false, error: e.message });
      }
      sleep(500);

      // 3. 화면 밝기 설정
      try {
        device.setBrightnessMode(0); // 수동 모드
        device.setBrightness(10);    // 최소 밝기
        initResults.push({ task: 'brightness', success: true });
      } catch (e) {
        initResults.push({ task: 'brightness', success: false, error: e.message });
      }

      // 4. 볼륨 설정
      try {
        device.setMusicVolume(0);     // 미디어 음소거
        initResults.push({ task: 'volume', success: true });
      } catch (e) {
        initResults.push({ task: 'volume', success: false, error: e.message });
      }

      // 5. 화면 항상 켜짐
      try {
        device.keepScreenOn(true);
        initResults.push({ task: 'keepScreenOn', success: true });
      } catch (e) {
        initResults.push({ task: 'keepScreenOn', success: false, error: e.message });
      }

      this.status = STATUS.READY;
      
      // 초기화 완료 응답
      this._sendResponse(requestId, 'INITIALIZED', {
        deviceId: this.deviceId,
        establishCount: this.establishCount,
        initResults,
        status: this.status,
      });

      this.logger.info('[Establish] ✓ 초기화 완료', {
        results: initResults.filter(r => r.success).length + '/' + initResults.length
      });

      // Toast 표시
      toast('DoAi.Me 준비 완료! 🚀');

    } catch (e) {
      this.status = STATUS.ERROR;
      this._sendResponse(requestId, 'INIT_ERROR', {
        deviceId: this.deviceId,
        error: e.message,
        initResults,
      });
      
      this.logger.error('[Establish] 초기화 실패', { error: e.message });
    }
  }

  /**
   * DIAGNOSTICS 처리 - 진단 정보 요청
   */
  _handleDiagnostics(requestId) {
    this._runDiagnostics();
    
    this._sendResponse(requestId, 'DIAGNOSTICS_RESULT', {
      deviceId: this.deviceId,
      diagnostics: this.diagnostics,
      timestamp: Date.now(),
    });

    this.logger.info('[Establish] 진단 정보 전송');
  }

  /**
   * STATUS 처리 - 현재 상태 요청
   */
  _handleStatus(requestId) {
    this._sendResponse(requestId, 'STATUS_RESULT', {
      deviceId: this.deviceId,
      status: this.status,
      isListening: this.isListening,
      establishCount: this.establishCount,
      lastVerifyTime: this.lastVerifyTime,
      uptime: Date.now() - (this.startTime || Date.now()),
    });

    this.logger.debug('[Establish] 상태 정보 전송');
  }

  /**
   * 응답 전송 (Broadcast)
   */
  _sendResponse(requestId, responseType, data) {
    try {
      const intent = new android.content.Intent(ESTABLISH_RESPONSE_ACTION);
      intent.putExtra('request_id', requestId || '');
      intent.putExtra('response_type', responseType);
      intent.putExtra('data', JSON.stringify(data));
      intent.putExtra('timestamp', String(Date.now()));
      
      context.sendBroadcast(intent);
      
      this.logger.debug('[Establish] 응답 전송', {
        responseType,
        requestId
      });

    } catch (e) {
      this.logger.error('[Establish] 응답 전송 실패', {
        error: e.message
      });
    }
  }

  /**
   * 자가 진단 실행
   */
  _runDiagnostics() {
    try {
      // 배터리 레벨
      try {
        this.diagnostics.batteryLevel = device.getBattery();
      } catch (e) {
        this.diagnostics.batteryLevel = -1;
      }

      // WiFi 연결 상태
      try {
        const wifiManager = context.getSystemService(android.content.Context.WIFI_SERVICE);
        const wifiInfo = wifiManager.getConnectionInfo();
        this.diagnostics.wifiConnected = wifiInfo && wifiInfo.getNetworkId() !== -1;
      } catch (e) {
        this.diagnostics.wifiConnected = false;
      }

      // 접근성 서비스 상태
      try {
        this.diagnostics.accessibilityEnabled = auto.service !== null;
      } catch (e) {
        this.diagnostics.accessibilityEnabled = false;
      }

      // AutoJS 실행 상태
      this.diagnostics.autoJsRunning = true;

      // 리시버 등록 상태
      this.diagnostics.receiverRegistered = this.isListening;

      this.logger.debug('[Establish] 진단 완료', this.diagnostics);

    } catch (e) {
      this.logger.error('[Establish] 진단 실패', { error: e.message });
    }
  }

  /**
   * 청취 중지
   */
  stopListening() {
    if (!this.isListening) {
      return;
    }

    try {
      if (this.receiver) {
        context.unregisterReceiver(this.receiver);
        this.receiver = null;
      }
      this.isListening = false;
      this.diagnostics.receiverRegistered = false;
      this.logger.info('[Establish] 리시버 해제');
    } catch (e) {
      this.logger.warn('[Establish] 리시버 해제 오류', { error: e.message });
    }
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return {
      deviceId: this.deviceId,
      status: this.status,
      isListening: this.isListening,
      establishCount: this.establishCount,
      lastVerifyTime: this.lastVerifyTime,
      diagnostics: this.diagnostics,
    };
  }
}

module.exports = EstablishModule;
module.exports.STATUS = STATUS;
module.exports.ESTABLISH_ACTION = ESTABLISH_ACTION;
module.exports.ESTABLISH_RESPONSE_ACTION = ESTABLISH_RESPONSE_ACTION;
