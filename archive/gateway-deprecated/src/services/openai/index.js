/**
 * OpenAI Services
 * DoAi.Me AI 시민을 위한 OpenAI 연동 모듈
 *
 * 주요 기능:
 * 1. Model Router - 계급별 모델 자동 선택
 * 2. Vision Service - 시청 증명(PoV) 검증
 * 3. Persona Injector - 페르소나 데이터 주입
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const OpenAIClient = require('./openai-client');
const ModelRouter = require('./model-router');
const VisionService = require('./vision-service');
const PersonaInjector = require('./persona-injector');

module.exports = {
  // Client
  OpenAIClient,
  getOpenAIClient: OpenAIClient.getOpenAIClient,

  // Model Router
  ModelRouter,
  getModelForClass: ModelRouter.getModelForClass,
  getTokenLimitForClass: ModelRouter.getTokenLimitForClass,
  getTemperatureForClass: ModelRouter.getTemperatureForClass,
  determineCompositeClass: ModelRouter.determineCompositeClass,
  getRoutingInfo: ModelRouter.getRoutingInfo,

  // Vision Service
  VisionService,
  analyzeYouTubeScreen: VisionService.analyzeYouTubeScreen,
  verifyProofOfView: VisionService.verifyProofOfView,
  validateScreenshot: VisionService.validateScreenshot,

  // Persona Injector
  PersonaInjector,
  generatePersonaSystemPrompt: PersonaInjector.generatePersonaSystemPrompt,
  injectPersona: PersonaInjector.injectPersona,
  generateSituationalPrompt: PersonaInjector.generateSituationalPrompt,

  /**
   * AI 시민과 대화하기 (통합 함수)
   */
  async chatWithCitizen(persona, userMessage, conversationHistory = []) {
    const client = OpenAIClient.getOpenAIClient();
    const model = ModelRouter.getModelForClass(persona.socialClass);
    const maxTokens = ModelRouter.getTokenLimitForClass(persona.socialClass);
    const temperature = ModelRouter.getTemperatureForClass(persona.socialClass);

    const messages = PersonaInjector.injectPersona(persona, userMessage, conversationHistory);

    const response = await client.chatCompletion(messages, {
      model,
      maxTokens,
      temperature,
    });

    return response.choices[0]?.message?.content || '';
  },

  /**
   * 시청 증명 검증 (통합 함수)
   */
  async verifyWatching(screenshotBase64, minProgressPercent = 90) {
    const validation = VisionService.validateScreenshot(screenshotBase64);
    if (!validation.valid) {
      return {
        verified: false,
        reason: validation.error || '유효하지 않은 스크린샷',
        analysis: {
          isYouTubeScreen: false,
          isPlaying: false,
          progressPercentage: -1,
          confidence: 0,
          rawAnalysis: '',
        },
        timestamp: new Date(),
      };
    }

    return VisionService.verifyProofOfView(screenshotBase64, minProgressPercent);
  },
};

