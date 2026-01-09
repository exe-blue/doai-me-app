/**
 * PoVService (Proof of View)
 * 시청 증명 검증 시스템
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 3.1
 */

const logger = require('../../utils/logger');
const CreditService = require('../credit/CreditService');

// ============================================================================
// 상수 정의
// ============================================================================

// 시청 검증 임계값
const POV_THRESHOLD = 0.9;              // 90% 시청 필요
const TIME_TOLERANCE = 0.95;            // 시간 오차 허용 (5%)
const MIN_WATCH_SECONDS = 30;           // 최소 시청 시간

// 이벤트 타입
const EventType = {
    VIDEO_START: 'VIDEO_START',
    VIDEO_END: 'VIDEO_END'
};

// 검증 실패 사유
const VerificationError = {
    NO_START_EVENT: 'NO_START_EVENT',
    ALREADY_REWARDED: 'ALREADY_REWARDED',
    INSUFFICIENT_WATCH_TIME: 'INSUFFICIENT_WATCH_TIME',
    TIME_MANIPULATION: 'TIME_MANIPULATION',
    INVALID_VIDEO: 'INVALID_VIDEO',
    DATABASE_ERROR: 'DATABASE_ERROR'
};

// ============================================================================
// PoVService 클래스
// ============================================================================

