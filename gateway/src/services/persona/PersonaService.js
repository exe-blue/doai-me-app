/**
 * PersonaService
 * AI 시민(Persona) 생성 및 관리
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 1.1
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// ============================================================================
// 상수 정의
// ============================================================================

// 한국 이름 풀 (40 first names, 30 last names)
const FIRST_NAMES = [
    '민준', '서연', '예준', '서윤', '도윤', '지우', '시우', '하은',
    '주원', '하윤', '지호', '은서', '준서', '민서', '유준', '지아',
    '현우', '채원', '지민', '소율', '건우', '아인', '우진', '소윤',
    '선우', '나윤', '민재', '유나', '현준', '윤서', '서준', '지유',
    '승우', '다은', '준혁', '수아', '예성', '예린', '도현', '시아'
];

const LAST_NAMES = [
    '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임',
    '한', '오', '서', '신', '권', '황', '안', '송', '류', '전',
    '홍', '고', '문', '양', '손', '배', '백', '허', '유', '남'
];

// 초기값 상수
const INITIAL_CREDITS = 1000;
const INITIAL_EXISTENCE_SCORE = 0.5;

// Big Five 성격 특성 생성 파라미터
const TRAIT_MEAN = 0.5;
const TRAIT_STD = 0.2;
const TRAIT_MIN = 0.1;
const TRAIT_MAX = 0.9;

// Belief 영향 계수
const BELIEF_INFLUENCE_FACTOR = 0.3;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Box-Muller 변환을 사용한 가우시안 난수 생성
 * @param {number} mean - 평균
 * @param {number} std - 표준편차
 * @returns {number} 가우시안 분포 난수
 */
function gaussianRandom(mean, std) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
}

/**
 * 값을 특정 범위로 제한
 * @param {number} value - 입력 값
 * @param {number} min - 최솟값
 * @param {number} max - 최댓값
 * @returns {number} 제한된 값
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 배열에서 랜덤 요소 선택
 * @param {Array} array - 입력 배열
 * @returns {*} 랜덤 선택된 요소
 */
function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * 소수점 자릿수 반올림
 * @param {number} value - 입력 값
 * @param {number} decimals - 소수점 자릿수
 * @returns {number} 반올림된 값
 */
function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

// ============================================================================
// PersonaService 클래스
// ============================================================================

