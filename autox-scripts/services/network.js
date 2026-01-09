/**
 * Network Service
 * HTTP 통신 모듈
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - Gateway REST Endpoint로 응답 전송
 * - 오프라인 시 파일 기록 후 ADB pull
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

const OFFLINE_QUEUE_PATH = '/sdcard/doai/offline_queue';

class NetworkService {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config || {};
        this.gatewayUrl = this._buildGatewayUrl();
        this.offlineMode = false;
        this.retryQueue = [];
    }

    /**
     * Gateway URL 빌드
     */
    _buildGatewayUrl() {
        const server = this.config.server || {};
        const protocol = server.protocol || 'http';
        const host = server.host || '127.0.0.1';
        const port = server.port || 3100;
        return `${protocol}://${host}:${port}`;
    }

    /**
     * 헬스 체크
     * @returns {boolean}
     */
    healthCheck() {
        try {
            const response = http.get(`${this.gatewayUrl}/health`, {
                timeout: 5000
            });

            if (response && response.statusCode === 200) {
                this.offlineMode = false;
                this.logger.debug('[Network] Gateway 연결 확인');
                return true;
            }
        } catch (e) {
            this.logger.warn('[Network] Gateway 연결 실패', { error: e.message });
        }

        this.offlineMode = true;
        return false;
    }

    /**
     * 응답 전송 (Result Report)
     * @param {Object} result - 처리 결과
     * @returns {boolean}
     */
    report(result) {
        const endpoint = '/api/v1/response';
        
        // 응답 envelope 생성
        const response = {
            v: 1,
            msg_id: result.msg_id,
            device_id: this.config.device?.id || device.serial,
            ts: Date.now(),
            status: result.status,
            result: result.result,
            metrics: result.metrics
        };

        return this._post(endpoint, response);
    }

    /**
     * HTTP POST 요청
     * @param {string} endpoint - API 엔드포인트
     * @param {Object} data - 전송 데이터
     * @returns {boolean}
     */
    _post(endpoint, data) {
        const url = `${this.gatewayUrl}${endpoint}`;

        this.logger.debug('[Network] POST 요청', { 
            url, 
            msg_id: data.msg_id 
        });

        try {
            const response = http.postJson(url, data, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-ID': this.config.device?.id || device.serial
                }
            });

            if (response && response.statusCode >= 200 && response.statusCode < 300) {
                this.logger.debug('[Network] POST 성공', { 
                    statusCode: response.statusCode 
                });
                return true;
            } else {
                this.logger.warn('[Network] POST 실패', { 
                    statusCode: response?.statusCode 
                });
                this._queueForOffline(endpoint, data);
                return false;
            }

        } catch (e) {
            this.logger.error('[Network] POST 오류', { 
                error: e.message 
            });
            this._queueForOffline(endpoint, data);
            return false;
        }
    }

    /**
     * HTTP GET 요청
     * @param {string} endpoint - API 엔드포인트
     * @returns {Object|null}
     */
    get(endpoint) {
        const url = `${this.gatewayUrl}${endpoint}`;

        try {
            const response = http.get(url, {
                timeout: 10000,
                headers: {
                    'X-Device-ID': this.config.device?.id || device.serial
                }
            });

            if (response && response.statusCode === 200) {
                return JSON.parse(response.body.string());
            }
        } catch (e) {
            this.logger.error('[Network] GET 오류', { error: e.message });
        }

        return null;
    }

    /**
     * 오프라인 큐에 저장
     */
    _queueForOffline(endpoint, data) {
        this.logger.debug('[Network] 오프라인 큐 저장', { 
            endpoint,
            msg_id: data.msg_id 
        });

        try {
            // 디렉토리 확인
            if (!files.exists(OFFLINE_QUEUE_PATH)) {
                files.ensureDir(OFFLINE_QUEUE_PATH + '/');
            }

            // 파일 저장
            const filename = `${Date.now()}_${data.msg_id || 'unknown'}.json`;
            const filepath = OFFLINE_QUEUE_PATH + '/' + filename;

            const queueItem = {
                endpoint,
                data,
                queued_at: Date.now(),
                retry_count: 0
            };

            files.write(filepath, JSON.stringify(queueItem, null, 2));

        } catch (e) {
            this.logger.error('[Network] 오프라인 큐 저장 실패', { error: e.message });
        }
    }

    /**
     * 오프라인 큐 처리 (재연결 시)
     */
    processOfflineQueue() {
        if (!files.exists(OFFLINE_QUEUE_PATH)) {
            return 0;
        }

        const queueFiles = files.listDir(OFFLINE_QUEUE_PATH);
        let processed = 0;

        for (const file of queueFiles) {
            if (!file.endsWith('.json')) continue;

            const filepath = OFFLINE_QUEUE_PATH + '/' + file;

            try {
                const content = files.read(filepath);
                const item = JSON.parse(content);

                // 재전송 시도
                const success = this._post(item.endpoint, item.data);

                if (success) {
                    // 성공 시 파일 삭제
                    files.remove(filepath);
                    processed++;
                } else {
                    // 실패 시 재시도 카운트 증가
                    item.retry_count++;
                    if (item.retry_count >= 3) {
                        // 3회 실패 시 삭제
                        files.remove(filepath);
                        this.logger.warn('[Network] 큐 항목 포기', { 
                            msg_id: item.data.msg_id 
                        });
                    } else {
                        files.write(filepath, JSON.stringify(item, null, 2));
                    }
                }

            } catch (e) {
                this.logger.error('[Network] 큐 처리 오류', { 
                    file, 
                    error: e.message 
                });
            }
        }

        if (processed > 0) {
            this.logger.info('[Network] 오프라인 큐 처리', { processed });
        }

        return processed;
    }

    /**
     * 로그 업로드
     * @param {string} endpoint - 업로드 엔드포인트
     * @param {Array} logs - 로그 배열
     */
    uploadLogs(endpoint, logs) {
        return this._post(endpoint, {
            device_id: this.config.device?.id || device.serial,
            logs,
            uploaded_at: Date.now()
        });
    }

    /**
     * 스크린샷 업로드
     * @param {string} endpoint - 업로드 엔드포인트
     * @param {string} filepath - 파일 경로
     */
    uploadScreenshot(endpoint, filepath) {
        const url = `${this.gatewayUrl}${endpoint}`;

        try {
            const response = http.postMultipart(url, {
                file: open(filepath),
                device_id: this.config.device?.id || device.serial,
                timestamp: Date.now()
            });

            return response && response.statusCode === 200;
        } catch (e) {
            this.logger.error('[Network] 스크린샷 업로드 실패', { error: e.message });
            return false;
        }
    }

    /**
     * 오프라인 모드 여부
     */
    isOffline() {
        return this.offlineMode;
    }

    /**
     * Gateway URL 업데이트
     */
    updateGatewayUrl(config) {
        this.config = config;
        this.gatewayUrl = this._buildGatewayUrl();
        this.logger.info('[Network] Gateway URL 업데이트', { url: this.gatewayUrl });
    }
}

module.exports = NetworkService;
module.exports.OFFLINE_QUEUE_PATH = OFFLINE_QUEUE_PATH;

