/**
 * SyncService
 * 클라이언트-서버 상태 동기화
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 1.2
 */

const logger = require('../../utils/logger');

// ============================================================================
// 상수 정의
// ============================================================================

// 검증 상수
const MAX_CREDITS_PER_HOUR = 100;           // 시간당 최대 크레딧 획득
const MAX_EXISTENCE_CHANGE_PER_HOUR = 0.1;  // 시간당 최대 existence 변화

// 동기화 액션
const SyncAction = {
    CLIENT_WINS: 'CLIENT_WINS',
    SERVER_WINS: 'SERVER_WINS',
    FRAUD_DETECTED: 'FRAUD_DETECTED'
};

// ============================================================================
// SyncService 클래스
// ============================================================================

class SyncService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // ========================================================================
    // 상태 동기화
    // ========================================================================

    /**
     * 클라이언트 상태와 서버 상태 동기화
     * @param {string} citizenId - 시민 UUID
     * @param {Object} clientState - 클라이언트에서 보낸 상태
     * @returns {Promise<Object>} 동기화 결과
     */
    async syncState(citizenId, clientState) {
        if (!this.supabase) {
            logger.warn('[SyncService] Supabase not initialized');
            return { action: SyncAction.SERVER_WINS, error: 'Database not available' };
        }

        try {
            // Step 1: 서버 상태 조회
            const { data: serverState, error } = await this.supabase
                .from('citizens')
                .select('*')
                .eq('citizen_id', citizenId)
                .single();

            if (error || !serverState) {
                logger.warn('[SyncService] Citizen not found', { citizenId });
                return { 
                    action: SyncAction.SERVER_WINS, 
                    error: 'Citizen not found' 
                };
            }

            // Step 2: 타임스탬프 비교
            const serverTs = new Date(serverState.updated_at).getTime();
            const clientTs = new Date(clientState.updated_at).getTime();

            // Step 3: 동기화 결정
            if (clientTs > serverTs) {
                // 클라이언트가 더 최신 - 검증 필요
                const validation = this.validateClientState(serverState, clientState);

                if (validation.isPlausible) {
                    // 클라이언트 상태 채택
                    await this.mergeClientToServer(citizenId, clientState);
                    
                    logger.info('[SyncService] Client wins', { citizenId });
                    return {
                        action: SyncAction.CLIENT_WINS,
                        finalState: clientState
                    };
                } else {
                    // 부정 행위 감지
                    await this.logAnomaly(citizenId, serverState, clientState, validation.anomalies);
                    
                    logger.warn('[SyncService] Fraud detected', { 
                        citizenId, 
                        anomalies: validation.anomalies 
                    });
                    return {
                        action: SyncAction.FRAUD_DETECTED,
                        finalState: this.toClientFormat(serverState),
                        anomalies: validation.anomalies
                    };
                }
            } else {
                // 서버가 더 최신 또는 동일
                logger.info('[SyncService] Server wins', { citizenId });
                return {
                    action: SyncAction.SERVER_WINS,
                    finalState: this.toClientFormat(serverState)
                };
            }

        } catch (err) {
            logger.error('[SyncService] syncState failed', { 
                error: err.message, 
                citizenId 
            });
            return { 
                action: SyncAction.SERVER_WINS, 
                error: err.message 
            };
        }
    }

    // ========================================================================
    // 상태 검증
    // ========================================================================

    /**
     * 클라이언트 상태 타당성 검증
     * @param {Object} serverState - 서버 상태
     * @param {Object} clientState - 클라이언트 상태
     * @returns {Object} 검증 결과
     */
    validateClientState(serverState, clientState) {
        const anomalies = [];

        // 시간 차이 계산 (시간 단위)
        const dtHours = (
            new Date(clientState.updated_at).getTime() -
            new Date(serverState.updated_at).getTime()
        ) / (1000 * 60 * 60);

        // Rule 1: Credits change
        const dCredits = clientState.credits - serverState.credits;
        if (dCredits > 0) {
            const maxEarn = MAX_CREDITS_PER_HOUR * dtHours;
            if (dCredits > maxEarn) {
                anomalies.push(
                    `Credits increased by ${dCredits} in ${dtHours.toFixed(2)}h ` +
                    `(max allowed: ${maxEarn.toFixed(0)})`
                );
            }
        }

        // Rule 2: Existence change
        const dExistence = Math.abs(clientState.existence_score - serverState.existence_score);
        const maxExistenceChange = MAX_EXISTENCE_CHANGE_PER_HOUR * dtHours;
        if (dExistence > maxExistenceChange) {
            anomalies.push(
                `Existence changed by ${dExistence.toFixed(3)} in ${dtHours.toFixed(2)}h ` +
                `(max allowed: ${maxExistenceChange.toFixed(3)})`
            );
        }

        // Rule 3: Task continuity
        if (clientState.last_task_id < serverState.last_task_id) {
            anomalies.push(
                `Task ID regressed: server=${serverState.last_task_id}, ` +
                `client=${clientState.last_task_id}`
            );
        }

        return {
            isPlausible: anomalies.length === 0,
            anomalies
        };
    }

    // ========================================================================
    // 상태 병합
    // ========================================================================

    /**
     * 클라이언트 상태를 서버에 병합
     * @param {string} citizenId - 시민 UUID
     * @param {Object} clientState - 클라이언트 상태
     */
    async mergeClientToServer(citizenId, clientState) {
        const updates = {
            credits: clientState.credits,
            existence_score: clientState.existence_score,
            last_task_id: clientState.last_task_id,
            last_task_type: clientState.last_task_type,
            updated_at: clientState.updated_at,
            last_seen_at: new Date().toISOString()
        };

        await this.supabase
            .from('citizens')
            .update(updates)
            .eq('citizen_id', citizenId);
    }

    // ========================================================================
    // 이상 기록
    // ========================================================================

    /**
     * 이상 탐지 로그 기록
     * @param {string} citizenId - 시민 UUID
     * @param {Object} serverState - 서버 상태
     * @param {Object} clientState - 클라이언트 상태
     * @param {Array} anomalies - 탐지된 이상 목록
     */
    async logAnomaly(citizenId, serverState, clientState, anomalies) {
        logger.warn('[SyncService] Anomaly detected', {
            citizenId,
            anomalies,
            serverState: {
                credits: serverState.credits,
                existence_score: serverState.existence_score,
                updated_at: serverState.updated_at
            },
            clientState: {
                credits: clientState.credits,
                existence_score: clientState.existence_score,
                updated_at: clientState.updated_at
            }
        });

        // TODO: anomaly_logs 테이블에 기록 (선택적)
    }

    // ========================================================================
    // 포맷 변환
    // ========================================================================

    /**
     * 서버 상태를 클라이언트 형식으로 변환
     * @param {Object} serverState - DB 레코드
     * @returns {Object} 클라이언트 형식 상태
     */
    toClientFormat(serverState) {
        return {
            citizen_id: serverState.citizen_id,
            name: serverState.name,
            credits: serverState.credits,
            existence_score: serverState.existence_score,
            last_task_id: serverState.last_task_id || 0,
            last_task_type: serverState.last_task_type,
            updated_at: serverState.updated_at,
            sync_version: 1
        };
    }
}

// 상수 내보내기
SyncService.SyncAction = SyncAction;
SyncService.MAX_CREDITS_PER_HOUR = MAX_CREDITS_PER_HOUR;

module.exports = SyncService;