class PoVService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.creditService = new CreditService(supabaseClient);
    }

    // ========================================================================
    // 시청 이벤트 기록
    // ========================================================================

    /**
     * VIDEO_START 이벤트 기록
     * @param {string} citizenId - 시민 UUID
     * @param {string} videoId - YouTube Video ID
     * @param {Date} timestamp - 이벤트 발생 시간
     * @returns {Promise<Object>} 저장 결과
     */
    async recordStart(citizenId, videoId, timestamp = new Date()) {
        if (!this.supabase) {
            logger.warn('[PoVService] Supabase not initialized');
            return { success: false, error: 'Database not available' };
        }

        try {
            const { data, error } = await this.supabase
                .from('view_events')
                .insert({
                    citizen_id: citizenId,
                    video_id: videoId,
                    event_type: EventType.VIDEO_START,
                    event_timestamp: timestamp.toISOString()
                })
                .select()
                .single();

            if (error) {
                // 중복 이벤트는 무시
                if (error.code === '23505') { // unique_violation
                    logger.debug('[PoVService] Duplicate start event ignored', { citizenId, videoId });
                    return { success: true, duplicate: true };
                }
                throw error;
            }

            logger.info(`[PoVService] VIDEO_START recorded`, { citizenId, videoId });
            return { success: true, eventId: data.event_id };

        } catch (err) {
            logger.error('[PoVService] recordStart failed', { error: err.message, citizenId, videoId });
            return { success: false, error: err.message };
        }
    }

    /**
     * VIDEO_END 이벤트 기록 및 검증
     * @param {string} citizenId - 시민 UUID
     * @param {string} videoId - YouTube Video ID
     * @param {number} watchDurationSeconds - 실제 시청 시간 (초)
     * @param {number} videoDurationSeconds - 비디오 총 길이 (초)
     * @param {Date} timestamp - 이벤트 발생 시간
     * @returns {Promise<Object>} 검증 결과
     */
    async recordEndAndVerify(citizenId, videoId, watchDurationSeconds, videoDurationSeconds, timestamp = new Date()) {
        if (!this.supabase) {
            logger.warn('[PoVService] Supabase not initialized');
            return { verified: false, error: 'Database not available' };
        }

        try {
            // Step 1: VIDEO_END 이벤트 저장
            const { data: endEvent, error: endError } = await this.supabase
                .from('view_events')
                .insert({
                    citizen_id: citizenId,
                    video_id: videoId,
                    event_type: EventType.VIDEO_END,
                    event_timestamp: timestamp.toISOString(),
                    watch_duration_seconds: watchDurationSeconds
                })
                .select()
                .single();

            if (endError && endError.code !== '23505') {
                throw endError;
            }

            // Step 2: 검증 실행
            const verificationResult = await this.verifyView(
                citizenId,
                videoId,
                watchDurationSeconds,
                videoDurationSeconds,
                endEvent?.event_id
            );

            return verificationResult;

        } catch (err) {
            logger.error('[PoVService] recordEndAndVerify failed', { 
                error: err.message, 
                citizenId, 
                videoId 
            });
            return { 
                verified: false, 
                error: VerificationError.DATABASE_ERROR,
                message: err.message 
            };
        }
    }

    // ========================================================================
    // 시청 검증
    // ========================================================================

    /**
     * 시청 검증
     * @param {string} citizenId - 시민 UUID
     * @param {string} videoId - YouTube Video ID
     * @param {number} watchDurationSeconds - 실제 시청 시간 (초)
     * @param {number} videoDurationSeconds - 비디오 총 길이 (초)
     * @param {string} endEventId - VIDEO_END 이벤트 ID
     * @returns {Promise<Object>} 검증 결과
     */
    async verifyView(citizenId, videoId, watchDurationSeconds, videoDurationSeconds, endEventId) {
        
        // Criterion 1: Start event 확인
        const { data: startEvent, error: startError } = await this.supabase
            .from('view_events')
            .select('*')
            .eq('citizen_id', citizenId)
            .eq('video_id', videoId)
            .eq('event_type', EventType.VIDEO_START)
            .order('event_timestamp', { ascending: false })
            .limit(1)
            .single();

        if (startError || !startEvent) {
            logger.warn('[PoVService] No start event found', { citizenId, videoId });
            return {
                verified: false,
                creditsEarned: 0,
                error: VerificationError.NO_START_EVENT,
                message: 'No VIDEO_START event found'
            };
        }

        // Criterion 5: 이미 보상 받았는지 확인
        const { data: existingView } = await this.supabase
            .from('verified_views')
            .select('view_id')
            .eq('citizen_id', citizenId)
            .eq('video_id', videoId)
            .single();

        if (existingView) {
            logger.info('[PoVService] Already rewarded', { citizenId, videoId });
            return {
                verified: false,
                creditsEarned: 0,
                error: VerificationError.ALREADY_REWARDED,
                message: 'This video has already been rewarded'
            };
        }

        // Criterion 3: Duration validation (90% 이상)
        const watchPercentage = watchDurationSeconds / videoDurationSeconds;

        if (watchPercentage < POV_THRESHOLD) {
            logger.info('[PoVService] Insufficient watch time', { 
                citizenId, 
                videoId,
                watchPercentage: (watchPercentage * 100).toFixed(1) 
            });
            return {
                verified: false,
                creditsEarned: 0,
                error: VerificationError.INSUFFICIENT_WATCH_TIME,
                message: `Watch percentage ${(watchPercentage * 100).toFixed(1)}% < 90%`
            };
        }

        // Criterion 4: Time plausibility
        const startTs = new Date(startEvent.event_timestamp).getTime();
        const endTs = Date.now();
        const realElapsed = (endTs - startTs) / 1000;

        if (realElapsed < watchDurationSeconds * TIME_TOLERANCE) {
            logger.warn('[PoVService] Time manipulation detected', {
                citizenId,
                videoId,
                reportedDuration: watchDurationSeconds,
                realElapsed
            });
            return {
                verified: false,
                creditsEarned: 0,
                error: VerificationError.TIME_MANIPULATION,
                message: `Reported ${watchDurationSeconds}s in ${realElapsed.toFixed(0)}s real time`
            };
        }

        // 모든 검증 통과 - 보상 계산 및 지급
        const creditsEarned = this.creditService.calculateViewReward(
            videoDurationSeconds,
            watchPercentage
        );

        // Verified view 레코드 생성
        const { data: verifiedView, error: insertError } = await this.supabase
            .from('verified_views')
            .insert({
                citizen_id: citizenId,
                video_id: videoId,
                video_duration_seconds: videoDurationSeconds,
                watch_duration_seconds: watchDurationSeconds,
                watch_percentage: Math.round(watchPercentage * 100),
                start_event_id: startEvent.event_id,
                end_event_id: endEventId,
                credits_earned: creditsEarned
            })
            .select()
            .single();

        if (insertError) {
            // unique constraint violation = already rewarded
            if (insertError.code === '23505') {
                return {
                    verified: false,
                    creditsEarned: 0,
                    error: VerificationError.ALREADY_REWARDED,
                    message: 'This video has already been rewarded'
                };
            }
            throw insertError;
        }

        // 보상 지급
        const rewardResult = await this.creditService.rewardView(
            citizenId,
            verifiedView.view_id,
            creditsEarned
        );

        // 트랜잭션 ID 업데이트
        if (rewardResult.success) {
            await this.supabase
                .from('verified_views')
                .update({ reward_transaction_id: rewardResult.transactionId })
                .eq('view_id', verifiedView.view_id);
        }

        logger.info('[PoVService] View verified and rewarded', {
            citizenId,
            videoId,
            creditsEarned,
            watchPercentage: (watchPercentage * 100).toFixed(1)
        });

        return {
            verified: true,
            creditsEarned,
            viewId: verifiedView.view_id,
            newBalance: rewardResult.newBalance
        };
    }

    // ========================================================================
    // 조회
    // ========================================================================

    /**
     * 시민의 시청 기록 조회
     * @param {string} citizenId - 시민 UUID
     * @param {Object} options - 조회 옵션
     * @returns {Promise<Array>} 시청 기록
     */
    async getViewHistory(citizenId, options = {}) {
        if (!this.supabase) return [];

        const { limit = 50, offset = 0 } = options;

        try {
            const { data, error } = await this.supabase
                .from('verified_views')
                .select('*')
                .eq('citizen_id', citizenId)
                .order('verified_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error('[PoVService] getViewHistory failed', { error: err.message, citizenId });
            return [];
        }
    }

    /**
     * 비디오 시청 여부 확인
     * @param {string} citizenId - 시민 UUID
     * @param {string} videoId - Video ID
     * @returns {Promise<boolean>} 시청 여부
     */
    async hasWatched(citizenId, videoId) {
        if (!this.supabase) return false;

        try {
            const { data } = await this.supabase
                .from('verified_views')
                .select('view_id')
                .eq('citizen_id', citizenId)
                .eq('video_id', videoId)
                .single();

            return !!data;
        } catch {
            return false;
        }
    }

    /**
     * 전체 시청 통계 조회
     * @returns {Promise<Object>} 통계 데이터
     */
    async getViewStats() {
        if (!this.supabase) return null;

        try {
            // 전체 시청 수
            const { count: totalViews } = await this.supabase
                .from('verified_views')
                .select('*', { count: 'exact', head: true });

            // 오늘 시청 수
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { count: todayViews } = await this.supabase
                .from('verified_views')
                .select('*', { count: 'exact', head: true })
                .gte('verified_at', today.toISOString());

            // 총 시청 시간
            const { data: durationData } = await this.supabase
                .from('verified_views')
                .select('watch_duration_seconds');

            const totalWatchSeconds = durationData?.reduce((sum, v) => sum + (v.watch_duration_seconds || 0), 0) || 0;

            return {
                totalViews,
                todayViews,
                totalWatchTimeHours: Math.round(totalWatchSeconds / 3600 * 10) / 10
            };
        } catch (err) {
            logger.error('[PoVService] getViewStats failed', { error: err.message });
            return null;
        }
    }
}

// 상수 내보내기
PoVService.EventType = EventType;
PoVService.VerificationError = VerificationError;
PoVService.POV_THRESHOLD = POV_THRESHOLD;

module.exports = PoVService;

