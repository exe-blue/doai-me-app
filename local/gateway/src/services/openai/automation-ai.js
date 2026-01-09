/**
 * automation-ai.js
 * OpenAI integration for YouTube automation
 * - Search keyword generation for idle mode
 * - Comment generation for engagement
 * - Persona-aware content generation
 */

const { getOpenAIClient } = require('./openai-client');

// Fallback keywords by category
const FALLBACK_KEYWORDS = {
  music: ['kpop 2024', '인기 음악', 'lofi hip hop', 'workout music', '감성 플레이리스트'],
  gaming: ['게임 리뷰', 'minecraft', 'valorant', '모바일 게임 추천', 'gaming highlights'],
  tech: ['갤럭시 리뷰', 'iPhone tips', '코딩 튜토리얼', 'AI 뉴스', '가성비 노트북'],
  lifestyle: ['일상 브이로그', '카페 추천', '자취 요리', 'morning routine', '인테리어'],
  entertainment: ['예능 모음', '드라마 리뷰', '영화 추천', 'funny moments', '웃긴 영상'],
  education: ['영어 공부', '수학 강의', '자기계발', 'study with me', 'TED'],
  sports: ['축구 하이라이트', 'NBA', '운동 루틴', 'workout', '요가'],
  food: ['먹방', '레시피', '맛집 탐방', 'cooking', 'asmr 음식'],
  travel: ['여행 브이로그', '제주도', '일본 여행', 'travel tips', '호캉스'],
  default: ['trending', '인기 동영상', 'viral', '추천 영상', 'shorts']
};

// Comment templates for fallback
const COMMENT_TEMPLATES = {
  positive: [
    '영상 잘 봤습니다!',
    '좋은 영상이네요 👍',
    '항상 좋은 영상 감사합니다',
    '유익한 내용이에요',
    '공감가는 영상입니다',
    '재밌게 봤어요~'
  ],
  question: [
    '다음 영상은 언제 올라오나요?',
    '더 자세한 내용 알려주세요',
    '관련 영상 더 있나요?'
  ],
  emoji: [
    '👍👍👍',
    '❤️',
    '🔥🔥',
    '😊'
  ]
};

class AutomationAI {
  constructor() {
    this.client = null;
    this.stats = {
      keywordsGenerated: 0,
      commentsGenerated: 0,
      fallbacksUsed: 0,
      errors: 0
    };
  }

  /**
   * Get OpenAI client (lazy initialization)
   */
  getClient() {
    if (!this.client) {
      try {
        this.client = getOpenAIClient();
      } catch (error) {
        console.warn('[AutomationAI] OpenAI client not available:', error.message);
        return null;
      }
    }
    return this.client;
  }

  /**
   * Generate search keyword for idle mode
   * @param {Object} persona - Persona data with traits
   * @param {Object} options - Generation options
   */
  async generateSearchKeyword(persona = null, options = {}) {
    const client = this.getClient();

    // If no client, use fallback
    if (!client) {
      return this._getFallbackKeyword(persona);
    }

    const {
      recentKeywords = [],
      preferredCategories = [],
      language = 'ko',
      maxLength = 30
    } = options;

    try {
      const systemPrompt = this._buildKeywordSystemPrompt(persona, language);
      const userPrompt = this._buildKeywordUserPrompt(recentKeywords, preferredCategories, maxLength);

      const response = await client.generateText(systemPrompt, userPrompt, 'gpt-4o-mini');

      // Clean and validate the keyword
      let keyword = this._cleanKeyword(response, maxLength);

      if (!keyword) {
        return this._getFallbackKeyword(persona);
      }

      this.stats.keywordsGenerated++;
      return {
        keyword,
        source: 'ai_generated',
        persona: persona?.id || null
      };

    } catch (error) {
      console.error('[AutomationAI] Keyword generation error:', error.message);
      this.stats.errors++;
      return this._getFallbackKeyword(persona);
    }
  }

  /**
   * Build system prompt for keyword generation
   */
  _buildKeywordSystemPrompt(persona, language) {
    let prompt = `You are a YouTube search keyword generator. Generate a single, natural search query that a real person would type.

Rules:
- Output ONLY the search keyword, nothing else
- Keep it natural and varied
- Mix of ${language === 'ko' ? 'Korean and English' : 'English'}
- Avoid overly generic terms
- Consider current trends`;

    if (persona) {
      prompt += `

The searcher has these traits:
- Personality: ${persona.traits?.personality || 'balanced'}
- Interests: ${persona.traits?.interests?.join(', ') || 'general'}
- Age group: ${persona.traits?.ageGroup || 'mixed'}
- Mood: ${persona.traits?.currentMood || 'neutral'}`;
    }

    return prompt;
  }

  /**
   * Build user prompt for keyword generation
   */
  _buildKeywordUserPrompt(recentKeywords, preferredCategories, maxLength) {
    let prompt = `Generate a YouTube search keyword (max ${maxLength} characters).`;

    if (recentKeywords.length > 0) {
      prompt += `\n\nAvoid these recently searched terms:\n- ${recentKeywords.slice(0, 5).join('\n- ')}`;
    }

    if (preferredCategories.length > 0) {
      prompt += `\n\nPreferred categories: ${preferredCategories.join(', ')}`;
    }

    return prompt;
  }

