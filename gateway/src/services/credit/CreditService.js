/**
 * CreditService
 * 크레딧 거래 및 경제 시스템 관리
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 3.2
 */

const logger = require('../../utils/logger');

// ============================================================================
// 상수 정의
// ============================================================================

// 거래 타입
const TransactionType = {
    VIEW_REWARD: 'VIEW_REWARD',
    ACCIDENT_PENALTY: 'ACCIDENT_PENALTY',
    DILEMMA_REWARD: 'DILEMMA_REWARD',
    ADMIN_GRANT: 'ADMIN_GRANT',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT'
};

// 보상 상수
const CREDITS_PER_MINUTE = 5;        // 분당 기본 보상
const COMPLETION_BONUS = 10;         // 100% 시청 보너스
const MAX_CREDITS_PER_VIDEO = 100;   // 비디오당 최대 보상

// ============================================================================
// CreditService 클래스
// ============================================================================

class CreditService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // ========================================================================
    // 핵심 트랜잭션 함수
    // ========================================================================

    /**
     * 크레딧 거래 실행 (Supabase RPC 사용)
     * @param {string} citizenId - 시민 UUID
     * @param {string} transactionType - 거래 타입
     * @param {number} amount - 금액 (양수: 획득, 음수: 차감)
     * @param {Object} options - 추가 옵션
     * @param {string} [options.referenceType] - 참조 타입
     * @param {string} [options.referenceId] - 참조 ID
     * @param {string} [options.description] - 설명
     * @returns {Promise<Object>} 거래 결과
     */
    async executeTransaction(citizenId, transactionType, amount, options = {}) {
        if (!this.supabase) {
            logger.warn('[CreditService] Supabase not initialized');
            return { success: false, error: 'Database not available' };
        }

        try {
            const { data, error } = await this.supabase.rpc('execute_credit_transaction', {
                p_citizen_id: citizenId,
                p_transaction_type: transactionType,
                p_amount: amount,
                p_reference_type: options.referenceType || null,
                p_reference_id: options.referenceId || null,
                p_description: options.description || null
            });

            if (error) {
                logger.error('[CreditService] Transaction RPC failed', { error, citizenId });
                throw error;
            }

            const result = data[0];

            if (!result.success) {
                logger.warn(`[CreditService] Transaction failed: ${result.error_message}`, {
                    citizenId,
                    amount,
                    transactionType
                });
                return {
                    success: false,
                    error: result.error_message,
                    currentBalance: result.new_balance
                };
            }

            logger.info(`[CreditService] Transaction completed`, {
                citizenId,
                transactionId: result.transaction_id,
                amount,
                newBalance: result.new_balance
            });

            return {
                success: true,
                transactionId: result.transaction_id,
                newBalance: result.new_balance
            };

        } catch (err) {
            logger.error('[CreditService] executeTransaction failed', { 
                error: err.message, 
                citizenId 
            });
            return { success: false, error: err.message };
        }
    }

    // ========================================================================
    // 시청 보상
    // ========================================================================

    /**
     * 시청 보상 계산
     * @param {number} videoDurationSeconds - 비디오 길이 (초)
     * @param {number} watchPercentage - 시청 비율 (0-1)
     * @returns {number} 보상 크레딧
     */
    calculateViewReward(videoDurationSeconds, watchPercentage) {
        // 분당 5크레딧
        const minutesWatched = (videoDurationSeconds * watchPercentage) / 60;
        const baseReward = Math.floor(minutesWatched * CREDITS_PER_MINUTE);

        // 98% 이상 시청 시 보너스
        const completionBonus = watchPercentage >= 0.98 ? COMPLETION_BONUS : 0;

        // 비디오당 최대 100크레딧
        return Math.min(baseReward + completionBonus, MAX_CREDITS_PER_VIDEO);
    }

    /**
     * 시청 보상 지급
     * @param {string} citizenId - 시민 UUID
     * @param {string} viewId - 검증된 시청 ID
     * @param {number} credits - 지급할 크레딧
     * @returns {Promise<Object>} 거래 결과
     */
    async rewardView(citizenId, viewId, credits) {
        return this.executeTransaction(
            citizenId,
            TransactionType.VIEW_REWARD,
            credits,
            {
                referenceType: 'VERIFIED_VIEW',
                referenceId: viewId,
                description: `시청 보상: ${credits} 크레딧`
            }
        );
    }

    // ========================================================================
    // Accident 페널티
    // ========================================================================

    /**
     * Accident 페널티 적용
     * @param {string} citizenId - 시민 UUID
     * @param {string} accidentId - Accident ID
     * @param {number} penalty - 차감할 크레딧 (양수로 입력)
     * @returns {Promise<Object>} 거래 결과
     */
    async penalizeAccident(citizenId, accidentId, penalty) {
        const result = await this.executeTransaction(
            citizenId,
            TransactionType.ACCIDENT_PENALTY,
            -Math.abs(penalty), // 음수로 변환
            {
                referenceType: 'ACCIDENT',
                referenceId: accidentId,
                description: `Accident 페널티: -${Math.abs(penalty)} 크레딧`
            }
        );

        // 잔액 부족 시 0으로 설정
        if (!result.success && result.error === 'Insufficient credits') {
            logger.info(`[CreditService] Setting balance to 0 for citizen ${citizenId}`);
            
            await this.supabase
                .from('citizens')
                .update({ credits: 0, last_seen_at: new Date().toISOString() })
                .eq('citizen_id', citizenId);

            return {
                success: true,
                newBalance: 0,
                note: 'Balance reduced to 0'
            };
        }

        return result;
    }

    // ========================================================================
    // Dilemma 보상
    // ========================================================================

    /**
     * Dilemma 선택 보상 지급
     * @param {string} citizenId - 시민 UUID
     * @param {string} accidentId - Accident ID
     * @param {number} bonus - 보너스 크레딧
     * @returns {Promise<Object>} 거래 결과
     */
    async rewardDilemma(citizenId, accidentId, bonus) {
        return this.executeTransaction(
            citizenId,
            TransactionType.DILEMMA_REWARD,
            bonus,
            {
                referenceType: 'ACCIDENT',
                referenceId: accidentId,
                description: `Dilemma 보너스: ${bonus} 크레딧`
            }
        );
    }

    // ========================================================================
    // 관리자 기능
    // ========================================================================

    /**
     * 관리자 크레딧 지급
     * @param {string} citizenId - 시민 UUID
     * @param {number} amount - 지급할 크레딧
     * @param {string} reason - 지급 사유
     * @returns {Promise<Object>} 거래 결과
     */
    async adminGrant(citizenId, amount, reason) {
        return this.executeTransaction(
            citizenId,
            TransactionType.ADMIN_GRANT,
            amount,
            {
                description: `관리자 지급: ${reason}`
            }
        );
    }

    // ========================================================================
    // 조회
    // ========================================================================

    /**
     * 시민의 현재 잔액 조회
     * @param {string} citizenId - 시민 UUID
     * @returns {Promise<number|null>} 잔액
     */
    async getBalance(citizenId) {
        if (!this.supabase) return null;

        try {
            const { data, error } = await this.supabase
                .from('citizens')
                .select('credits')
                .eq('citizen_id', citizenId)
                .single();

            if (error) throw error;
            return data?.credits ?? null;
        } catch (err) {
            logger.error('[CreditService] getBalance failed', { error: err.message, citizenId });
            return null;
        }
    }

    /**
     * 시민의 거래 내역 조회
     * @param {string} citizenId - 시민 UUID
     * @param {Object} options - 조회 옵션
     * @param {number} [options.limit=50] - 조회 개수
     * @param {number} [options.offset=0] - 오프셋
     * @returns {Promise<Array>} 거래 내역
     */
    async getTransactions(citizenId, options = {}) {
        if (!this.supabase) return [];

        const { limit = 50, offset = 0 } = options;

        try {
            const { data, error } = await this.supabase
                .from('credit_transactions')
                .select('*')
                .eq('citizen_id', citizenId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error('[CreditService] getTransactions failed', { error: err.message, citizenId });
            return [];
        }
    }

    /**
     * 전체 경제 통계 조회
     * @returns {Promise<Object>} 통계 데이터
     */
    async getEconomyStats() {
        if (!this.supabase) return null;

        try {
            // 전체 크레딧 합계
            const { data: totalData, error: totalError } = await this.supabase
                .from('citizens')
                .select('credits');

            if (totalError) throw totalError;

            const totalCredits = totalData.reduce((sum, c) => sum + (c.credits || 0), 0);
            const avgCredits = totalData.length > 0 ? totalCredits / totalData.length : 0;

            // 오늘 거래 통계
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data: todayData, error: todayError } = await this.supabase
                .from('credit_transactions')
                .select('amount, transaction_type')
                .gte('created_at', today.toISOString());

            if (todayError) throw todayError;

            const todayStats = {
                totalTransactions: todayData.length,
                totalEarned: todayData
                    .filter(t => t.amount > 0)
                    .reduce((sum, t) => sum + t.amount, 0),
                totalSpent: Math.abs(todayData
                    .filter(t => t.amount < 0)
                    .reduce((sum, t) => sum + t.amount, 0))
            };

            return {
                totalCreditsInCirculation: totalCredits,
                averageCreditsPerCitizen: Math.round(avgCredits),
                citizenCount: totalData.length,
                today: todayStats
            };
        } catch (err) {
            logger.error('[CreditService] getEconomyStats failed', { error: err.message });
            return null;
        }
    }
}

// 상수 내보내기
CreditService.TransactionType = TransactionType;
CreditService.CREDITS_PER_MINUTE = CREDITS_PER_MINUTE;
CreditService.MAX_CREDITS_PER_VIDEO = MAX_CREDITS_PER_VIDEO;

module.exports = CreditService;

