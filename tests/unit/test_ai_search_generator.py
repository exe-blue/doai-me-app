"""
AISearchGenerator 단위 테스트

테스트 대상:
- _get_fallback_keyword() - 폴백 키워드 반환
- _clean_keyword() - 검색어 정제
- _build_prompt() - AI 프롬프트 생성
- generate_keyword() - Mock AI 응답 테스트
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from shared.ai_search_generator import (
    AISearchGenerator,
    FALLBACK_KEYWORDS,
    CATEGORY_PROMPTS,
)


class TestGetFallbackKeyword:
    """폴백 키워드 테스트"""
    
    def test_returns_from_fallback_list(self):
        """폴백 목록에서 키워드 반환"""
        keyword = AISearchGenerator._get_fallback_keyword()
        assert keyword in FALLBACK_KEYWORDS
    
    def test_returns_different_keywords(self):
        """여러 번 호출 시 다양한 키워드 반환"""
        keywords = set()
        for _ in range(50):
            keyword = AISearchGenerator._get_fallback_keyword()
            keywords.add(keyword)
        
        # 최소 5개 이상의 다른 키워드가 반환되어야 함
        assert len(keywords) >= 5
    
    def test_excludes_specified_keywords(self):
        """제외 키워드 필터링"""
        exclude = FALLBACK_KEYWORDS[:5]
        
        for _ in range(20):
            keyword = AISearchGenerator._get_fallback_keyword(exclude_keywords=exclude)
            assert keyword not in exclude
    
    def test_exclude_all_but_one(self):
        """거의 모든 키워드 제외"""
        # 마지막 하나만 남기고 제외
        exclude = FALLBACK_KEYWORDS[:-1]
        keyword = AISearchGenerator._get_fallback_keyword(exclude_keywords=exclude)
        assert keyword == FALLBACK_KEYWORDS[-1]
    
    def test_exclude_empty_list(self):
        """빈 제외 목록"""
        keyword = AISearchGenerator._get_fallback_keyword(exclude_keywords=[])
        assert keyword in FALLBACK_KEYWORDS
    
    def test_exclude_none(self):
        """None 제외 목록"""
        keyword = AISearchGenerator._get_fallback_keyword(exclude_keywords=None)
        assert keyword in FALLBACK_KEYWORDS


class TestCleanKeyword:
    """검색어 정제 테스트"""
    
    def test_remove_double_quotes(self):
        """큰따옴표 제거"""
        assert AISearchGenerator._clean_keyword('"브이로그"') == "브이로그"
        assert AISearchGenerator._clean_keyword('"게임 플레이"') == "게임 플레이"
    
    def test_remove_single_quotes(self):
        """작은따옴표 제거"""
        assert AISearchGenerator._clean_keyword("'먹방'") == "먹방"
        assert AISearchGenerator._clean_keyword("'요리 레시피'") == "요리 레시피"
    
    def test_remove_newlines(self):
        """줄바꿈 제거 (첫 줄만 사용)"""
        assert AISearchGenerator._clean_keyword("먹방\n설명입니다") == "먹방"
        assert AISearchGenerator._clean_keyword("게임\n\n추가 정보") == "게임"
    
    def test_strip_whitespace(self):
        """앞뒤 공백 제거"""
        assert AISearchGenerator._clean_keyword("  요리  ") == "요리"
        assert AISearchGenerator._clean_keyword("\t음악\t") == "음악"
    
    def test_combined_cleaning(self):
        """복합 정제"""
        assert AISearchGenerator._clean_keyword('"  브이로그  "\n추가') == "브이로그"
        assert AISearchGenerator._clean_keyword("'  게임  '") == "게임"
    
    def test_empty_string(self):
        """빈 문자열"""
        assert AISearchGenerator._clean_keyword("") == ""
        assert AISearchGenerator._clean_keyword("   ") == ""
    
    def test_unicode_characters(self):
        """유니코드 문자"""
        assert AISearchGenerator._clean_keyword("한글 테스트") == "한글 테스트"
        assert AISearchGenerator._clean_keyword("日本語") == "日本語"
        assert AISearchGenerator._clean_keyword("🎮 게임") == "🎮 게임"


class TestBuildPrompt:
    """프롬프트 생성 테스트"""
    
    def test_default_prompt(self):
        """기본 프롬프트"""
        prompt = AISearchGenerator._build_prompt()
        assert "YouTube" in prompt or "검색" in prompt
    
    def test_gaming_category(self):
        """게임 카테고리"""
        prompt = AISearchGenerator._build_prompt(category="gaming")
        assert "게임" in prompt or "gaming" in prompt.lower()
    
    def test_music_category(self):
        """음악 카테고리"""
        prompt = AISearchGenerator._build_prompt(category="music")
        assert "음악" in prompt or "music" in prompt.lower()
    
    def test_with_context(self):
        """컨텍스트 포함"""
        prompt = AISearchGenerator._build_prompt(context="저녁 시간대, 20대 시청자")
        assert "저녁" in prompt or "20대" in prompt
    
    def test_with_exclude_keywords(self):
        """제외 키워드 포함"""
        exclude = ["먹방", "브이로그"]
        prompt = AISearchGenerator._build_prompt(exclude_keywords=exclude)
        assert "먹방" in prompt or "제외" in prompt
    
    def test_unknown_category(self):
        """알 수 없는 카테고리"""
        prompt = AISearchGenerator._build_prompt(category="unknown_category")
        # 에러 없이 기본 프롬프트 반환
        assert prompt is not None
        assert len(prompt) > 0


class TestGenerateKeyword:
    """키워드 생성 테스트 (Mock)"""
    
    @pytest.mark.asyncio
    async def test_generate_with_mock_openai(self):
        """Mock OpenAI 응답"""
        generator = AISearchGenerator()
        
        # OpenAI 클라이언트 Mock
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "게임 리뷰"
        
        with patch.object(generator, '_openai') as mock_openai:
            mock_openai.chat.completions.create = AsyncMock(return_value=mock_response)
            
            keyword = await generator.generate_keyword()
            
            # 폴백 또는 생성된 키워드
            assert keyword is not None
            assert len(keyword) > 0
    
    @pytest.mark.asyncio
    async def test_generate_fallback_on_error(self):
        """에러 시 폴백 반환"""
        generator = AISearchGenerator()
        generator._openai = None
        generator._anthropic = None
        
        keyword = await generator.generate_keyword()
        
        # 폴백 키워드 반환
        assert keyword in FALLBACK_KEYWORDS
    
    @pytest.mark.asyncio
    async def test_generate_with_category(self):
        """카테고리 지정 생성"""
        generator = AISearchGenerator()
        generator._openai = None
        generator._anthropic = None
        
        keyword = await generator.generate_keyword(category="gaming")
        
        # 폴백이라도 반환
        assert keyword is not None


class TestCategoryPrompts:
    """카테고리 프롬프트 상수 테스트"""
    
    def test_category_prompts_exist(self):
        """카테고리 프롬프트 존재 확인"""
        assert "gaming" in CATEGORY_PROMPTS
        assert "music" in CATEGORY_PROMPTS
        assert "entertainment" in CATEGORY_PROMPTS
    
    def test_category_prompts_not_empty(self):
        """프롬프트 내용 존재"""
        for category, prompt in CATEGORY_PROMPTS.items():
            assert len(prompt) > 0


class TestFallbackKeywords:
    """폴백 키워드 상수 테스트"""
    
    def test_fallback_keywords_exist(self):
        """폴백 키워드 목록 존재"""
        assert len(FALLBACK_KEYWORDS) > 0
    
    def test_fallback_keywords_diverse(self):
        """다양한 키워드 포함"""
        assert len(FALLBACK_KEYWORDS) >= 10
    
    def test_fallback_keywords_no_duplicates(self):
        """중복 키워드 없음"""
        assert len(FALLBACK_KEYWORDS) == len(set(FALLBACK_KEYWORDS))
