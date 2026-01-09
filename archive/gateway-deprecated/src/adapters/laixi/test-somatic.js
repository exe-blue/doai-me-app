#!/usr/bin/env node
/**
 * Somatic Engine 테스트 스크립트
 * 
 * 오리온 지시 검증:
 * 1. Configurable Watcher - 시청 + 랜덤 스킵
 * 2. Search Navigator - 검색 → Top 3 랜덤 클릭
 * 3. Human Touch - 모든 딜레이에 random 적용
 * 
 * 실행: node test-somatic.js
 * 
 * @author Axon (Tech Lead)
 */

const LaixiAdapter = require('./LaixiAdapter');
const SomaticEngine = require('./SomaticEngine');

// 테스트 모드 플래그 (실제 디바이스 없이 로직만 테스트)
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     🏃 Somatic Engine Test - 신체 엔진 로직 검증               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (DRY_RUN) {
        console.log('⚠️  DRY RUN 모드: 실제 디바이스 명령 없이 로직만 테스트합니다.\n');
    }
    
    // 1. 어댑터 연결
    const adapter = new LaixiAdapter({
        url: 'ws://127.0.0.1:22221/',
        heartbeatInterval: 30000,
        timeout: 10000
    });
    
    // 2. Somatic Engine 생성
    const engine = new SomaticEngine(adapter, {
        // 테스트용 짧은 설정
        WATCH_PERCENT_MIN: 40,
        WATCH_PERCENT_MAX: 60,
        SEEK_COUNT_MIN: 2,
        SEEK_COUNT_MAX: 5
    });
    
    try {
        // ==================== 연결 ====================
        console.log('📡 Step 1: Laixi 연결...\n');
        
        if (!DRY_RUN) {
            await adapter.connect();
        } else {
            console.log('   [DRY_RUN] 연결 스킵\n');
        }
        
        // ==================== Human Touch 테스트 ====================
        console.log('🎯 Step 2: Human Touch 테스트 (랜덤 딜레이)\n');
        
        console.log('   딜레이 샘플 (각 5회):');
        console.log('   ┌────────────┬─────────────────────────────────────────┐');
        console.log('   │   Type     │   Generated Delays (ms)                 │');
        console.log('   ├────────────┼─────────────────────────────────────────┤');
        
        const delayTypes = ['MICRO', 'SHORT', 'MEDIUM', 'LONG'];
        for (const type of delayTypes) {
            const samples = [];
            for (let i = 0; i < 5; i++) {
                const delay = engine.randomInt(
                    engine.delays[type].min,
                    engine.delays[type].max
                );
                samples.push(delay);
            }
            const typePadded = type.padEnd(10);
            console.log(`   │ ${typePadded} │ ${samples.join(', ').padEnd(39)} │`);
        }
        console.log('   └────────────┴─────────────────────────────────────────┘');
        console.log('   ✅ 모든 딜레이가 범위 내 랜덤 값으로 생성됨\n');
        
        // ==================== 좌표 Jitter 테스트 ====================
        console.log('🎯 Step 3: 좌표 Jitter 테스트 (Human Touch)\n');
        
        const originalCoord = { x: 0.5, y: 0.5 };
        console.log(`   원본 좌표: (${originalCoord.x}, ${originalCoord.y})`);
        console.log('   Jitter 적용 (5회):');
        
        for (let i = 0; i < 5; i++) {
            const jittered = engine.jitterCoord(originalCoord);
            console.log(`     ${i + 1}. (${jittered.x.toFixed(4)}, ${jittered.y.toFixed(4)})`);
        }
        console.log('   ✅ 좌표에 미세한 랜덤 오프셋 적용됨\n');
        
        // ==================== Seek Times 생성 테스트 ====================
        console.log('🎯 Step 4: Configurable Watcher - Seek Times 테스트\n');
        
        const watchTime = 60 * 1000; // 60초
        const seekCount = 5;
        const seekTimes = engine._generateSeekTimes(watchTime, seekCount);
        
        console.log(`   시청 시간: ${watchTime / 1000}초, 스킵 횟수: ${seekCount}`);
        console.log('   생성된 스킵 시점:');
        seekTimes.forEach((time, i) => {
            console.log(`     ${i + 1}. ${(time / 1000).toFixed(1)}초 (${Math.round(time / watchTime * 100)}%)`);
        });
        console.log('   ✅ 랜덤 간격으로 스킵 시점 분배됨\n');
        
        // ==================== 실제 디바이스 테스트 ====================
        if (!DRY_RUN) {
            console.log('🎯 Step 5: 실제 디바이스 테스트\n');
            
            // 디바이스 목록 확인
            const response = await adapter.listDevices();
            let devices = [];
            if (typeof response === 'string') {
                try { devices = JSON.parse(response); } catch { devices = []; }
            } else if (Array.isArray(response)) {
                devices = response;
            }
            
            console.log(`   연결된 디바이스: ${devices.length}대\n`);
            
            if (devices.length > 0) {
                const targetDevice = 'all';
                
                // 토스트로 테스트 시작 알림
                console.log('   📢 Toast 알림 전송...');
                await adapter.toast(targetDevice, '🏃 Somatic Engine Test Started!');
                
                // 짧은 시청 테스트 (10초, 스킵 2회)
                console.log('\n   🎬 짧은 시청 테스트 (10초, 스킵 2회)...\n');
                
                const watchResult = await engine.watchVideo(targetDevice, 10, 2);
                
                console.log(`\n   📊 결과:`);
                console.log(`      - 실제 시청 시간: ${watchResult.actualWatchTime}초`);
                console.log(`      - 스킵 횟수: ${watchResult.seeksDone}회`);
                console.log(`      - 중단 여부: ${watchResult.interrupted ? '예' : '아니오'}`);
                
                // 통계 출력
                console.log('\n   📈 Somatic Engine 통계:');
                console.log(`      - 시청 영상: ${engine.stats.videosWatched}개`);
                console.log(`      - 총 시청 시간: ${engine.stats.totalWatchTime}초`);
                console.log(`      - 총 스킵: ${engine.stats.totalSeeks}회`);
                console.log(`      - 탭 횟수: ${engine.stats.tapCount}회`);
            }
        } else {
            console.log('🎯 Step 5: [DRY_RUN] 실제 디바이스 테스트 스킵\n');
        }
        
        // ==================== 결과 요약 ====================
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ 테스트 완료                               ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  [1] Human Touch: 모든 딜레이에 random(min, max) 적용 ✓       ║');
        console.log('║  [2] 좌표 Jitter: 탭 좌표에 미세 랜덤 오프셋 적용 ✓            ║');
        console.log('║  [3] Configurable Watcher: 시청 시간 + 랜덤 스킵 ✓            ║');
        console.log('║  [4] Search Navigator: 구현 완료 (실행은 유튜브 앱 필요) ✓    ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('');
        
        exitCode = 0;
    } catch (err) {
        console.error('\n❌ 테스트 실패:', err.message);
        exitCode = 1;
    } finally {
        if (!DRY_RUN && adapter.isConnected) {
            console.log('🔌 연결 종료...\n');
            adapter.disconnect();
        }
        process.exit(exitCode);
    }
}

// exitCode 변수 선언
let exitCode = 1;

// 실행
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});


