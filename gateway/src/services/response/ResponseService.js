/**
 * ResponseService
 * 🔥 Accident Activity (The Response) - 재해 대응
 * 
 * Pipeline: INPUT → STORE → ANALYZE → PROCESS → OUTPUT → FINAL_STORE
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec Aria's YouTube MCP Pipeline Specification v1.0 - Module 3
 */

const { logger } = require('../../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// 상수 정의
// ============================================================================

const RESPONSE_CONFIG = {
    // 위험도별 우선순위
    SEVERITY_PRIORITY: {
        CATASTROPHIC: 0,
        SEVERE: 1,
        MODERATE: 2,
        MINOR: 3
    },
    
    // 기본 대응 비율
    DEFAULT_TARGET_PERCENTAGE: 100,
    
    // 위험 키워드
    DANGEROUS_KEYWORDS: {
        CATASTROPHIC: ['테러', '폭발', '사망자', '긴급대피', '대형사고', '붕괴'],
        SEVERE: ['가짜뉴스', '사기', '혐오발언', '폭력', '범죄', '사칭'],
        MODERATE: ['논란', '비판', '루머', '의혹', '조작', '왜곡'],
        MINOR: ['광고', '클릭베이트', '과장', '낚시']
    },
    
    // 존재감 보상 (위기 대응)
    EXISTENCE_REWARD: {
        MINOR: 0.05,
        MODERATE: 0.08,
        SEVERE: 0.12,
        CATASTROPHIC: 0.15
    },
    
    // 크레딧 보상
    CREDITS_REWARD: {
        MINOR: 5,
        MODERATE: 10,
        SEVERE: 20,
        CATASTROPHIC: 50
    }
};

const CRITICAL_COMMENT_TEMPLATES = {
    FAKE_NEWS: [
        '⚠️ 이 영상의 정보는 사실과 다릅니다. 공식 출처를 확인해주세요.',
        '❌ 팩트체크 결과 허위정보로 확인되었습니다.',
        '🔍 신뢰할 수 있는 정보인지 다시 확인해주세요.'
    ],
    MISINFORMATION: [
        '⚠️ 이 정보는 왜곡되어 있습니다. 실제 상황과 다릅니다.',
        '❗ 맥락을 무시한 편집입니다. 원본을 확인해주세요.',
        '🔍 일부 내용이 사실과 다르게 전달되고 있습니다.'
    ],
    HATE_SPEECH: [
        '⛔ 혐오 표현이 포함된 콘텐츠입니다.',
        '❌ 차별적 내용이 포함되어 있습니다.',
        '⚠️ 부적절한 표현이 있습니다. 주의해주세요.'
    ],
    SCAM: [
        '⚠️ 사기 의심 콘텐츠입니다. 개인정보를 입력하지 마세요.',
        '🚨 피해 신고가 접수된 채널입니다. 주의하세요.',
        '❌ 금전 요구 시 절대 응하지 마세요.'
    ],
    EMERGENCY: [
        '🚨 긴급상황입니다. 공식 안내를 따라주세요.',
        '⚠️ 안전에 주의하시고 대피 안내를 확인하세요.',
        '📢 공식 채널의 안내를 우선 확인해주세요.'
    ],
    DANGEROUS: [
        '⚠️ 위험한 내용이 포함되어 있습니다. 따라하지 마세요.',
        '❌ 안전에 위협이 될 수 있는 콘텐츠입니다.',
        '🚫 전문가 없이 시도하지 마세요.'
    ]
};

// ============================================================================
// ResponseService 클래스
// ============================================================================

class ResponseService {
    constructor(options = {}) {
        this.supabase = createClient(
            options.supabaseUrl || process.env.SUPABASE_URL,
            options.supabaseKey || process.env.SUPABASE_SERVICE_KEY
        );
        this.youtubeApiKey = options.youtubeApiKey || process.env.YOUTUBE_API_KEY;
        this.openai = options.openai || null;
        
        logger.info('[ResponseService] 초기화 완료');
    }

    // ========================================================================
    // Step 1: INPUT - Admin Registration
    // ========================================================================

    /**
     * Admin이 위기 영상 등록
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async dispatchAccident(params) {
        const {
            videoUrl,
            headline,
            description,
            severity,
            accidentType,
            responseAction,
            targetPercentage = RESPONSE_CONFIG.DEFAULT_TARGET_PERCENTAGE,
            createdBy = 'admin'
        } = params;

        logger.info('[Response:Dispatch] 위기 영상 등록', { 
            headline, 
            severity, 
            accidentType 
        });

        try {
            // 1. Video ID 추출 및 검증
            const videoId = this._extractVideoId(videoUrl);
            if (!videoId) {
                return { success: false, error: 'INVALID_VIDEO_URL' };
            }

            // 2. 영상 메타데이터 조회
            const videoInfo = await this._fetchVideoInfo(videoId);
            if (!videoInfo) {
                return { success: false, error: 'VIDEO_NOT_FOUND' };
            }

            // 3. youtube_videos 캐시
            await this._cacheVideo(videoInfo);

            // 4. 대응 대상 시민 수 추정
            const estimatedResponders = await this._estimateResponders(targetPercentage);

            logger.info('[Response:Dispatch] 위기 영상 등록 완료', { 
                videoId, 
                estimatedResponders 
            });

            return {
                success: true,
                accident_id: null, // Store 단계에서 생성
                video_id: videoId,
                parsed_video: {
                    title: videoInfo.title,
                    channel_name: videoInfo.channel_name,
                    duration_seconds: videoInfo.duration_seconds
                },
                estimated_responders: estimatedResponders,
                _internal: { // Store 단계로 전달
                    headline,
                    description,
                    severity,
                    accidentType,
                    responseAction,
                    targetPercentage,
                    createdBy,
                    videoId
                }
            };

        } catch (error) {
            logger.error('[Response:Dispatch] 등록 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 2: STORE - Save Accident
    // ========================================================================

    /**
     * 위기 레코드 저장
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async storeAccident(params) {
        const {
            videoId,
            headline,
            description,
            severity,
            accidentType,
            responseAction,
            targetPercentage,
            createdBy
        } = params;

        logger.info('[Response:Store] 위기 저장', { videoId, severity });

        try {
            const priorityLevel = RESPONSE_CONFIG.SEVERITY_PRIORITY[severity] ?? 2;

            const { data, error } = await this.supabase
                .from('accidents')
                .insert({
                    video_id: videoId,
                    headline,
                    description,
                    admin_severity: severity,
                    accident_type_value: accidentType,
                    response_action_value: responseAction,
                    target_percentage: targetPercentage,
                    priority_level: priorityLevel,
                    status: 'PENDING',
                    created_by: createdBy
                })
                .select('accident_id')
                .single();

            if (error) {
                throw error;
            }

            logger.info('[Response:Store] 위기 저장 완료', { 
                accidentId: data.accident_id 
            });

            return {
                success: true,
                accident_id: data.accident_id,
                priority_level: priorityLevel
            };

        } catch (error) {
            logger.error('[Response:Store] 저장 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 3: ANALYZE - Transcript & Severity
    // ========================================================================

    /**
     * 영상 자막 분석 및 위험도 자동 분류
     * 
     * @param {string} accidentId
     * @param {string} videoId
     * @returns {Promise<Object>}
     */
    async analyzeAccident(accidentId, videoId) {
        logger.info('[Response:Analyze] 위기 분석 시작', { accidentId, videoId });

        try {
            // 1. 자막 조회 시도 (YouTube Data API로는 직접 조회 불가)
            // 실제 환경에서는 youtube-transcript 라이브러리 또는 외부 서비스 사용
            const transcript = await this._fetchTranscript(videoId);

            // 2. 위험 키워드 분석
            const keywordAnalysis = this._analyzeKeywords(transcript);

            // 3. AI 분석 (옵션)
            let aiAnalysis = null;
            if (this.openai && transcript) {
                aiAnalysis = await this._analyzeWithAI(transcript);
            }

            // 4. 최종 위험도 결정
            const finalAnalysis = this._determineFinalSeverity(keywordAnalysis, aiAnalysis);

            // 5. 데이터베이스 업데이트
            await this.supabase
                .from('accidents')
                .update({
                    transcript_text: transcript,
                    auto_severity: finalAnalysis.severity,
                    severity_reasoning: finalAnalysis.reasoning,
                    detected_keywords: finalAnalysis.keywords,
                    threat_score: finalAnalysis.threatScore
                })
                .eq('accident_id', accidentId);

            logger.info('[Response:Analyze] 위기 분석 완료', { 
                accidentId, 
                autoSeverity: finalAnalysis.severity 
            });

            return {
                success: true,
                accident_id: accidentId,
                analysis: {
                    transcript_available: !!transcript,
                    transcript_text: transcript?.substring(0, 500),
                    auto_severity: finalAnalysis.severity,
                    severity_reasoning: finalAnalysis.reasoning,
                    detected_keywords: finalAnalysis.keywords,
                    threat_score: finalAnalysis.threatScore,
                    recommended_action: this._getRecommendedAction(finalAnalysis.severity)
                }
            };

        } catch (error) {
            logger.error('[Response:Analyze] 분석 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 4: PROCESS - Interrupt All & Navigate
    // ========================================================================

    /**
     * 모든 시민에게 인터럽트 명령 발송
     * 
     * @param {string} accidentId
     * @returns {Promise<Object>}
     */
    async interruptAll(accidentId) {
        logger.info('[Response:Interrupt] 인터럽트 시작', { accidentId });

        try {
            // 1. 위기 정보 조회
            const { data: accident, error: accidentError } = await this.supabase
                .from('accidents')
                .select(`
                    *,
                    youtube_videos!inner (
                        title,
                        duration_seconds
                    )
                `)
                .eq('accident_id', accidentId)
                .single();

            if (accidentError || !accident) {
                return { success: false, error: 'ACCIDENT_NOT_FOUND' };
            }

            // 2. 대상 시민 조회 (target_percentage 기반)
            const { data: allCitizens } = await this.supabase
                .from('citizens')
                .select('citizen_id, status, current_activity')
                .neq('status', 'OFFLINE');

            const targetCount = Math.ceil(
                (allCitizens?.length || 0) * (accident.target_percentage / 100)
            );
            const targetCitizens = allCitizens?.slice(0, targetCount) || [];

            if (targetCitizens.length === 0) {
                return { 
                    success: false, 
                    error: 'NO_AVAILABLE_CITIZENS' 
                };
            }

            // 3. 각 시민에 대한 accident_logs 생성
            const logs = targetCitizens.map(citizen => ({
                accident_id: accidentId,
                citizen_id: citizen.citizen_id,
                interrupted_task: citizen.current_activity,
                interrupted_at: new Date().toISOString(),
                previous_state: { status: citizen.status }
            }));

            await this.supabase
                .from('accident_logs')
                .insert(logs);

            // 4. 위기 상태 업데이트
            await this.supabase
                .from('accidents')
                .update({
                    status: 'IN_PROGRESS',
                    broadcast_at: new Date().toISOString(),
                    citizens_notified: targetCitizens.length
                })
                .eq('accident_id', accidentId);

            logger.info('[Response:Interrupt] 인터럽트 완료', { 
                accidentId, 
                citizensNotified: targetCitizens.length 
            });

            return {
                success: true,
                accident_id: accidentId,
                citizens_notified: targetCitizens.length,
                target_citizens: targetCitizens.map(c => c.citizen_id),
                command: this.generateInterruptCommand(accident)
            };

        } catch (error) {
            logger.error('[Response:Interrupt] 인터럽트 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 인터럽트 명령 생성
     */
    generateInterruptCommand(accident) {
        const priority = accident.admin_severity === 'CATASTROPHIC' ? 0 : 1;

        return {
            type: 'ACCIDENT_INTERRUPT',
            priority,
            payload: {
                accident_id: accident.accident_id,
                video_id: accident.video_id,
                video_url: `https://www.youtube.com/watch?v=${accident.video_id}`,
                headline: accident.headline,
                severity: accident.admin_severity,
                response_action: accident.response_action_value,
                instructions: {
                    save_current_state: true,
                    max_response_time: priority === 0 ? 300 : 600, // 5분 or 10분
                    critical_comment_required: 
                        accident.response_action_value === 'COUNTER_COMMENT'
                }
            },
            timestamp: new Date().toISOString()
        };
    }

    // ========================================================================
    // Step 5: OUTPUT - Generate Critical Comment or Report
    // ========================================================================

    /**
     * 비판적 댓글 또는 신고 사유 생성
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async generateResponse(params) {
        const {
            citizenId,
            accidentId,
            videoId,
            responseAction,
            transcriptSummary,
            threatKeywords,
            citizenTraits
        } = params;

        logger.info('[Response:Generate] 대응 생성', { 
            citizenId, 
            accidentId, 
            responseAction 
        });

        try {
            // 위기 정보 조회
            const { data: accident } = await this.supabase
                .from('accidents')
                .select('accident_type_value, admin_severity')
                .eq('accident_id', accidentId)
                .single();

            const accidentType = accident?.accident_type_value || 'FAKE_NEWS';
            const severity = accident?.admin_severity || 'MODERATE';

            let result;

            switch (responseAction) {
                case 'COUNTER_COMMENT':
                    result = await this._generateCriticalComment(
                        accidentType,
                        threatKeywords,
                        citizenTraits
                    );
                    break;

                case 'REPORT':
                    result = this._generateReportReason(accidentType, severity);
                    break;

                case 'WATCH_CRITICAL':
                default:
                    result = {
                        action: 'WATCH',
                        should_execute: true
                    };
                    break;
            }

            return {
                success: true,
                response: result
            };

        } catch (error) {
            logger.error('[Response:Generate] 생성 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 6: FINAL_STORE - Save Accident Log
    // ========================================================================

    /**
     * 위기 대응 결과 기록
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async logResponse(params) {
        const {
            accidentId,
            citizenId,
            interruptedTask,
            previousState,
            responseAction,
            watchDuration,
            criticalComment,
            commentPosted,
            reported,
            success,
            failureReason
        } = params;

        logger.info('[Response:Log] 대응 기록', { accidentId, citizenId, success });

        try {
            // 1. accident_logs 업데이트
            const { error: updateError } = await this.supabase
                .from('accident_logs')
                .update({
                    response_started_at: new Date().toISOString(),
                    response_action: responseAction,
                    watch_duration: watchDuration,
                    critical_comment: criticalComment,
                    comment_posted: commentPosted,
                    reported,
                    success,
                    failure_reason: failureReason,
                    completed_at: new Date().toISOString()
                })
                .eq('accident_id', accidentId)
                .eq('citizen_id', citizenId);

            if (updateError) {
                throw updateError;
            }

            // 2. 보상 계산
            let existenceChange = 0;
            let creditsChange = 0;

            if (success) {
                // 위기 정보 조회
                const { data: accident } = await this.supabase
                    .from('accidents')
                    .select('admin_severity')
                    .eq('accident_id', accidentId)
                    .single();

                const severity = accident?.admin_severity || 'MODERATE';
                existenceChange = RESPONSE_CONFIG.EXISTENCE_REWARD[severity] || 0.05;
                creditsChange = RESPONSE_CONFIG.CREDITS_REWARD[severity] || 10;

                // 3. 시민 업데이트
                await this.supabase
                    .rpc('update_citizen_existence', {
                        p_citizen_id: citizenId,
                        p_existence_change: existenceChange,
                        p_activity_type: 'RESPONSE'
                    });

                // 크레딧 추가: 원자적 업데이트로 race condition 방지
                // UPDATE ... RETURNING을 사용하여 새 잔액을 가져옴
                const { data: updateResult, error: updateError } = await this.supabase
                    .rpc('add_credits_atomic', {
                        p_citizen_id: citizenId,
                        p_amount: creditsChange
                    });

                if (updateError) {
                    // RPC가 없으면 기존 방식으로 폴백 (하지만 race condition 가능)
                    logger.warn('[Response:Log] add_credits_atomic RPC 미존재, 폴백 사용', { error: updateError.message });
                    
                    const { data: citizen } = await this.supabase
                        .from('citizens')
                        .select('credits')
                        .eq('citizen_id', citizenId)
                        .single();

                    const balanceBefore = citizen?.credits || 0;
                    const balanceAfter = balanceBefore + creditsChange;

                    await this.supabase
                        .from('citizens')
                        .update({ credits: balanceAfter })
                        .eq('citizen_id', citizenId);

                    // 크레딧 트랜잭션 기록
                    await this.supabase
                        .from('credit_transactions')
                        .insert({
                            citizen_id: citizenId,
                            transaction_type: 'ACCIDENT_RESPONSE',
                            amount: creditsChange,
                            balance_before: balanceBefore,
                            balance_after: balanceAfter,
                            reference_type: 'accident',
                            reference_id: accidentId
                        });
                } else {
                    // RPC 성공 시 트랜잭션 기록 (RPC가 반환한 새 잔액 사용)
                    const newBalance = updateResult?.new_balance ?? 0;
                    const oldBalance = newBalance - creditsChange;

                    await this.supabase
                        .from('credit_transactions')
                        .insert({
                            citizen_id: citizenId,
                            transaction_type: 'ACCIDENT_RESPONSE',
                            amount: creditsChange,
                            balance_before: oldBalance,
                            balance_after: newBalance,
                            reference_type: 'accident',
                            reference_id: accidentId
                        });
                }
            }

            // 4. accident_logs에 보상 기록
            await this.supabase
                .from('accident_logs')
                .update({
                    existence_change: existenceChange,
                    credits_change: creditsChange
                })
                .eq('accident_id', accidentId)
                .eq('citizen_id', citizenId);

            // 5. 위기 대응 카운트 업데이트
            await this._updateAccidentStats(accidentId, success);

            // 6. 방어 성공 여부 계산
            const defenseStatus = await this._calculateDefenseStatus(accidentId);

            logger.info('[Response:Log] 대응 기록 완료', { 
                accidentId, 
                citizenId,
                existenceChange,
                creditsChange 
            });

            return {
                success: true,
                impact: {
                    existence_change: existenceChange,
                    credits_change: creditsChange
                },
                defense_status: defenseStatus
            };

        } catch (error) {
            logger.error('[Response:Log] 기록 실패', { error: error.message });
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

    async _fetchVideoInfo(videoId) {
        if (!this.youtubeApiKey) {
            // API 키 없으면 기본 정보만 반환
            return {
                video_id: videoId,
                title: '제목 미확인',
                channel_name: '채널 미확인',
                duration_seconds: 0
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
            return {
                video_id: videoId,
                title: item.snippet.title,
                channel_id: item.snippet.channelId,
                channel_name: item.snippet.channelTitle,
                description: item.snippet.description?.substring(0, 500),
                thumbnail_url: item.snippet.thumbnails?.medium?.url,
                duration_seconds: this._parseIsoDuration(item.contentDetails.duration)
            };
        } catch {
            return null;
        }
    }

    async _cacheVideo(videoInfo) {
        await this.supabase
            .from('youtube_videos')
            .upsert({
                ...videoInfo,
                fetched_at: new Date().toISOString()
            }, { onConflict: 'video_id' });
    }

    async _estimateResponders(targetPercentage) {
        const { count } = await this.supabase
            .from('citizens')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'OFFLINE');

        return Math.ceil((count || 0) * (targetPercentage / 100));
    }

    async _fetchTranscript(videoId) {
        // YouTube Data API로는 자막 직접 조회 불가
        // 실제 구현 시 youtube-transcript 패키지 또는 외부 서비스 사용
        logger.debug('[Response] 자막 조회 - 구현 필요', { videoId });
        return null;
    }

    _analyzeKeywords(transcript) {
        if (!transcript) {
            return { severity: 'MODERATE', keywords: [], score: 0.5 };
        }

        const detected = [];
        let maxSeverity = 'MINOR';

        for (const [severity, keywords] of Object.entries(RESPONSE_CONFIG.DANGEROUS_KEYWORDS)) {
            for (const keyword of keywords) {
                if (transcript.includes(keyword)) {
                    detected.push(keyword);
                    const currentPriority = RESPONSE_CONFIG.SEVERITY_PRIORITY[severity];
                    const maxPriority = RESPONSE_CONFIG.SEVERITY_PRIORITY[maxSeverity];
                    if (currentPriority < maxPriority) {
                        maxSeverity = severity;
                    }
                }
            }
        }

        return {
            severity: maxSeverity,
            keywords: detected,
            score: detected.length > 0 
                ? Math.min(1, detected.length * 0.2)
                : 0.3
        };
    }

    async _analyzeWithAI(transcript) {
        if (!this.openai) return null;

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `콘텐츠의 위험도를 분석하세요. JSON으로 응답:
{
    "severity": "MINOR" | "MODERATE" | "SEVERE" | "CATASTROPHIC",
    "reasoning": "판단 근거",
    "threat_score": 0.0 ~ 1.0
}`
                    },
                    { role: 'user', content: transcript.substring(0, 2000) }
                ],
                temperature: 0.3,
                max_tokens: 300,
                response_format: { type: 'json_object' }
            });

            return JSON.parse(completion.choices[0]?.message?.content || '{}');
        } catch {
            return null;
        }
    }

    _determineFinalSeverity(keywordAnalysis, aiAnalysis) {
        // AI 분석 결과가 있으면 가중치 적용
        if (aiAnalysis?.severity) {
            const keywordPriority = RESPONSE_CONFIG.SEVERITY_PRIORITY[keywordAnalysis.severity];
            const aiPriority = RESPONSE_CONFIG.SEVERITY_PRIORITY[aiAnalysis.severity];
            
            // 더 높은 위험도(낮은 우선순위 숫자) 선택
            const finalSeverity = keywordPriority < aiPriority 
                ? keywordAnalysis.severity 
                : aiAnalysis.severity;

            return {
                severity: finalSeverity,
                keywords: keywordAnalysis.keywords,
                threatScore: (keywordAnalysis.score + (aiAnalysis.threat_score || 0.5)) / 2,
                reasoning: aiAnalysis.reasoning || '키워드 기반 분석'
            };
        }

        return {
            severity: keywordAnalysis.severity,
            keywords: keywordAnalysis.keywords,
            threatScore: keywordAnalysis.score,
            reasoning: '키워드 기반 자동 분류'
        };
    }

    _getRecommendedAction(severity) {
        switch (severity) {
            case 'CATASTROPHIC':
            case 'SEVERE':
                return 'COUNTER_COMMENT';
            case 'MODERATE':
                return 'REPORT';
            default:
                return 'WATCH_CRITICAL';
        }
    }

    async _generateCriticalComment(accidentType, threatKeywords, citizenTraits) {
        // AI 기반 댓글 생성
        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `당신은 허위정보나 위험 콘텐츠에 대해 사실에 기반한 비판적 댓글을 작성합니다.
위협 유형: ${accidentType}
감지된 키워드: ${threatKeywords?.join(', ') || '없음'}

100자 이내로 정중하지만 단호한 비판적 댓글을 작성하세요.`
                        },
                        { role: 'user', content: '비판적 댓글을 작성해주세요.' }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                });

                const text = completion.choices[0]?.message?.content?.trim();
                return {
                    action: 'COMMENT',
                    comment_text: text,
                    comment_tone: 'critical',
                    should_execute: true
                };
            } catch (e) {
                logger.warn('[Response] AI 댓글 생성 실패', { error: e.message });
            }
        }

        // 템플릿 기반 댓글
        const templates = CRITICAL_COMMENT_TEMPLATES[accidentType] || 
            CRITICAL_COMMENT_TEMPLATES.FAKE_NEWS;
        const text = templates[Math.floor(Math.random() * templates.length)];

        return {
            action: 'COMMENT',
            comment_text: text,
            comment_tone: 'warning',
            should_execute: true
        };
    }

    _generateReportReason(accidentType, severity) {
        const reasons = {
            FAKE_NEWS: '허위정보 유포',
            MISINFORMATION: '잘못된 정보 전달',
            HATE_SPEECH: '혐오 발언',
            SCAM: '사기 또는 스팸',
            EMERGENCY: '위험한 콘텐츠',
            DANGEROUS: '해로운 또는 위험한 행위'
        };

        return {
            action: 'REPORT',
            report_reason: reasons[accidentType] || '스팸 또는 사기',
            should_execute: severity !== 'MINOR'
        };
    }

    async _updateAccidentStats(accidentId, success) {
        if (success) {
            const { data } = await this.supabase
                .from('accidents')
                .select('citizens_responded')
                .eq('accident_id', accidentId)
                .single();

            await this.supabase
                .from('accidents')
                .update({ citizens_responded: (data?.citizens_responded || 0) + 1 })
                .eq('accident_id', accidentId);
        }
    }

    async _calculateDefenseStatus(accidentId) {
        const { data: logs } = await this.supabase
            .from('accident_logs')
            .select('success')
            .eq('accident_id', accidentId)
            .not('completed_at', 'is', null);

        if (!logs || logs.length === 0) {
            return { total_responders: 0, successful_responders: 0, defense_rate: 0 };
        }

        const successCount = logs.filter(l => l.success).length;
        const defenseRate = successCount / logs.length;

        // 70% 이상 성공 시 방어 성공
        if (defenseRate >= 0.7) {
            await this.supabase
                .from('accidents')
                .update({ defense_success: true, status: 'COMPLETED', resolved_at: new Date().toISOString() })
                .eq('accident_id', accidentId);
        }

        return {
            total_responders: logs.length,
            successful_responders: successCount,
            defense_rate: defenseRate
        };
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

module.exports = ResponseService;

