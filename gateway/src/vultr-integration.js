/**
 * Vultr Integration Module
 * 
 * 기존 gateway에 Vultr cloud-gateway 연결을 추가하는 모듈
 * 
 * 사용법:
 * 1. index.js에서 import
 * 2. initVultrConnection() 호출
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const { VultrClient, CommandExecutor } = require('./wss');

let vultrClient = null;
let commandExecutor = null;

/**
 * Vultr 연결 초기화
 * 
 * @param {Object} options
 * @param {Object} options.adbClient - AdbClient 인스턴스
 * @param {Object} options.laixiAdapter - LaixiAdapter 인스턴스 (선택)
 * @param {Object} options.logger - 로거
 * @param {Object} options.config - 설정
 */
async function initVultrConnection({ adbClient, laixiAdapter, logger, config }) {
    const vultrUrl = config.get('vultr.url') || process.env.VULTR_URL || 'ws://localhost:8000/ws/node';
    const nodeId = config.get('vultr.nodeId') || process.env.NODE_ID || `node_${require('os').hostname()}`;
    const secretKey = config.get('vultr.secretKey') || process.env.NODE_SECRET || '';
    
    // Vultr 연결이 비활성화된 경우
    if (process.env.VULTR_ENABLED === 'false') {
        logger.info('[Vultr] Vultr 연결 비활성화됨 (VULTR_ENABLED=false)');
        return null;
    }
    
    logger.info('[Vultr] 초기화 중...');
    logger.info(`[Vultr]   URL: ${vultrUrl}`);
    logger.info(`[Vultr]   Node ID: ${nodeId}`);
    
    // Command Executor 생성
    commandExecutor = new CommandExecutor({
        adbClient,
        laixiAdapter,
        logger
    });
    
    // Vultr Client 생성
    vultrClient = new VultrClient({
        nodeId,
        vultrUrl,
        secretKey,
        logger,
        heartbeatInterval: 30000
    });
    
    // 디바이스 스냅샷 프로바이더 설정
    vultrClient.setDeviceSnapshotProvider(async () => {
        try {
            const devices = await adbClient.listDevices();
            return devices.map((device, index) => ({
                slot: index + 1,
                serial: device.id,
                status: device.type === 'device' ? 'idle' : 'disconnected',
                battery_level: null,  // TODO: 배터리 레벨 조회
                persona_id: null
            }));
        } catch (err) {
            logger.warn('[Vultr] 디바이스 스냅샷 조회 실패', err);
            return [];
        }
    });
    
    // 명령 핸들러 설정
    vultrClient.setCommandHandler(async (command) => {
        return commandExecutor.execute(command);
    });
    
    // 이벤트 핸들러
    vultrClient.on('connected', ({ sessionId }) => {
        logger.info(`[Vultr] ✅ 연결됨 (session=${sessionId})`);
    });
    
    vultrClient.on('disconnected', ({ code, reason }) => {
        logger.warn(`[Vultr] ⚠️ 연결 끊김 (code=${code}, reason=${reason})`);
    });
    
    vultrClient.on('server_error', (error) => {
        logger.error('[Vultr] 서버 에러:', error);
    });
    
    // 연결 시작 (백그라운드)
    vultrClient.run().catch(err => {
        logger.error('[Vultr] 연결 루프 에러:', err);
    });
    
    return vultrClient;
}

/**
 * Vultr 연결 해제
 */
function shutdownVultrConnection() {
    if (vultrClient) {
        vultrClient.disconnect();
        vultrClient = null;
    }
}

/**
 * Vultr Client 인스턴스 반환
 */
function getVultrClient() {
    return vultrClient;
}

/**
 * Command Executor 인스턴스 반환
 */
function getCommandExecutor() {
    return commandExecutor;
}

module.exports = {
    initVultrConnection,
    shutdownVultrConnection,
    getVultrClient,
    getCommandExecutor
};