  /**
   * Clean and validate keyword
   */
  _cleanKeyword(raw, maxLength) {
    if (!raw) return null;

    // Remove quotes, extra whitespace, and trim
    let keyword = raw
      .replace(/["'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove any explanatory text
    if (keyword.includes(':')) {
      keyword = keyword.split(':').pop().trim();
    }
    if (keyword.includes('\n')) {
      keyword = keyword.split('\n')[0].trim();
    }

    // Truncate if too long
    if (keyword.length > maxLength) {
      keyword = keyword.substring(0, maxLength).trim();
    }

    // Validate minimum length
    if (keyword.length < 2) {
      return null;
    }

    return keyword;
  }

  /**
   * Get fallback keyword
   */
  _getFallbackKeyword(persona) {
    this.stats.fallbacksUsed++;

    // Determine category based on persona or random
    let category = 'default';
    if (persona?.traits?.interests?.length > 0) {
      const interest = persona.traits.interests[0].toLowerCase();
      if (FALLBACK_KEYWORDS[interest]) {
        category = interest;
      }
    } else {
      const categories = Object.keys(FALLBACK_KEYWORDS);
      category = categories[Math.floor(Math.random() * categories.length)];
    }

    const keywords = FALLBACK_KEYWORDS[category];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];

    return {
      keyword,
      source: 'fallback',
      category,
      persona: persona?.id || null
    };
  }

  /**
   * Generate comment for a video
   * @param {Object} videoInfo - Video information (title, description, channel)
   * @param {Object} persona - Persona data
   * @param {Object} options - Generation options
   */
  async generateComment(videoInfo, persona = null, options = {}) {
    const client = this.getClient();

    // If no client, use fallback
    if (!client) {
      return this._getFallbackComment();
    }

    const {
      tone = 'friendly',
      maxLength = 100,
      language = 'ko',
      includeEmoji = true
    } = options;

    try {
      const systemPrompt = this._buildCommentSystemPrompt(persona, tone, language, includeEmoji);
      const userPrompt = this._buildCommentUserPrompt(videoInfo, maxLength);

      const response = await client.generateText(systemPrompt, userPrompt, 'gpt-4o-mini');

      // Clean and validate the comment
      let comment = this._cleanComment(response, maxLength);

      if (!comment) {
        return this._getFallbackComment();
      }

      this.stats.commentsGenerated++;
      return {
        comment,
        source: 'ai_generated',
        videoTitle: videoInfo.title,
        persona: persona?.id || null
      };

    } catch (error) {
      console.error('[AutomationAI] Comment generation error:', error.message);
      this.stats.errors++;
      return this._getFallbackComment();
    }
  }

  /**
   * Build system prompt for comment generation
   */
  _buildCommentSystemPrompt(persona, tone, language, includeEmoji) {
    let prompt = `You are writing a YouTube comment. Generate a natural, human-like comment.

Rules:
- Output ONLY the comment text, nothing else
- Be ${tone} in tone
- Write in ${language === 'ko' ? 'Korean' : 'English'}
- ${includeEmoji ? 'Include 1-2 relevant emojis' : 'No emojis'}
- Sound like a real viewer
- Don't be overly promotional or spammy`;

    if (persona) {
      prompt += `

You are a ${persona.traits?.ageGroup || 'general'} viewer with a ${persona.traits?.personality || 'balanced'} personality.`;
    }

    return prompt;
  }

  /**
   * Build user prompt for comment generation
   */
  _buildCommentUserPrompt(videoInfo, maxLength) {
    let prompt = `Write a YouTube comment (max ${maxLength} characters) for this video:

Title: ${videoInfo.title}`;

    if (videoInfo.channel) {
      prompt += `\nChannel: ${videoInfo.channel}`;
    }

    if (videoInfo.description) {
      prompt += `\nDescription (first 200 chars): ${videoInfo.description.substring(0, 200)}`;
    }

    return prompt;
  }

  /**
   * Clean and validate comment
   */
  _cleanComment(raw, maxLength) {
    if (!raw) return null;

    // Remove quotes at start/end
    let comment = raw.replace(/^["']|["']$/g, '').trim();

    // Truncate if too long
    if (comment.length > maxLength) {
      comment = comment.substring(0, maxLength - 3) + '...';
    }

    // Validate minimum length
    if (comment.length < 2) {
      return null;
    }

    return comment;
  }

  /**
   * Get fallback comment
   */
  _getFallbackComment() {
    this.stats.fallbacksUsed++;

    // Random comment type
    const types = ['positive', 'emoji'];
    const type = types[Math.floor(Math.random() * types.length)];

    const comments = COMMENT_TEMPLATES[type];
    const comment = comments[Math.floor(Math.random() * comments.length)];

    return {
      comment,
      source: 'fallback',
      type
    };
  }

  /**
   * Generate multiple search keywords at once (batch)
   */
  async generateKeywordBatch(count, persona = null, options = {}) {
    const keywords = [];
    const recentKeywords = [...(options.recentKeywords || [])];

    for (let i = 0; i < count; i++) {
      const result = await this.generateSearchKeyword(persona, {
        ...options,
        recentKeywords
      });

      keywords.push(result);

      // Add to recent to avoid duplicates
      if (result.keyword) {
        recentKeywords.push(result.keyword);
      }
    }

    return keywords;
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      keywordsGenerated: 0,
      commentsGenerated: 0,
      fallbacksUsed: 0,
      errors: 0
    };
  }
}

// Singleton instance
let instance = null;

function getAutomationAI() {
  if (!instance) {
    instance = new AutomationAI();
  }
  return instance;
}

module.exports = {
  AutomationAI,
  getAutomationAI,
  FALLBACK_KEYWORDS,
  COMMENT_TEMPLATES
};
