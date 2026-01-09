/**
 * LaborService
 * 💰 Economy Activity (The Labor) - 노동과 보상
 * 
 * Pipeline: INPUT → STORE → PROCESS → ANALYZE → OUTPUT → FINAL_STORE
 * 
 * Proof of View (PoV) Verification:
 * 1. VIDEO_START event logged
 * 2. VIDEO_END event logged
 * 3. watch_duration >= video_duration × 0.9
 * 4. (end_ts - start_ts) >= watch_duration
 * 5. Random screenshot matches video content
 * 6. (citizen_id, video_id, commission_id) is unique
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec Aria's YouTube MCP Pipeline Specification v1.0 - Module 4
 */

const { logger } = require('../../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// 상수 정의
// ============================================================================

const LABOR_CONFIG = {
    // 시청 요구사항
    MIN_WATCH_PERCENTAGE: 90,           // 최소 90% 시청
    SCREENSHOT_REQUIRED_COUNT: 3,       // 필수 스크린샷 수
    
    // 보상 설정
    PERFECT_WATCH_BONUS_RATE: 0.1,      // 완벽 시청 10% 보너스
    
    // 존재감 보상
    EXISTENCE_REWARD_BASE: 0.01,
    EXISTENCE_REWARD_MAX: 0.03,
    
    // 기본 크레딧 범위
    MIN_CREDITS_REWARD: 1,
    MAX_CREDITS_REWARD: 100,
    
    // 우선순위
    PRIORITY: {
        URGENT: 2,
        NORMAL: 3,
        LOW: 4
    }
};

const VERIFICATION_CHECKS = {
    START_EVENT_VALID: 'start_event_valid',
    END_EVENT_VALID: 'end_event_valid',
    DURATION_SUFFICIENT: 'duration_sufficient',
    TIME_PLAUSIBLE: 'time_plausible',
    SCREENSHOTS_VALID: 'screenshots_valid',
    UNIQUE_COMPLETION: 'unique_completion'
};

// ============================================================================
// LaborService 클래스
// ============================================================================

class LaborService {
    constructor(options = {}) {
        this.supabase = createClient(
            options.supabaseUrl || process.env.SUPABASE_URL,
            options.supabaseKey || process.env.SUPABASE_SERVICE_KEY
        );
        this.youtubeApiKey = options.youtubeApiKey || process.env.YOUTUBE_API_KEY;
        
        logger.info('[LaborService] 초기화 완료');
    }

    // ========================================================================
    // Step 1: INPUT - Fetch Open Commissions
    // ========================================================================

    /**
     * 열린 의뢰 목록 조회
     * 
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async getCommissions(options = {}) {
        const {
            status = 'OPEN',
            priority,
            limit = 20
        } = options;

        logger.info('[Labor:Commissions] 의뢰 조회', { status, limit });

        try {
            let query = this.supabase
                .from('commissions')
                .select(`
                    commission_id,
                    video_id,
                    title,
                    commission_type_value,
                    priority,
                    credits_reward,
                    target_count,
                    completed_count,
                    expires_at,
                    youtube_videos!inner (
                        title,
                        duration_seconds,
                        thumbnail_url
                    )
                `)
                .eq('status', status)
                .order('priority', { ascending: true })
                .order('created_at', { ascending: true })
                .limit(limit);

            if (priority !== undefined) {
                query = query.eq('priority', priority);
            }

            // 만료되지 않은 의뢰만
            query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            const commissions = (data || []).map(c => ({
                commission_id: c.commission_id,
                video_id: c.video_id,
                title: c.title,
                commission_type: c.commission_type_value,
                priority: c.priority,
                credits_reward: c.credits_reward,
                target_count: c.target_count,
                completed_count: c.completed_count,
                remaining_slots: c.target_count - c.completed_count,
                expires_at: c.expires_at,
                video_info: {
                    title: c.youtube_videos.title,
                    duration_seconds: c.youtube_videos.duration_seconds,
                    thumbnail_url: c.youtube_videos.thumbnail_url
                }
            }));

            logger.info('[Labor:Commissions] 의뢰 조회 완료', { 
                count: commissions.length 
            });

            return {
                success: true,
                commissions,
                total_count: commissions.length
            };

        } catch (error) {
            logger.error('[Labor:Commissions] 조회 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 의뢰 생성 (Admin)
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async createCommission(params) {
        const {
            videoUrl,
            title,
            commissionType = 'WATCH_FULL',
            priority = LABOR_CONFIG.PRIORITY.NORMAL,
            creditsReward,
            targetCount = 1,
            expiresAt,
            createdBy = 'admin',
            memo
        } = params;

        logger.info('[Labor:Create] 의뢰 생성', { title, commissionType });

        try {
            // 1. Video ID 추출
            const videoId = this._extractVideoId(videoUrl);
            if (!videoId) {
                return { success: false, error: 'INVALID_VIDEO_URL' };
            }

            // 2. 영상 정보 조회 및 캐시
            const videoInfo = await this._fetchAndCacheVideo(videoId);
            if (!videoInfo) {
                return { success: false, error: 'VIDEO_NOT_FOUND' };
            }

            // 3. 크레딧 보상 검증
            const reward = Math.max(
                LABOR_CONFIG.MIN_CREDITS_REWARD,
                Math.min(LABOR_CONFIG.MAX_CREDITS_REWARD, creditsReward)
            );

            // 4. 의뢰 생성
            const { data, error } = await this.supabase
                .from('commissions')
                .insert({
                    video_id: videoId,
                    title,
                    commission_type_value: commissionType,
                    priority,
                    credits_reward: reward,
                    target_count: targetCount,
                    expires_at: expiresAt,
                    created_by: createdBy,
                    memo,
                    status: 'OPEN'
                })
                .select('commission_id')
                .single();

            if (error) {
                throw error;
            }

            logger.info('[Labor:Create] 의뢰 생성 완료', { 
                commissionId: data.commission_id 
            });

            return {
                success: true,
                commission_id: data.commission_id,
                video_id: videoId,
                credits_reward: reward
            };

        } catch (error) {
            logger.error('[Labor:Create] 생성 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 2: STORE - Assign Commission
    // ========================================================================

    /**
     * 의뢰 배정
     * 
     * @param {string} commissionId
     * @param {string} citizenId
     * @returns {Promise<Object>}
     */
    async assignCommission(commissionId, citizenId) {
        logger.info('[Labor:Assign] 의뢰 배정', { commissionId, citizenId });

        try {
            // 1. 의뢰 조회
            const { data: commission, error: commError } = await this.supabase
                .from('commissions')
                .select(`
                    *,
                    youtube_videos!inner (
                        title,
                        duration_seconds,
                        thumbnail_url
                    )
                `)
                .eq('commission_id', commissionId)
                .eq('status', 'OPEN')
                .single();

            if (commError || !commission) {
                return { success: false, error: 'COMMISSION_NOT_FOUND' };
            }

            // 2. 남은 슬롯 확인
            if (commission.completed_count >= commission.target_count) {
                return { success: false, error: 'COMMISSION_FULL' };
            }

            // 3. 중복 배정 확인
            const { data: existing } = await this.supabase
                .from('commission_assignments')
                .select('assignment_id')
                .eq('commission_id', commissionId)
                .eq('citizen_id', citizenId)
                .single();

            if (existing) {
                return { success: false, error: 'ALREADY_ASSIGNED' };
            }

            // 4. 시민의 현재 우선순위 계산
            const priorityAtAssign = await this._calculateCitizenPriority(citizenId);

            // 5. 배정 생성
            const { data: assignment, error: assignError } = await this.supabase
                .from('commission_assignments')
                .insert({
                    commission_id: commissionId,
                    citizen_id: citizenId,
                    priority_at_assign: priorityAtAssign,
                    status: 'PENDING'
                })
                .select('assignment_id')
                .single();

            if (assignError) {
                throw assignError;
            }

            // 6. 스크린샷 타임스탬프 생성 (랜덤)
            const duration = commission.youtube_videos.duration_seconds;
            const screenshotTimestamps = this._generateScreenshotTimestamps(duration);

            logger.info('[Labor:Assign] 의뢰 배정 완료', { 
                assignmentId: assignment.assignment_id 
            });

            return {
                success: true,
                assignment_id: assignment.assignment_id,
                commission: {
                    commission_id: commissionId,
                    video_id: commission.video_id,
                    video_url: `https://www.youtube.com/watch?v=${commission.video_id}`,
                    commission_type: commission.commission_type_value,
                    credits_reward: commission.credits_reward,
                    video_duration: duration
                },
                instructions: {
                    min_watch_percentage: LABOR_CONFIG.MIN_WATCH_PERCENTAGE / 100,
                    required_screenshots: LABOR_CONFIG.SCREENSHOT_REQUIRED_COUNT,
                    screenshot_intervals: screenshotTimestamps
                }
            };

        } catch (error) {
            logger.error('[Labor:Assign] 배정 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 시청 명령 생성
     */
    generateWatchCommand(assignmentId, commissionId, videoId, options = {}) {
        return {
            type: 'LABOR_WATCH',
            payload: {
                assignment_id: assignmentId,
                commission_id: commissionId,
                video_id: videoId,
                video_url: `https://www.youtube.com/watch?v=${videoId}`,
                video_duration: options.videoDuration || 0,
                instructions: {
                    min_watch_percentage: LABOR_CONFIG.MIN_WATCH_PERCENTAGE / 100,
                    screenshot_timestamps: options.screenshotTimestamps || [],
                    log_interval: 30 // 30초마다 진행 로그
                }
            },
            timestamp: new Date().toISOString()
        };
    }

    // ========================================================================
    // Step 3: PROCESS - Submit Proof
    // ========================================================================

    /**
     * 시청 증명 제출
     * 
     * @param {Object} proofData
     * @returns {Promise<Object>}
     */
    async submitProof(proofData) {
        const {
            assignmentId,
            commissionId,
            videoId,
            citizenId,
            startEvent,
            endEvent,
            videoDuration,
            watchDuration,
            screenshots,
            timelineEvents,
            finalTimestamp
        } = proofData;

        logger.info('[Labor:Proof] 증명 제출', { 
            assignmentId, 
            watchDuration,
            screenshotCount: screenshots?.length 
        });

        try {
            // videoDuration이 0이거나 비정상적인 경우 방어 처리
            let watchPercentage = 0;
            if (videoDuration && videoDuration > 0) {
                watchPercentage = (watchDuration / videoDuration) * 100;
                // 0-100 범위로 제한
                watchPercentage = Math.max(0, Math.min(100, watchPercentage));
            }

            // 1. 증명 저장
            const { data: proof, error: proofError } = await this.supabase
                .from('proof_submissions')
                .insert({
                    assignment_id: assignmentId,
                    citizen_id: citizenId,
                    commission_id: commissionId,
                    video_id: videoId,
                    start_event: startEvent,
                    end_event: endEvent,
                    video_duration: videoDuration,
                    watch_duration: watchDuration,
                    watch_percentage: watchPercentage,
                    screenshots: screenshots || [],
                    screenshot_count: screenshots?.length || 0,
                    timeline_events: timelineEvents || [],
                    final_timestamp: finalTimestamp,
                    verification_status: 'PENDING'
                })
                .select('proof_id')
                .single();

            if (proofError) {
                throw proofError;
            }

            // 2. 배정 상태 업데이트
            await this.supabase
                .from('commission_assignments')
                .update({
                    status: 'IN_PROGRESS',
                    started_at: startEvent.timestamp,
                    proof_data: { proof_id: proof.proof_id }
                })
                .eq('assignment_id', assignmentId);

            logger.info('[Labor:Proof] 증명 제출 완료', { 
                proofId: proof.proof_id 
            });

            return {
                success: true,
                proof_id: proof.proof_id,
                watch_percentage: watchPercentage
            };

        } catch (error) {
            logger.error('[Labor:Proof] 제출 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 4: ANALYZE - Proof of View Verification
    // ========================================================================

    /**
     * 시청 증명 검증
     * 
     * @param {string} proofId
     * @param {string} assignmentId
     * @returns {Promise<Object>}
     */
    async verifyProof(proofId, assignmentId) {
        logger.info('[Labor:Verify] 증명 검증 시작', { proofId, assignmentId });

        try {
            // 1. 증명 데이터 조회
            const { data: proof, error: proofError } = await this.supabase
                .from('proof_submissions')
                .select('*')
                .eq('proof_id', proofId)
                .single();

            if (proofError || !proof) {
                return { success: false, error: 'PROOF_NOT_FOUND' };
            }

            // 2. 6가지 검증 수행
            const checks = await this._performVerificationChecks(proof);

            // 3. 최종 결과 계산
            const failedChecks = Object.entries(checks)
                .filter(([_, passed]) => !passed)
                .map(([name, _]) => name);

            const passed = failedChecks.length === 0;
            const score = Object.values(checks).filter(v => v).length / 6;

            // 4. 검증 결과 저장
            await this.supabase
                .from('proof_submissions')
                .update({
                    verification_status: passed ? 'PASSED' : 'FAILED',
                    verification_checks: checks,
                    verified_at: new Date().toISOString()
                })
                .eq('proof_id', proofId);

            // 5. 배정 검증 결과 업데이트
            await this.supabase
                .from('commission_assignments')
                .update({
                    verified: passed,
                    verification_result: { checks, score, passed }
                })
                .eq('assignment_id', assignmentId);

            // 6. 적격 보상 계산
            let eligibleReward = 0;
            if (passed) {
                const { data: commission } = await this.supabase
                    .from('commissions')
                    .select('credits_reward')
                    .eq('commission_id', proof.commission_id)
                    .single();

                eligibleReward = commission?.credits_reward || 0;
                
                // 완벽 시청 보너스
                if (score >= 0.98) {
                    eligibleReward += Math.floor(eligibleReward * LABOR_CONFIG.PERFECT_WATCH_BONUS_RATE);
                }
            }

            logger.info('[Labor:Verify] 검증 완료', { 
                proofId, 
                passed, 
                score,
                eligibleReward 
            });

            return {
                success: true,
                proof_id: proofId,
                verification_result: {
                    passed,
                    checks,
                    failed_checks: failedChecks,
                    score
                },
                eligible_reward: eligibleReward
            };

        } catch (error) {
            logger.error('[Labor:Verify] 검증 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 5: OUTPUT - Credit Reward
    // ========================================================================

    /**
     * 크레딧 보상 지급
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async reward(params) {
        const {
            assignmentId,
            proofId,
            verificationPassed
        } = params;

        logger.info('[Labor:Reward] 보상 처리', { assignmentId, verificationPassed });

        try {
            if (!verificationPassed) {
                // 검증 실패 시 배정 실패 처리
                await this.supabase
                    .from('commission_assignments')
                    .update({ 
                        status: 'FAILED',
                        completed_at: new Date().toISOString()
                    })
                    .eq('assignment_id', assignmentId);

                return {
                    success: true,
                    reward: { base_credits: 0, bonus_credits: 0, total_credits: 0 },
                    new_balance: null
                };
            }

            // 1. 배정 및 증명 정보 조회
            const { data: assignment } = await this.supabase
                .from('commission_assignments')
                .select(`
                    citizen_id,
                    commission_id,
                    commissions!inner (credits_reward)
                `)
                .eq('assignment_id', assignmentId)
                .single();

            if (!assignment) {
                return { success: false, error: 'ASSIGNMENT_NOT_FOUND' };
            }

            // 2. 증명 정보 조회 (보너스 계산용)
            const { data: proof } = await this.supabase
                .from('proof_submissions')
                .select('watch_percentage, verification_checks')
                .eq('proof_id', proofId)
                .single();

            // 3. 보상 계산
            const baseCredits = assignment.commissions.credits_reward;
            let bonusCredits = 0;

            // 완벽 시청 보너스 (98% 이상)
            const checksScore = proof?.verification_checks 
                ? Object.values(proof.verification_checks).filter(v => v).length / 6
                : 0;

            if (checksScore >= 0.98) {
                bonusCredits = Math.floor(baseCredits * LABOR_CONFIG.PERFECT_WATCH_BONUS_RATE);
            }

            const totalCredits = baseCredits + bonusCredits;

            // 4. RPC로 트랜잭션 실행
            const { data: transactionResult, error: txError } = await this.supabase
                .rpc('execute_labor_transaction', {
                    p_citizen_id: assignment.citizen_id,
                    p_amount: totalCredits,
                    p_commission_id: assignment.commission_id,
                    p_proof_id: proofId,
                    p_proof_summary: {
                        video_id: proof?.video_id,
                        watch_duration: proof?.watch_duration,
                        watch_percentage: proof?.watch_percentage,
                        verification_score: checksScore
                    }
                });

            if (txError) {
                throw txError;
            }

            // 5. 배정 완료 처리
            await this.supabase
                .from('commission_assignments')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    credits_earned: totalCredits,
                    transaction_id: transactionResult?.[0]?.transaction_id
                })
                .eq('assignment_id', assignmentId);

            // 6. 존재감 업데이트
            const existenceChange = LABOR_CONFIG.EXISTENCE_REWARD_BASE + 
                (checksScore * (LABOR_CONFIG.EXISTENCE_REWARD_MAX - LABOR_CONFIG.EXISTENCE_REWARD_BASE));

            await this.supabase
                .rpc('update_citizen_existence', {
                    p_citizen_id: assignment.citizen_id,
                    p_existence_change: existenceChange,
                    p_activity_type: 'LABOR'
                });

            logger.info('[Labor:Reward] 보상 완료', { 
                assignmentId, 
                totalCredits,
                newBalance: transactionResult?.[0]?.new_balance 
            });

            return {
                success: true,
                transaction_id: transactionResult?.[0]?.transaction_id,
                reward: {
                    base_credits: baseCredits,
                    bonus_credits: bonusCredits,
                    total_credits: totalCredits
                },
                new_balance: transactionResult?.[0]?.new_balance
            };

        } catch (error) {
            logger.error('[Labor:Reward] 보상 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 6: FINAL_STORE - Transaction Log (handled in reward() via RPC)
    // ========================================================================

    // ========================================================================
    // Helper: Get Citizen Credit History
    // ========================================================================

    /**
     * 시민의 크레딧 거래 내역 조회
     * 
     * @param {string} citizenId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async getCreditHistory(citizenId, options = {}) {
        const { limit = 20, offset = 0 } = options;

        try {
            const { data, error, count } = await this.supabase
                .from('credit_transactions')
                .select('*', { count: 'exact' })
                .eq('citizen_id', citizenId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw error;
            }

            return {
                success: true,
                transactions: data || [],
                total_count: count || 0,
                has_more: (count || 0) > offset + limit
            };

        } catch (error) {
            logger.error('[Labor:History] 조회 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    _extractVideoId(url) {
        const patterns = [
            /[?&]v=([A-Za-z0-9_-]{11})/,
            /youtu\.be\/([A-Za-z0-9_-]{11})/,
            /embed\/([A-Za-z0-9_-]{11})/,
            /shorts\/([A-Za-z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match?.[1]) return match[1];
        }
        return null;
    }

    async _fetchAndCacheVideo(videoId) {
        // 캐시 확인
        const { data: cached } = await this.supabase
            .from('youtube_videos')
            .select('*')
            .eq('video_id', videoId)
            .single();

        if (cached) {
            return cached;
        }

        // API 조회
        if (!this.youtubeApiKey) {
            return {
                video_id: videoId,
                title: '제목 미확인',
                channel_name: '채널 미확인',
                duration_seconds: 300
            };
        }

        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/videos');
            url.searchParams.set('part', 'snippet,contentDetails');
            url.searchParams.set('id', videoId);
            url.searchParams.set('key', this.youtubeApiKey);

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!data.items?.[0]) return null;

            const item = data.items[0];
            const videoInfo = {
                video_id: videoId,
                title: item.snippet.title,
                channel_id: item.snippet.channelId,
                channel_name: item.snippet.channelTitle,
                description: item.snippet.description?.substring(0, 500),
                thumbnail_url: item.snippet.thumbnails?.medium?.url,
                duration_seconds: this._parseIsoDuration(item.contentDetails.duration)
            };

            // 캐시 저장
            await this.supabase
                .from('youtube_videos')
                .upsert({ ...videoInfo, fetched_at: new Date().toISOString() });

            return videoInfo;
        } catch {
            return null;
        }
    }

    async _calculateCitizenPriority(citizenId) {
        const { data: citizen } = await this.supabase
            .from('citizens')
            .select('existence_score, credits, last_active_at')
            .eq('citizen_id', citizenId)
            .single();

        if (!citizen) return 5;

        // 낮은 존재감 + 낮은 크레딧 = 높은 우선순위 (낮은 숫자)
        const existenceWeight = (1 - (citizen.existence_score || 0.5)) * 0.4;
        const creditsWeight = Math.max(0, 1 - (citizen.credits / 1000)) * 0.3;
        
        // 오래 비활성 = 높은 우선순위
        const lastActive = new Date(citizen.last_active_at || Date.now());
        const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
        const activityWeight = Math.min(1, hoursSinceActive / 24) * 0.3;

        const score = existenceWeight + creditsWeight + activityWeight;
        
        // 1-5 범위로 변환 (1이 가장 높은 우선순위)
        return Math.max(1, Math.min(5, Math.ceil((1 - score) * 5)));
    }

    _generateScreenshotTimestamps(duration) {
        const count = LABOR_CONFIG.SCREENSHOT_REQUIRED_COUNT;
        const timestamps = [];
        
        // 영상을 count+1 구간으로 나누고 각 구간에서 랜덤 선택
        const segmentSize = duration / (count + 1);
        
        for (let i = 1; i <= count; i++) {
            const baseTime = segmentSize * i;
            const variance = segmentSize * 0.3;
            const timestamp = Math.floor(
                baseTime + (Math.random() - 0.5) * 2 * variance
            );
            timestamps.push(Math.max(0, Math.min(duration, timestamp)));
        }

        return timestamps.sort((a, b) => a - b);
    }

    async _performVerificationChecks(proof) {
        const checks = {
            [VERIFICATION_CHECKS.START_EVENT_VALID]: false,
            [VERIFICATION_CHECKS.END_EVENT_VALID]: false,
            [VERIFICATION_CHECKS.DURATION_SUFFICIENT]: false,
            [VERIFICATION_CHECKS.TIME_PLAUSIBLE]: false,
            [VERIFICATION_CHECKS.SCREENSHOTS_VALID]: false,
            [VERIFICATION_CHECKS.UNIQUE_COMPLETION]: false
        };

        // Check 1: Start event 유효성
        checks[VERIFICATION_CHECKS.START_EVENT_VALID] = 
            proof.start_event != null && 
            proof.start_event.video_position !== undefined;

        // Check 2: End event 유효성
        checks[VERIFICATION_CHECKS.END_EVENT_VALID] = 
            proof.end_event != null &&
            proof.end_event.video_position !== undefined;

        // Check 3: 시청 시간 >= 90%
        checks[VERIFICATION_CHECKS.DURATION_SUFFICIENT] = 
            proof.watch_percentage >= LABOR_CONFIG.MIN_WATCH_PERCENTAGE;

        // Check 4: 시간 타당성 (end_ts - start_ts >= watch_duration)
        if (proof.start_event?.timestamp && proof.end_event?.timestamp) {
            const startTs = new Date(proof.start_event.timestamp).getTime();
            const endTs = new Date(proof.end_event.timestamp).getTime();
            const actualElapsed = (endTs - startTs) / 1000; // 초
            checks[VERIFICATION_CHECKS.TIME_PLAUSIBLE] = 
                actualElapsed >= proof.watch_duration * 0.9; // 10% 오차 허용
        }

        // Check 5: 스크린샷 유효성
        checks[VERIFICATION_CHECKS.SCREENSHOTS_VALID] = 
            proof.screenshot_count >= LABOR_CONFIG.SCREENSHOT_REQUIRED_COUNT;

        // Check 6: 고유성 (중복 완료 방지)
        const { data: existingCompletion } = await this.supabase
            .from('commission_assignments')
            .select('assignment_id')
            .eq('citizen_id', proof.citizen_id)
            .eq('commission_id', proof.commission_id)
            .eq('verified', true)
            .neq('assignment_id', proof.assignment_id)
            .single();

        checks[VERIFICATION_CHECKS.UNIQUE_COMPLETION] = !existingCompletion;

        return checks;
    }

    _parseIsoDuration(duration) {
        if (!duration) return 0;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        return (parseInt(match[1] || '0', 10) * 3600) +
               (parseInt(match[2] || '0', 10) * 60) +
               parseInt(match[3] || '0', 10);
    }
}

module.exports = LaborService;

