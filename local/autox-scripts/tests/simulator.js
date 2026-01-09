/**
 * AutoX.js Simulator
 * 로컬 PC에서 AutoX.js 스크립트 로직 테스트
 *
 * 실제 폰 없이 API 호출 및 플로우 검증
 */

const http = require('http');
const https = require('https');

// ==================== 설정 ====================
const CONFIG = {
  server: {
    host: 'localhost',
    port: 8000,
    protocol: 'http'
  },
  device: {
    id: 'SIMULATOR_001',
    model: 'Simulator',
    pc_id: 'LOCAL'
  }
};

const BASE_URL = `${CONFIG.server.protocol}://${CONFIG.server.host}:${CONFIG.server.port}`;

// ==================== HTTP 클라이언트 ====================
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = CONFIG.server.protocol === 'https' ? https : http;

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = client.request(url, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// ==================== API 함수 ====================

async function healthCheck() {
  console.log('[INFO] 헬스 체크 중...');
  try {
    const res = await makeRequest('GET', '/health');
    if (res.statusCode === 200) {
      console.log('[SUCCESS] 서버 연결 정상', res.data);
      return true;
    } else {
      console.log('[WARN] 서버 응답 이상', res.statusCode);
      return false;
    }
  } catch (e) {
    console.error('[ERROR] 서버 연결 실패', e.message);
    return false;
  }
}

async function getNextTask() {
  console.log('[INFO] 작업 요청 중...');
  try {
    const res = await makeRequest('GET', `/api/tasks/next?device_id=${CONFIG.device.id}`);

    if (res.statusCode === 200 && res.data.success && res.data.task) {
      console.log('[SUCCESS] 작업 수신', {
        task_id: res.data.task.task_id,
        title: res.data.task.title,
        keyword: res.data.task.keyword
      });
      return res.data.task;
    } else {
      console.log('[INFO] 대기 중인 작업 없음');
      return null;
    }
  } catch (e) {
    console.error('[ERROR] 작업 요청 실패', e.message);
    return null;
  }
}

async function completeTask(taskId, result) {
  console.log('[INFO] 작업 완료 보고 중...', { task_id: taskId });
  try {
    const res = await makeRequest('POST', `/api/tasks/${taskId}/complete`, {
      device_id: CONFIG.device.id,
      success: result.success,
      watch_duration: result.watch_duration,
      search_type: result.search_type,
      search_rank: result.search_rank,
      liked: result.liked,
      commented: result.commented,
      subscribed: result.subscribed,
      notification_set: result.notification_set,
      shared: result.shared,
      added_to_playlist: result.added_to_playlist,
      error_message: result.error_message
    });

    if (res.statusCode === 200 && res.data.success) {
      console.log('[SUCCESS] 완료 보고 성공');
      return true;
    } else {
      console.error('[ERROR] 완료 보고 실패', res);
      return false;
    }
  } catch (e) {
    console.error('[ERROR] 완료 보고 예외', e.message);
    return false;
  }
}

async function getTaskStatus() {
  console.log('[INFO] 작업 현황 조회 중...');
  try {
    const res = await makeRequest('GET', '/api/tasks/status');

    if (res.statusCode === 200 && res.data.success) {
      console.log('[SUCCESS] 작업 현황', res.data.summary);
      return res.data.summary;
    } else {
      console.error('[ERROR] 현황 조회 실패', res);
      return null;
    }
  } catch (e) {
    console.error('[ERROR] 현황 조회 예외', e.message);
    return null;
  }
}

// ==================== 시뮬레이션 함수 ====================

function simulateYouTubeWatch(task) {
  console.log('\n' + '='.repeat(50));
  console.log('[SIMULATE] YouTube 시청 시뮬레이션');
  console.log('Task:', {
    id: task.task_id,
    title: task.title,
    keyword: task.keyword,
    url: task.youtube_url
  });

  const result = {
    success: true,
    watch_duration: Math.floor(Math.random() * 120) + 30, // 30-150초
    search_type: task.youtube_url ? 0 : 1,
    search_rank: task.keyword ? 1 : null,
    liked: Math.random() < 0.3,
    commented: Math.random() < 0.1,
    subscribed: Math.random() < 0.05,
    notification_set: false,
    shared: Math.random() < 0.05,
    added_to_playlist: Math.random() < 0.1,
    error_message: null
  };

  console.log('[SIMULATE] YouTube 앱 실행');
  console.log('[SIMULATE] 영상 검색/열기');
  console.log(`[SIMULATE] ${result.watch_duration}초 동안 시청 중...`);

  if (result.liked) {
    console.log('[SIMULATE] 좋아요 클릭');
  }

  if (result.commented) {
    console.log('[SIMULATE] 댓글 작성');
  }

  if (result.subscribed) {
    console.log('[SIMULATE] 구독 클릭');
    // 구독했을 경우 알림 설정도 시뮬레이션
    if (Math.random() < 0.7) {
      result.notification_set = true;
      console.log('[SIMULATE] 알림 설정 (전체)');
    }
  }

  if (result.shared) {
    console.log('[SIMULATE] 공유 메뉴 열기');
  }

  if (result.added_to_playlist) {
    console.log('[SIMULATE] 재생목록 추가 (나중에 볼 동영상)');
  }

  console.log('[SIMULATE] YouTube 앱 종료');
  console.log('[SUCCESS] 시청 완료', result);
  console.log('='.repeat(50) + '\n');

  return result;
}

// ==================== 메인 루프 ====================

async function mainLoop() {
  console.log('🚀 AIFARM AutoX.js Simulator 시작\n');

  // 1. 서버 연결 확인
  if (!await healthCheck()) {
    console.error('❌ 서버 연결 실패. Backend 서버를 먼저 실행하세요.');
    console.log('\n실행 방법:');
    console.log('  cd backend');
    console.log('  python main.py\n');
    process.exit(1);
  }

  console.log('\n✅ 서버 연결 성공!\n');

  // 2. 초기 현황 확인
  await getTaskStatus();

  console.log('\n📝 시뮬레이션 시작 (Ctrl+C로 종료)\n');

  let iteration = 0;

  while (true) {
    iteration++;
    console.log(`\n--- Iteration #${iteration} ---`);

    try {
      // 3. 작업 요청
      const task = await getNextTask();

      if (task) {
        // 4. 작업 수행 (시뮬레이션)
        const result = simulateYouTubeWatch(task);

        // 5. 결과 보고
        await completeTask(task.task_id, result);

        // 6. 현황 확인
        await getTaskStatus();
      } else {
        console.log('[INFO] 대기 중... (작업이 없습니다)');
        console.log('[HINT] Frontend에서 작업을 등록하거나 다음 명령을 실행하세요:');
        console.log('       curl -X POST http://localhost:8000/api/tasks -H "Content-Type: application/json" -d \'{"keyword":"여행 브이로그","title":"테스트 영상","priority":5}\'\n');
      }

      // 7. 대기 (3초)
      console.log('[WAIT] 3초 대기...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (e) {
      console.error('[ERROR] 메인 루프 예외', e.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// ==================== 종료 핸들러 ====================
process.on('SIGINT', () => {
  console.log('\n\n🛑 시뮬레이터 종료');
  process.exit(0);
});

// ==================== 실행 ====================
mainLoop().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