class PersonaService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // ========================================================================
    // 이름 생성
    // ========================================================================

    /**
     * 한국 이름 생성
     * @returns {string} 생성된 한국 이름 (성 + 이름)
     */
    generateKoreanName() {
        const lastName = randomChoice(LAST_NAMES);
        const firstName = randomChoice(FIRST_NAMES);
        return lastName + firstName;
    }

    // ========================================================================
    // Big Five 성격 특성 생성
    // ========================================================================

    /**
     * Big Five 성격 특성 생성
     * 각 특성은 가우시안 분포(mean=0.5, σ=0.2)로 생성되며 [0.1, 0.9] 범위로 제한
     * 
     * @returns {Object} Big Five 성격 특성
     * @returns {number} .openness - 개방성
     * @returns {number} .conscientiousness - 성실성
     * @returns {number} .extraversion - 외향성
     * @returns {number} .agreeableness - 친화성
     * @returns {number} .neuroticism - 신경증
     */
    generateBigFiveTraits() {
        const generateTrait = () => {
            const raw = gaussianRandom(TRAIT_MEAN, TRAIT_STD);
            return roundTo(clamp(raw, TRAIT_MIN, TRAIT_MAX), 2);
        };

        return {
            openness: generateTrait(),
            conscientiousness: generateTrait(),
            extraversion: generateTrait(),
            agreeableness: generateTrait(),
            neuroticism: generateTrait()
        };
    }

    // ========================================================================
    // Belief System 파생
    // ========================================================================

    /**
     * 성격 특성으로부터 신념 체계 파생
     * 각 신념은 관련 성격 특성의 영향을 받아 계산됨
     * 
     * @param {Object} traits - Big Five 성격 특성
     * @returns {Object} 신념 체계
     * @returns {number} .self_worth - 자아가치 (외향성 영향)
     * @returns {number} .world_trust - 세상신뢰 (친화성 영향)
     * @returns {number} .work_ethic - 노동윤리 (성실성 영향)
     * @returns {number} .risk_tolerance - 위험감수 (개방성 영향)
     * @returns {number} .conformity - 순응성 (개방성 역영향)
     */
    deriveBeliefs(traits) {
        const adjust = (influence) => {
            return roundTo(0.5 + (influence - 0.5) * BELIEF_INFLUENCE_FACTOR, 3);
        };

        return {
            self_worth: adjust(traits.extraversion),
            world_trust: adjust(traits.agreeableness),
            work_ethic: adjust(traits.conscientiousness),
            risk_tolerance: adjust(traits.openness),
            conformity: roundTo(0.5 - (traits.openness - 0.5) * BELIEF_INFLUENCE_FACTOR, 3)
        };
    }

    // ========================================================================
    // Persona 생성
    // ========================================================================

    /**
     * 새로운 AI 시민(Persona) 생성
     * Discovery Service에서 새 디바이스 감지 시 호출됨
     * 
     * @param {string} deviceSerial - ADB 디바이스 시리얼 (e.g., "192.168.0.101:5555")
     * @param {string} deviceModel - 디바이스 모델명 (e.g., "SM-G960N")
     * @param {string} connectionType - 연결 타입 ('USB' | 'WIFI' | 'LAN')
     * @returns {Promise<Object>} 생성된 Persona 객체
     */
    async createPersona(deviceSerial, deviceModel, connectionType) {
        // Step 1: UUID 생성
        const citizenId = uuidv4();

        // Step 2: 한국 이름 생성
        const name = this.generateKoreanName();

        // Step 3: Big Five 성격 특성 생성
        const traits = this.generateBigFiveTraits();

        // Step 4: 신념 체계 파생
        const beliefs = this.deriveBeliefs(traits);

        // Step 5: 초기값 설정
        const credits = INITIAL_CREDITS;
        const existenceScore = INITIAL_EXISTENCE_SCORE;
        const now = new Date().toISOString();

        const persona = {
            citizen_id: citizenId,
            device_serial: deviceSerial,
            device_model: deviceModel,
            connection_type: connectionType,
            name,
            
            // Big Five Traits
            trait_openness: traits.openness,
            trait_conscientiousness: traits.conscientiousness,
            trait_extraversion: traits.extraversion,
            trait_agreeableness: traits.agreeableness,
            trait_neuroticism: traits.neuroticism,
            
            // Beliefs
            belief_self_worth: beliefs.self_worth,
            belief_world_trust: beliefs.world_trust,
            belief_work_ethic: beliefs.work_ethic,
            belief_risk_tolerance: beliefs.risk_tolerance,
            belief_conformity: beliefs.conformity,
            
            // Economy
            credits,
            existence_score: existenceScore,
            
            // Timestamps
            created_at: now,
            last_seen_at: now
        };

        logger.info(`[PersonaService] Creating new persona for device ${deviceSerial}`, {
            citizenId,
            name,
            deviceModel,
            connectionType
        });

        return persona;
    }

    // ========================================================================
    // DB 연동
    // ========================================================================

    /**
     * 디바이스 시리얼로 기존 시민 조회
     * @param {string} deviceSerial - ADB 디바이스 시리얼
     * @returns {Promise<Object|null>} 존재하면 시민 객체, 없으면 null
     */
    async findBySerial(deviceSerial) {
        if (!this.supabase) {
            logger.warn('[PersonaService] Supabase client not initialized');
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('citizens')
                .select('*')
                .eq('device_serial', deviceSerial)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                logger.error('[PersonaService] Error finding citizen', { error, deviceSerial });
                throw error;
            }

            return data || null;
        } catch (err) {
            logger.error('[PersonaService] findBySerial failed', { error: err.message, deviceSerial });
            return null;
        }
    }

    /**
     * 시민 ID로 시민 조회
     * @param {string} citizenId - 시민 UUID
     * @returns {Promise<Object|null>} 존재하면 시민 객체, 없으면 null
     */
    async findById(citizenId) {
        if (!this.supabase) {
            logger.warn('[PersonaService] Supabase client not initialized');
            return null;
        }

        try {
            const { data, error } = await this.supabase
                .from('citizens')
                .select('*')
                .eq('citizen_id', citizenId)
                .single();

            if (error && error.code !== 'PGRST116') {
                logger.error('[PersonaService] Error finding citizen', { error, citizenId });
                throw error;
            }

            return data || null;
        } catch (err) {
            logger.error('[PersonaService] findById failed', { error: err.message, citizenId });
            return null;
        }
    }

    /**
     * 새 시민을 DB에 저장
     * @param {Object} persona - Persona 객체
     * @returns {Promise<Object>} 저장된 시민 객체
     */
    async save(persona) {
        if (!this.supabase) {
            logger.warn('[PersonaService] Supabase client not initialized, returning persona without saving');
            return persona;
        }

        try {
            const { data, error } = await this.supabase
                .from('citizens')
                .insert(persona)
                .select()
                .single();

            if (error) {
                logger.error('[PersonaService] Error saving citizen', { error, citizenId: persona.citizen_id });
                throw error;
            }

            logger.info(`[PersonaService] Citizen saved: ${persona.citizen_id} (${persona.name})`);
            return data;
        } catch (err) {
            logger.error('[PersonaService] save failed', { error: err.message, citizenId: persona.citizen_id });
            throw err;
        }
    }

    /**
     * 시민 정보 업데이트
     * @param {string} citizenId - 시민 UUID
     * @param {Object} updates - 업데이트할 필드들
     * @returns {Promise<Object>} 업데이트된 시민 객체
     */
    async update(citizenId, updates) {
        if (!this.supabase) {
            logger.warn('[PersonaService] Supabase client not initialized');
            return null;
        }

        try {
            // last_seen_at 자동 업데이트
            updates.last_seen_at = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('citizens')
                .update(updates)
                .eq('citizen_id', citizenId)
                .select()
                .single();

            if (error) {
                logger.error('[PersonaService] Error updating citizen', { error, citizenId });
                throw error;
            }

            logger.debug(`[PersonaService] Citizen updated: ${citizenId}`);
            return data;
        } catch (err) {
            logger.error('[PersonaService] update failed', { error: err.message, citizenId });
            throw err;
        }
    }

    // ========================================================================
    // 디바이스 연결 시 자동 처리
    // ========================================================================

    /**
     * 디바이스 연결 시 시민 조회 또는 생성
     * DiscoveryService에서 새 디바이스 감지 시 호출
     * 
     * @param {string} deviceSerial - ADB 디바이스 시리얼
     * @param {string} deviceModel - 디바이스 모델명
     * @param {string} connectionType - 연결 타입
     * @returns {Promise<Object>} 기존 또는 새로 생성된 시민 객체
     */
    async getOrCreateForDevice(deviceSerial, deviceModel, connectionType) {
        // 기존 시민 조회
        let citizen = await this.findBySerial(deviceSerial);

        if (citizen) {
            // 기존 시민 - last_seen_at 업데이트
            logger.info(`[PersonaService] Existing citizen found: ${citizen.citizen_id} (${citizen.name})`);
            
            await this.update(citizen.citizen_id, {
                device_model: deviceModel || citizen.device_model,
                connection_type: connectionType || citizen.connection_type
            });

            return citizen;
        }

        // 새 시민 생성
        const persona = await this.createPersona(deviceSerial, deviceModel, connectionType);
        citizen = await this.save(persona);

        logger.info(`[PersonaService] New citizen created: ${citizen.citizen_id} (${citizen.name})`);
        return citizen;
    }

    // ========================================================================
    // 통계 및 조회
    // ========================================================================

    /**
     * 전체 시민 수 조회
     * @returns {Promise<number>} 시민 수
     */
    async getTotalCount() {
        if (!this.supabase) return 0;

        try {
            const { count, error } = await this.supabase
                .from('citizens')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            return count || 0;
        } catch (err) {
            logger.error('[PersonaService] getTotalCount failed', { error: err.message });
            return 0;
        }
    }

    /**
     * Existence State별 시민 수 조회
     * @returns {Promise<Object>} 상태별 시민 수
     */
    async getCountByExistenceState() {
        if (!this.supabase) {
            return { ACTIVE: 0, WAITING: 0, FADING: 0, VOID: 0 };
        }

        try {
            const { data, error } = await this.supabase
                .from('citizens')
                .select('existence_score');

            if (error) throw error;

            // existence_score 기반 상태 분류
            // ACTIVE: > 0.7, WAITING: 0.4-0.7, FADING: 0.1-0.4, VOID: < 0.1
            const counts = { ACTIVE: 0, WAITING: 0, FADING: 0, VOID: 0 };

            for (const citizen of data) {
                const score = citizen.existence_score;
                if (score > 0.7) counts.ACTIVE++;
                else if (score > 0.4) counts.WAITING++;
                else if (score > 0.1) counts.FADING++;
                else counts.VOID++;
            }

            return counts;
        } catch (err) {
            logger.error('[PersonaService] getCountByExistenceState failed', { error: err.message });
            return { ACTIVE: 0, WAITING: 0, FADING: 0, VOID: 0 };
        }
    }

    /**
     * Persona 객체를 API 응답 형식으로 변환
     * @param {Object} citizen - DB에서 조회한 시민 객체
     * @returns {Object} API 응답 형식 객체
     */
    toApiFormat(citizen) {
        return {
            citizen_id: citizen.citizen_id,
            device_serial: citizen.device_serial,
            device_model: citizen.device_model,
            connection_type: citizen.connection_type,
            name: citizen.name,
            traits: {
                openness: citizen.trait_openness,
                conscientiousness: citizen.trait_conscientiousness,
                extraversion: citizen.trait_extraversion,
                agreeableness: citizen.trait_agreeableness,
                neuroticism: citizen.trait_neuroticism
            },
            beliefs: {
                self_worth: citizen.belief_self_worth,
                world_trust: citizen.belief_world_trust,
                work_ethic: citizen.belief_work_ethic,
                risk_tolerance: citizen.belief_risk_tolerance,
                conformity: citizen.belief_conformity
            },
            credits: citizen.credits,
            existence_score: citizen.existence_score,
            existence_state: this.getExistenceState(citizen.existence_score),
            created_at: citizen.created_at,
            last_seen_at: citizen.last_seen_at
        };
    }

    /**
     * existence_score로부터 상태 문자열 반환
     * @param {number} score - existence_score (0-1)
     * @returns {string} 상태 ('ACTIVE' | 'WAITING' | 'FADING' | 'VOID')
     */
    getExistenceState(score) {
        if (score > 0.7) return 'ACTIVE';
        if (score > 0.4) return 'WAITING';
        if (score > 0.1) return 'FADING';
        return 'VOID';
    }
}

module.exports = PersonaService;

