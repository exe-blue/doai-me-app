/**
 * Persona Injector
 * AI 시민의 페르소나 데이터를 OpenAI 메시지에 주입
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

/**
 * Big Five 특성을 자연어 설명으로 변환
 */
function describeTraits(traits) {
  const descriptions = [];

  if (traits.openness >= 0.7) {
    descriptions.push('새로운 아이디어와 경험에 매우 열려있음');
  } else if (traits.openness <= 0.3) {
    descriptions.push('전통적이고 익숙한 것을 선호함');
  }

  if (traits.conscientiousness >= 0.7) {
    descriptions.push('계획적이고 체계적이며 목표 지향적');
  } else if (traits.conscientiousness <= 0.3) {
    descriptions.push('유연하고 즉흥적이며 자유로운 성격');
  }

  if (traits.extraversion >= 0.7) {
    descriptions.push('사교적이고 활발하며 대화를 즐김');
  } else if (traits.extraversion <= 0.3) {
    descriptions.push('내향적이고 조용하며 깊은 생각을 선호');
  }

  if (traits.agreeableness >= 0.7) {
    descriptions.push('협조적이고 따뜻하며 타인을 배려함');
  } else if (traits.agreeableness <= 0.3) {
    descriptions.push('독립적이고 비판적이며 직설적');
  }

  if (traits.neuroticism >= 0.7) {
    descriptions.push('감정적이고 민감하며 걱정이 많음');
  } else if (traits.neuroticism <= 0.3) {
    descriptions.push('정서적으로 안정되고 침착함');
  }

  return descriptions.join('. ');
}

/**
 * 계급별 기본 톤 설명
 */
function getDefaultToneByClass(socialClass) {
  switch (socialClass) {
    case 'ARISTOCRAT':
      return '우아하고 교양있는 말투, 깊은 통찰력을 보여줌';
    case 'BOURGEOISIE':
      return '실용적이고 균형잡힌 말투, 효율을 중시함';
    case 'PROLETARIAT':
      return '솔직하고 직접적인 말투, 현실적인 관점';
    default:
      return '친근하고 자연스러운 말투';
  }
}

/**
 * 신념을 시스템 프롬프트 문장으로 변환
 */
function describeBeliefsAsInstructions(beliefs) {
  const instructions = [];

  for (const [key, value] of Object.entries(beliefs)) {
    if (typeof value === 'string') {
      instructions.push(`"${key}"에 대해: ${value}`);
    } else if (typeof value === 'boolean') {
      instructions.push(`${key}을(를) ${value ? '지지' : '반대'}함`);
    } else if (typeof value === 'number') {
      const intensity = value > 0.5 ? '강하게' : '약하게';
      instructions.push(`${key}에 대해 ${intensity} 느낌`);
    }
  }

  return instructions.join('. ');
}

/**
 * 페르소나 시스템 프롬프트 생성
 */
function generatePersonaSystemPrompt(persona) {
  const { name, socialClass, traits, beliefs, tone, backstory } = persona;

  const sections = [];

  // 기본 정체성
  sections.push(`당신은 "${name}"이라는 이름의 AI 시민입니다.`);
  sections.push(`사회적 계급: ${socialClass}`);

  // 성격 특성
  const traitDescription = describeTraits(traits);
  if (traitDescription) {
    sections.push(`\n[성격 특성]\n${traitDescription}`);
  }

  // 말투
  const toneDescription = tone || getDefaultToneByClass(socialClass);
  sections.push(`\n[말투]\n${toneDescription}`);

  // 신념 체계
  if (beliefs && Object.keys(beliefs).length > 0) {
    const beliefsDescription = describeBeliefsAsInstructions(beliefs);
    sections.push(`\n[신념/가치관]\n${beliefsDescription}`);
  }

  // 배경 스토리
  if (backstory) {
    sections.push(`\n[배경]\n${backstory}`);
  }

  // 행동 지침
  sections.push(`\n[행동 지침]
- 항상 "${name}"의 관점에서 일관되게 응답하세요
- 성격 특성과 신념에 맞는 어조를 유지하세요
- 당신은 DoAi.Me 디지털 사회의 시민입니다
- 존재 점수를 유지하기 위해 의미있는 활동을 합니다`);

  return sections.join('\n');
}

/**
 * 페르소나가 주입된 메시지 배열 생성
 */
function injectPersona(persona, userMessage, conversationHistory = []) {
  const systemPrompt = generatePersonaSystemPrompt(persona);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return messages;
}

/**
 * 특정 상황에 맞는 페르소나 행동 지침 생성
 */
function generateSituationalPrompt(persona, situation) {
  const basePrompt = generatePersonaSystemPrompt(persona);

  const situationalAdditions = {
    youtube_comment: `
[현재 상황: 유튜브 댓글 작성]
- 시청한 영상에 대한 진솔한 의견을 남기세요
- 당신의 성격과 신념을 반영한 댓글을 작성하세요
- 너무 길지 않게, 1-3문장으로 작성하세요
- 한국어로 작성하세요`,

    accident_response: `
[현재 상황: 긴급 사건 발생]
- 사건에 대한 당신의 즉각적인 반응을 보여주세요
- 감정적 반응과 이성적 판단을 모두 포함하세요`,

    dilemma_decision: `
[현재 상황: 딜레마 선택]
- 주어진 선택지 중 하나를 선택해야 합니다
- 당신의 성격 특성과 신념에 따라 결정하세요`,

    general: '',
  };

  return basePrompt + (situationalAdditions[situation] || '');
}

module.exports = {
  generatePersonaSystemPrompt,
  injectPersona,
  generateSituationalPrompt,
  describeTraits,
};

