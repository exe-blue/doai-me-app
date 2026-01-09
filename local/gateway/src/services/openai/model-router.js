/**
 * Model Router
 * 시민의 계급(Social Class)에 따라 AI 모델을 자동 선택
 *
 * 계급 시스템:
 * - ARISTOCRAT (귀족): gpt-4o - 최고급 모델
 * - BOURGEOISIE (부르주아): gpt-4o-mini - 중급 모델
 * - PROLETARIAT (프롤레타리아): gpt-3.5-turbo - 기본 모델
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

require('dotenv').config();

/**
 * 계급별 모델 매핑
 */
const MODEL_BY_CLASS = {
  ARISTOCRAT: process.env.OPENAI_MODEL_ARISTOCRAT || 'gpt-4o',
  BOURGEOISIE: process.env.OPENAI_MODEL_BOURGEOISIE || 'gpt-4o-mini',
  PROLETARIAT: process.env.OPENAI_MODEL_PROLETARIAT || 'gpt-3.5-turbo',
};

/**
 * 계급별 토큰 한도
 */
const TOKEN_LIMIT_BY_CLASS = {
  ARISTOCRAT: 4000,
  BOURGEOISIE: 2000,
  PROLETARIAT: 1000,
};

/**
 * 계급별 온도(창의성) 기본값
 */
const TEMPERATURE_BY_CLASS = {
  ARISTOCRAT: 0.8,
  BOURGEOISIE: 0.7,
  PROLETARIAT: 0.6,
};

/**
 * 계급별 API 호출 비용 가중치
 */
const COST_WEIGHT_BY_CLASS = {
  ARISTOCRAT: 10,
  BOURGEOISIE: 3,
  PROLETARIAT: 1,
};

/**
 * 시민의 계급에 맞는 모델 선택
 */
function getModelForClass(socialClass) {
  return MODEL_BY_CLASS[socialClass] || MODEL_BY_CLASS.PROLETARIAT;
}

/**
 * 시민의 계급에 맞는 토큰 한도 조회
 */
function getTokenLimitForClass(socialClass) {
  return TOKEN_LIMIT_BY_CLASS[socialClass] || TOKEN_LIMIT_BY_CLASS.PROLETARIAT;
}

/**
 * 시민의 계급에 맞는 온도 기본값 조회
 */
function getTemperatureForClass(socialClass) {
  return TEMPERATURE_BY_CLASS[socialClass] || TEMPERATURE_BY_CLASS.PROLETARIAT;
}

/**
 * 시민의 계급에 따른 비용 가중치 조회
 */
function getCostWeightForClass(socialClass) {
  return COST_WEIGHT_BY_CLASS[socialClass] || COST_WEIGHT_BY_CLASS.PROLETARIAT;
}

/**
 * 크레딧 기반 계급 결정
 */
function determineClassByCredits(credits) {
  const ARISTOCRAT_THRESHOLD = 10000;
  const BOURGEOISIE_THRESHOLD = 1000;

  if (credits >= ARISTOCRAT_THRESHOLD) return 'ARISTOCRAT';
  if (credits >= BOURGEOISIE_THRESHOLD) return 'BOURGEOISIE';
  return 'PROLETARIAT';
}

/**
 * 존재 점수 기반 계급 결정
 */
function determineClassByExistence(existenceScore) {
  const ARISTOCRAT_THRESHOLD = 0.8;
  const BOURGEOISIE_THRESHOLD = 0.5;

  if (existenceScore >= ARISTOCRAT_THRESHOLD) return 'ARISTOCRAT';
  if (existenceScore >= BOURGEOISIE_THRESHOLD) return 'BOURGEOISIE';
  return 'PROLETARIAT';
}

/**
 * 복합 계급 결정 (크레딧 + 존재 점수)
 */
function determineCompositeClass(credits, existenceScore) {
  const creditClass = determineClassByCredits(credits);
  const existenceClass = determineClassByExistence(existenceScore);

  const classRank = {
    ARISTOCRAT: 3,
    BOURGEOISIE: 2,
    PROLETARIAT: 1,
  };

  const minRank = Math.min(classRank[creditClass], classRank[existenceClass]);
  return Object.entries(classRank).find(([_, rank]) => rank === minRank)?.[0];
}

/**
 * 모델 라우팅 정보 전체 조회
 */
function getRoutingInfo(socialClass) {
  return {
    socialClass,
    model: getModelForClass(socialClass),
    tokenLimit: getTokenLimitForClass(socialClass),
    temperature: getTemperatureForClass(socialClass),
    costWeight: getCostWeightForClass(socialClass),
  };
}

module.exports = {
  getModelForClass,
  getTokenLimitForClass,
  getTemperatureForClass,
  getCostWeightForClass,
  determineClassByCredits,
  determineClassByExistence,
  determineCompositeClass,
  getRoutingInfo,
};

