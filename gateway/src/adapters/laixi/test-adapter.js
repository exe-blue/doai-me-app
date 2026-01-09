#!/usr/bin/env node
/**
 * Laixi Adapter 테스트 스크립트
 * 
 * 실행: node test-adapter.js
 * 
 * 테스트 항목:
 * 1. 연결 (Heartbeat)
 * 2. 디바이스 목록 조회
 * 3. Toast 메시지
 * 4. 터치 테스트
 * 
 * @author Axon (Tech Lead)
 */

const LaixiAdapter = require('./LaixiAdapter');

async function main() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║       🔌 Laixi Adapter Test - 신경망 가시성 확보       ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    
    const adapter = new LaixiAdapter({
        url: 'ws://127.0.0.1:22221/',
        heartbeatInterval: 10000, // 10초마다 하트비트
        timeout: 5000
    });
    
    // 이벤트 리스너
    adapter.on('connected', () => {
        console.log('\n🎉 이벤트: connected\n');
    });
    
    adapter.on('disconnected', (data) => {
        const code = data?.code || 'N/A';
        const reason = data?.reason || 'Unknown';
        console.log(`\n❌ 이벤트: disconnected (code: ${code}, reason: ${reason})\n`);
    });
    
    adapter.on('heartbeat', ({ latency, deviceCount }) => {
        console.log(`\n💓 이벤트: heartbeat (latency: ${latency}ms, devices: ${deviceCount})\n`);
    });
    
    adapter.on('heartbeat:failed', (err) => {
        console.log(`\n💔 이벤트: heartbeat:failed (${err.message})\n`);
    });
    
    try {
        // 1. 연결
        console.log('\n📡 Step 1: Laixi 서버 연결...\n');
        await adapter.connect();
        
        // 2. 디바이스 목록
        console.log('\n📱 Step 2: 디바이스 목록 조회...\n');
        const response = await adapter.listDevices();
        
        // Laixi는 result를 JSON string으로 반환
        let devices = [];
        if (typeof response === 'string') {
            try { devices = JSON.parse(response); } catch { devices = []; }
        } else if (Array.isArray(response)) {
            devices = response;
        }
        
        console.log(`📊 연결된 디바이스: ${devices.length}대`);
        if (devices.length > 0) {
            console.log('┌──────┬──────────────────────────┬──────────────────┐');
            console.log('│  No  │       Device ID          │      Name        │');
            console.log('├──────┼──────────────────────────┼──────────────────┤');
            devices.slice(0, 10).forEach((d) => {
                const no = String(d.no || '-').padStart(4);
                const id = (d.deviceId || 'unknown').substring(0, 16).padEnd(22);
                const name = (d.name || 'N/A').substring(0, 16).padEnd(16);
                console.log(`│ ${no} │ ${id} │ ${name} │`);
            });
            if (devices.length > 10) {
                console.log(`│  ... │ ... ${devices.length - 10} more devices ...         │                  │`);
            }
            console.log('└──────┴──────────────────────────┴──────────────────┘');
        }
        
        // 3. Toast 테스트
        console.log('\n📢 Step 3: Toast 메시지 전송...\n');
        await adapter.toast('all', '🎉 DoAi.Me - Laixi Adapter Connected!');
        console.log('Toast 전송 완료');
        
        // 4. 터치 테스트 (화면 중앙)
        console.log('\n👆 Step 4: 터치 테스트 (화면 중앙)...\n');
        await adapter.tap('all', 0.5, 0.5);
        console.log('터치 테스트 완료');
        
        // 5. 통계 출력
        console.log('\n📊 통계:');
        console.log(JSON.stringify(adapter.stats, null, 2));
        
        // 하트비트 테스트를 위해 잠시 대기
        console.log('\n⏳ 하트비트 테스트 (5초 대기 후 종료)...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
    } catch (err) {
        console.error('\n❌ 테스트 실패:', err.message);
    } finally {
        console.log('\n🔌 연결 종료...');
        adapter.disconnect();
        console.log('테스트 완료');
        process.exit(0);
    }
}

// 실행
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

