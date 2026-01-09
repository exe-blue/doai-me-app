/**
 * AI Routes
 * OpenAI 연동 API 엔드포인트
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const OpenAIService = require('../../services/openai');
const logger = require('../../utils/logger');

/**
 * POST /api/ai/chat
 * AI 시민과 대화
 */
router.post('/chat', async (req, res) => {
  try {
    const { persona, message, history = [] } = req.body;

    if (!persona || !message) {
      return res.status(400).json({
        success: false,
        error: 'persona와 message가 필요합니다',
      });
    }

    const routing = OpenAIService.getRoutingInfo(persona.socialClass);
    logger.info(`[AI Chat] ${persona.name} (${persona.socialClass}) - Model: ${routing.model}`);

    const response = await OpenAIService.chatWithCitizen(persona, message, history);

    res.json({
      success: true,
      response,
      routing: {
        model: routing.model,
        class: routing.socialClass,
      },
    });
  } catch (error) {
    logger.error('[AI Chat Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/verify-pov
 * 시청 증명(Proof of View) 검증
 */
router.post('/verify-pov', async (req, res) => {
  try {
    const { screenshot, minProgress = 90 } = req.body;

    if (!screenshot) {
      return res.status(400).json({
        success: false,
        error: 'screenshot이 필요합니다 (Base64)',
      });
    }

    logger.info('[PoV Verify] 시청 증명 검증 시작');

    const result = await OpenAIService.verifyWatching(screenshot, minProgress);

    logger.info(`[PoV Verify] 결과: ${result.verified ? 'VALID' : 'INVALID'} - ${result.reason}`);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[PoV Verify Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/analyze-screen
 * YouTube 스크린샷 분석 (검증 없이 분석만)
 */
router.post('/analyze-screen', async (req, res) => {
  try {
    const { screenshot } = req.body;

    if (!screenshot) {
      return res.status(400).json({
        success: false,
        error: 'screenshot이 필요합니다 (Base64)',
      });
    }

    const analysis = await OpenAIService.analyzeYouTubeScreen(screenshot);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    logger.error('[Screen Analysis Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/routing/:socialClass
 * 계급별 모델 라우팅 정보 조회
 */
router.get('/routing/:socialClass', (req, res) => {
  const { socialClass } = req.params;

  if (!['ARISTOCRAT', 'BOURGEOISIE', 'PROLETARIAT'].includes(socialClass)) {
    return res.status(400).json({
      success: false,
      error: '유효하지 않은 계급',
    });
  }

  const routing = OpenAIService.getRoutingInfo(socialClass);

  res.json({
    success: true,
    routing,
  });
});

/**
 * POST /api/ai/determine-class
 * 크레딧과 존재 점수로 계급 결정
 */
router.post('/determine-class', (req, res) => {
  const { credits, existenceScore } = req.body;

  if (typeof credits !== 'number' || typeof existenceScore !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'credits와 existenceScore(숫자)가 필요합니다',
    });
  }

  const socialClass = OpenAIService.determineCompositeClass(credits, existenceScore);
  const routing = OpenAIService.getRoutingInfo(socialClass);

  res.json({
    success: true,
    socialClass,
    routing,
  });
});

/**
 * POST /api/ai/generate-comment
 * AI 시민이 유튜브 댓글 생성
 */
router.post('/generate-comment', async (req, res) => {
  try {
    const { persona, videoTitle, videoDescription } = req.body;

    if (!persona || !videoTitle) {
      return res.status(400).json({
        success: false,
        error: 'persona와 videoTitle이 필요합니다',
      });
    }

    const prompt = OpenAIService.generateSituationalPrompt(persona, 'youtube_comment');
    const client = OpenAIService.getOpenAIClient();
    const model = OpenAIService.getModelForClass(persona.socialClass);

    const messages = [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: `영상 제목: "${videoTitle}"${videoDescription ? `\n영상 설명: ${videoDescription}` : ''}\n\n이 영상에 대한 댓글을 작성해주세요.`,
      },
    ];

    const response = await client.chatCompletion(messages, { model, maxTokens: 300 });
    const comment = response.choices[0]?.message?.content || '';

    logger.info(`[Generate Comment] ${persona.name} -> "${comment.substring(0, 50)}..."`);

    res.json({
      success: true,
      comment,
      model,
    });
  } catch (error) {
    logger.error('[Generate Comment Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

module.exports = router;

