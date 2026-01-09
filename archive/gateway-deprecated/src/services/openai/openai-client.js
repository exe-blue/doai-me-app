/**
 * OpenAI Client
 * OpenAI API 통신을 담당하는 클라이언트
 *
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI API 클라이언트
 */
class OpenAIClient {
  constructor() {
    if (!OPENAI_API_KEY) {
      throw new Error('[OpenAI] OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    this.apiKey = OPENAI_API_KEY;
    this.projectId = OPENAI_PROJECT_ID;
  }

  /**
   * API 요청 헤더 생성
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.projectId) {
      headers['OpenAI-Project'] = this.projectId;
    }

    return headers;
  }

  /**
   * Chat Completion API 호출
   */
  async chatCompletion(messages, options = {}) {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stop,
    } = options;

    const requestBody = {
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    };

    if (stop) {
      requestBody.stop = stop;
    }

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `[OpenAI] API 오류: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();

      return {
        id: data.id,
        model: data.model,
        choices: data.choices.map((choice) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finishReason: choice.finish_reason,
        })),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`[OpenAI] 요청 실패: ${error.message}`);
    }
  }

  /**
   * Vision API 호출 (이미지 분석)
   */
  async analyzeImage(imageBase64, prompt, model = 'gpt-4o') {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ];

    const response = await this.chatCompletion(messages, {
      model,
      maxTokens: parseInt(process.env.OPENAI_VISION_MAX_TOKENS || '500', 10),
      temperature: 0.2,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 간단한 텍스트 생성
   */
  async generateText(systemPrompt, userPrompt, model = 'gpt-4o-mini') {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.chatCompletion(messages, { model });
    return response.choices[0]?.message?.content || '';
  }
}

// 싱글톤 인스턴스
let clientInstance = null;

/**
 * OpenAI 클라이언트 인스턴스 가져오기
 */
function getOpenAIClient() {
  if (!clientInstance) {
    clientInstance = new OpenAIClient();
  }
  return clientInstance;
}

module.exports = {
  OpenAIClient,
  getOpenAIClient,
};

