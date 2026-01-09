/**
 * WebSocket 직접 테스트
 */

const WebSocket = require('ws');

const deviceId = process.argv[2] || '30335436434b3098';

console.log('='.repeat(60));
console.log('WebSocket Direct Test');
console.log('='.repeat(60));

// 1. 먼저 /ws 경로 테스트
console.log('\n[TEST 1] /ws endpoint...');
const ws1 = new WebSocket('ws://localhost:3100/ws');

ws1.on('open', () => {
    console.log('  ✅ /ws 연결 성공');
    ws1.close();
    
    // 2. /ws/stream/{deviceId} 경로 테스트
    testStreamEndpoint();
});

ws1.on('error', (err) => {
    console.log(`  ❌ /ws 연결 실패: ${err.message}`);
    testStreamEndpoint();
});

function testStreamEndpoint() {
    // Legacy StreamServer 사용 (/stream/{deviceId}/ws)
    console.log(`\n[TEST 2] /stream/${deviceId}/ws endpoint (Legacy)...`);
    const ws2 = new WebSocket(`ws://localhost:3100/stream/${deviceId}/ws?quality=medium`, {
        perMessageDeflate: false
    });
    
    let dataReceived = false;
    let frameCount = 0;
    let totalBytes = 0;
    let startTime;
    let timeout;
    
    // 에러 핸들러를 먼저 등록
    ws2.on('error', (err) => {
        console.log(`  ❌ 스트림 오류: ${err.message}`);
    });
    
    ws2.on('close', (code, reason) => {
        console.log(`  🔌 연결 종료: code=${code}, reason=${reason || 'N/A'}`);
        if (timeout) clearTimeout(timeout);
        process.exit(dataReceived ? 0 : 1);
    });
    
    ws2.on('open', () => {
        startTime = Date.now();
        console.log('  ✅ 스트림 연결 성공');
        console.log('  📤 Legacy StreamServer는 자동으로 스트리밍 시작');
        
        // Legacy StreamServer는 subscribe 메시지 불필요 - 바로 스트리밍 시작
        // 데이터 수신 대기
        timeout = setTimeout(() => {
            if (!dataReceived) {
                console.log('  ⚠️ 15초 내 바이너리 데이터 없음');
                ws2.close();
            }
        }, 15000);
    });
    
    ws2.on('message', (data) => {
        if (data instanceof Buffer) {
            if (!dataReceived) {
                dataReceived = true;
                const latency = Date.now() - startTime;
                console.log(`  📦 첫 바이너리 데이터 수신!`);
                console.log(`     크기: ${data.length} bytes`);
                console.log(`     지연시간: ${latency}ms`);
                console.log(`     First 32 bytes: ${data.slice(0, 32).toString('hex').toUpperCase()}`);
                
                // H.264 NAL Unit 확인
                if (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1) {
                    const nalType = data[4] & 0x1F;
                    console.log(`     ✅ H.264 NAL Unit 감지! Type: ${nalType}`);
                } else {
                    console.log(`     ⚠️ H.264 start code 아님`);
                }
            }
            
            frameCount++;
            totalBytes += data.length;
            
            // 3초 후 종료
            if (Date.now() - startTime > 3000) {
                if (timeout) clearTimeout(timeout);
                console.log(`\n  📊 3초간 통계:`);
                console.log(`     프레임: ${frameCount}`);
                console.log(`     총 바이트: ${totalBytes.toLocaleString()}`);
                console.log(`     처리량: ${(totalBytes * 8 / 1024 / 3).toFixed(1)} Kbps`);
                ws2.close();
            }
        } else {
            const msg = data.toString();
            console.log(`  📨 JSON: ${msg.slice(0, 200)}`);
            
            // 에러 메시지 확인
            try {
                const parsed = JSON.parse(msg);
                if (parsed.type === 'stream:error') {
                    console.log(`  ❌ 서버 에러: ${parsed.message}`);
                }
            } catch (e) {}
        }
    });
}

