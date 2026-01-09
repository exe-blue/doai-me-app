/**
 * Vision Service
 * OpenAI Vision API를 활용한 이미지 분석 서비스
 * 주요 용도: Proof of View (시청 증명) 검증
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

require('dotenv').config();
const { getOpenAIClient } = require('./openai-client');

/**
 * YouTube 시청 화면 분석 프롬프트
 */
const YOUTUBE_ANALYSIS_PROMPT = `당신은 스크린샷 분석 전문가입니다. 아래 이미지가 YouTube 동영상 재생 화면인지 분석하세요.

다음 정보를 JSON 형식으로 반환하세요:
{
  "isYouTubeScreen": boolean,
  "isPlaying": boolean,
  "progressPercentage": number,
  "videoTitle": string | null,
  "channelName": string | null,
  "confidence": number
}

주의사항:
1. progressPercentage는 빨간색 진행 바를 기준으로 추정하세요
2. 진행 바가 보이지 않으면 -1을 반환하세요
3. JSON만 반환하고 다른 설명은 포함하지 마세요`;

/**
 * PoV 검증용 프롬프트
 */
const POV_VERIFICATION_PROMPT = `당신은 동영상 시청 증명 검증 시스템입니다. 이 스크린샷이 유효한 YouTube 시청 증거인지 판단하세요.

검증 기준:
1. YouTube 앱/웹 화면이어야 함
2. 동영상이 실제로 재생 중이어야 함
3. 진행 바가 90% 이상이어야 완전 시청으로 인정
4. 광고 화면은 불인정

다음 JSON 형식으로 정확하게 반환하세요:
{
  "isYouTubeScreen": boolean,
  "isPlaying": boolean,
  "progressPercentage": number,
  "isAd": boolean,
  "confidence": number,
  "verdict": "VALID" | "INVALID" | "INSUFFICIENT",
  "reason": string
}`;

/**
 * Vision 분석 응답 파싱
 */
function parseVisionResponse(response) {
  try {
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      isYouTubeScreen: Boolean(parsed.isYouTubeScreen),
      isPlaying: Boolean(parsed.isPlaying),
      progressPercentage: Number(parsed.progressPercentage) || -1,
      videoTitle: parsed.videoTitle || undefined,
      channelName: parsed.channelName || undefined,
      confidence: Number(parsed.confidence) || 0,
      rawAnalysis: response,
    };
  } catch {
    return {
      isYouTubeScreen: false,
      isPlaying: false,
      progressPercentage: -1,
      confidence: 0,
      rawAnalysis: response,
    };
  }
}

/**
 * YouTube 스크린샷 분석
 */
async function analyzeYouTubeScreen(imageBase64, model = 'gpt-4o') {
  const client = getOpenAIClient();
  const response = await client.analyzeImage(
    imageBase64,
    YOUTUBE_ANALYSIS_PROMPT,
    model
  );

  return parseVisionResponse(response);
}

/**
 * Proof of View (시청 증명) 검증
 */
async function verifyProofOfView(imageBase64, minProgress = 90) {
  const client = getOpenAIClient();
  const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

  try {
    const response = await client.analyzeImage(
      imageBase64,
      POV_VERIFICATION_PROMPT,
      visionModel
    );

    let parsed;
    try {
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      return {
        verified: false,
        reason: '응답 파싱 실패',
        analysis: {
          isYouTubeScreen: false,
          isPlaying: false,
          progressPercentage: -1,
          confidence: 0,
          rawAnalysis: response,
        },
        timestamp: new Date(),
      };
    }

    const analysis = {
      isYouTubeScreen: Boolean(parsed.isYouTubeScreen),
      isPlaying: Boolean(parsed.isPlaying),
      progressPercentage: Number(parsed.progressPercentage) || -1,
      confidence: Number(parsed.confidence) || 0,
      rawAnalysis: response,
    };

    let verified = false;
    let reason = '';

    if (!analysis.isYouTubeScreen) {
      reason = 'YouTube 화면이 아님';
    } else if (parsed.isAd) {
      reason = '광고 화면은 시청 증명 불인정';
    } else if (!analysis.isPlaying) {
      reason = '동영상이 재생 중이 아님';
    } else if (analysis.progressPercentage < 0) {
      reason = '진행률 확인 불가';
    } else if (analysis.progressPercentage < minProgress) {
      reason = `진행률 부족 (${analysis.progressPercentage}% < ${minProgress}%)`;
    } else if (analysis.confidence < 0.7) {
      reason = `분석 신뢰도 부족 (${(analysis.confidence * 100).toFixed(0)}%)`;
    } else {
      verified = true;
      reason = `시청 증명 완료 (진행률: ${analysis.progressPercentage}%)`;
    }

    return {
      verified,
      reason,
      analysis,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      verified: false,
      reason: `검증 실패: ${error.message}`,
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
}

/**
 * 스크린샷 유효성 사전 검사
 */
function validateScreenshot(imageBase64) {
  const base64Regex = /^data:image\/(jpeg|png|gif|webp);base64,/;
  const isDataUrl = base64Regex.test(imageBase64);
  const isPureBase64 = /^[A-Za-z0-9+/]+=*$/.test(imageBase64.slice(0, 100));

  if (!isDataUrl && !isPureBase64) {
    return { valid: false, error: '유효하지 않은 이미지 형식' };
  }

  const sizeInBytes = (imageBase64.length * 3) / 4;
  const maxSize = 10 * 1024 * 1024;

  if (sizeInBytes > maxSize) {
    return { valid: false, error: '이미지 크기 초과 (최대 10MB)' };
  }

  return { valid: true };
}

module.exports = {
  analyzeYouTubeScreen,
  verifyProofOfView,
  validateScreenshot,
};

