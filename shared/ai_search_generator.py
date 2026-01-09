"""
AISearchGenerator - AI 검색어 생성 서비스

대기열이 비어있을 때 "심심한데 유튜브에서 뭐 검색할까?" 프롬프트로
AI에게 검색어를 생성받습니다.

지원 AI:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic Claude
- 로컬 LLM (Ollama)
"""

import asyncio
import random
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import uuid

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

# AI 클라이언트 옵셔널 임포트
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

from shared.supabase_client import get_client


# 기본 프롬프트 템플릿
DEFAULT_PROMPT = """당신은 유튜브에서 재미있는 영상을 찾고 싶은 사람입니다.
심심해서 뭔가 볼만한 걸 찾고 있어요.

다음 조건에 맞는 검색어를 하나만 생성해주세요:
1. 한국어 검색어
2. 3-10자 사이
3. 일반적이고 대중적인 주제
4. 너무 구체적이지 않은 것

검색어만 출력하세요. 따옴표나 설명 없이 검색어만요.

예시:
- 먹방
- 브이로그
- 게임 리뷰
- 요리 레시피
- 운동 루틴

검색어:"""

# 카테고리별 프롬프트
CATEGORY_PROMPTS = {
    "entertainment": "재미있는 예능, 버라이어티 콘텐츠 검색어를 생성해주세요.",
    "music": "음악, 노래, 뮤직비디오 관련 검색어를 생성해주세요.",
    "gaming": "게임, 게임 플레이, 게임 리뷰 관련 검색어를 생성해주세요.",
    "education": "교육, 강의, 배움 관련 검색어를 생성해주세요.",
    "lifestyle": "일상, 브이로그, 라이프스타일 관련 검색어를 생성해주세요.",
    "food": "음식, 요리, 먹방 관련 검색어를 생성해주세요.",
    "tech": "기술, IT, 가젯 관련 검색어를 생성해주세요.",
    "sports": "스포츠, 운동, 피트니스 관련 검색어를 생성해주세요.",
}

# 폴백 검색어 (AI 실패 시)
FALLBACK_KEYWORDS = [
    "브이로그", "먹방", "게임", "음악", "뉴스",
    "요리", "운동", "영화 리뷰", "일상", "챌린지",
    "ASMR", "공부", "여행", "펫", "뷰티",
    "IT 리뷰", "토크쇼", "다큐", "코미디", "드라마 리뷰"
]


@dataclass
class GeneratedKeyword:
    """생성된 검색어"""
    keyword: str
    prompt_template: str
    ai_model: str
    created_at: datetime


class AISearchGenerator:
    """
    AI 검색어 생성기
    
    Usage:
        generator = AISearchGenerator()
        
        # 기본 검색어 생성
        keyword = await generator.generate()
        print(keyword.keyword)  # "브이로그"
        
        # 카테고리별 검색어 생성
        keyword = await generator.generate(category="gaming")
        print(keyword.keyword)  # "롤 하이라이트"
    """
    
    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        anthropic_api_key: Optional[str] = None,
        preferred_model: str = "gpt-4-turbo"
    ):
        """
        AISearchGenerator 초기화
        
        Args:
            openai_api_key: OpenAI API 키 (None이면 환경변수)
            anthropic_api_key: Anthropic API 키 (None이면 환경변수)
            preferred_model: 선호 모델
        """
        self.preferred_model = preferred_model
        self.client = get_client()
        
        # OpenAI 클라이언트 초기화
        self._openai: Optional[Any] = None
        if HAS_OPENAI:
            api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
            if api_key:
                self._openai = AsyncOpenAI(api_key=api_key)
        
        # Anthropic 클라이언트 초기화
        self._anthropic: Optional[Any] = None
        if HAS_ANTHROPIC:
            api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
            if api_key:
                self._anthropic = AsyncAnthropic(api_key=api_key)
    
    async def generate(
        self,
        category: Optional[str] = None,
        context: Optional[str] = None,
        exclude_keywords: Optional[List[str]] = None
    ) -> GeneratedKeyword:
        """
        검색어 생성
        
        Args:
            category: 카테고리 (entertainment, gaming, etc.)
            context: 추가 컨텍스트
            exclude_keywords: 제외할 키워드 목록
        
        Returns:
            생성된 검색어
        """
        # 프롬프트 구성
        prompt = self._build_prompt(category, context, exclude_keywords)
        
        # AI 호출 시도
        keyword = None
        model_used = "fallback"
        
        # OpenAI 시도
        if self._openai and not keyword:
            try:
                keyword = await self._generate_with_openai(prompt)
                model_used = self.preferred_model
            except Exception as e:
                logger.warning(f"OpenAI 생성 실패: {e}")
        
        # Anthropic 시도
        if self._anthropic and not keyword:
            try:
                keyword = await self._generate_with_anthropic(prompt)
                model_used = "claude-3-sonnet"
            except Exception as e:
                logger.warning(f"Anthropic 생성 실패: {e}")
        
        # 폴백
        if not keyword:
            keyword = self._get_fallback_keyword(exclude_keywords)
            model_used = "fallback"
            logger.info("AI 실패, 폴백 키워드 사용")
        
        # 결과 생성
        result = GeneratedKeyword(
            keyword=keyword,
            prompt_template=category or "default",
            ai_model=model_used,
            created_at=datetime.now(timezone.utc)
        )
        
        # DB에 로깅
        await self._log_generation(result)
        
        logger.info(f"검색어 생성: '{keyword}' (model={model_used})")
        
        return result
    
    async def generate_batch(
        self,
        count: int = 5,
        categories: Optional[List[str]] = None
    ) -> List[GeneratedKeyword]:
        """
        여러 검색어 일괄 생성
        
        Args:
            count: 생성할 개수
            categories: 사용할 카테고리들 (None이면 랜덤)
        
        Returns:
            생성된 검색어 리스트
        """
        results = []
        used_keywords: List[str] = []
        
        available_categories = categories or list(CATEGORY_PROMPTS.keys()) + [None]
        
        for i in range(count):
            category = random.choice(available_categories)
            
            try:
                keyword = await self.generate(
                    category=category,
                    exclude_keywords=used_keywords
                )
                results.append(keyword)
                used_keywords.append(keyword.keyword)
            except Exception as e:
                logger.error(f"배치 생성 실패 ({i+1}/{count}): {e}")
        
        return results
    
    async def get_recent_keywords(self, limit: int = 20) -> List[str]:
        """최근 생성된 검색어 목록"""
        try:
            result = self.client.table("ai_search_logs").select(
                "generated_keyword"
            ).order("created_at", desc=True).limit(limit).execute()
            
            return [row["generated_keyword"] for row in (result.data or [])]
        except Exception as e:
            logger.error(f"최근 검색어 조회 실패: {e}")
            return []
    
    @staticmethod
    def _build_prompt(
        category: Optional[str],
        context: Optional[str],
        exclude_keywords: Optional[List[str]]
    ) -> str:
        """프롬프트 구성"""
        base_prompt = DEFAULT_PROMPT
        
        # 카테고리 프롬프트 추가
        if category and category in CATEGORY_PROMPTS:
            base_prompt = base_prompt.replace(
                "검색어:",
                f"{CATEGORY_PROMPTS[category]}\n\n검색어:"
            )
        
        # 컨텍스트 추가
        if context:
            base_prompt = base_prompt.replace(
                "검색어:",
                f"추가 조건: {context}\n\n검색어:"
            )
        
        # 제외 키워드 추가
        if exclude_keywords:
            exclude_str = ", ".join(exclude_keywords[:10])
            base_prompt = base_prompt.replace(
                "검색어:",
                f"다음 키워드는 피해주세요: {exclude_str}\n\n검색어:"
            )
        
        return base_prompt
    
    async def _generate_with_openai(self, prompt: str) -> Optional[str]:
        """OpenAI로 생성"""
        if not self._openai:
            return None
        
        response = await self._openai.chat.completions.create(
            model=self.preferred_model,
            messages=[
                {"role": "system", "content": "당신은 유튜브 검색어를 제안하는 도우미입니다. 짧고 자연스러운 한국어 검색어만 출력하세요."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=50,
            temperature=0.9
        )
        
        keyword = response.choices[0].message.content.strip()
        
        # 후처리
        keyword = self._clean_keyword(keyword)
        
        return keyword if keyword else None
    
    async def _generate_with_anthropic(self, prompt: str) -> Optional[str]:
        """Anthropic으로 생성"""
        if not self._anthropic:
            return None
        
        response = await self._anthropic.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=50,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        keyword = response.content[0].text.strip()
        
        # 후처리
        keyword = self._clean_keyword(keyword)
        
        return keyword if keyword else None
    
    @staticmethod
    def _clean_keyword(keyword: str) -> str:
        """검색어 후처리"""
        # 따옴표 제거
        keyword = keyword.strip('"\'')
        
        # 줄바꿈 제거
        keyword = keyword.split('\n')[0]
        
        # 앞뒤 공백 제거
        keyword = keyword.strip()
        
        # 너무 긴 경우 자르기
        if len(keyword) > 30:
            keyword = keyword[:30]
        
        return keyword
    
    @staticmethod
    def _get_fallback_keyword(
        exclude_keywords: Optional[List[str]] = None
    ) -> str:
        """폴백 검색어 가져오기"""
        available = FALLBACK_KEYWORDS.copy()
        
        if exclude_keywords:
            available = [k for k in available if k not in exclude_keywords]
        
        if not available:
            available = FALLBACK_KEYWORDS.copy()
        
        return random.choice(available)
    
    async def _log_generation(self, result: GeneratedKeyword) -> None:
        """생성 로그 DB 저장"""
        try:
            data = {
                "id": str(uuid.uuid4()),
                "prompt_template": result.prompt_template,
                "generated_keyword": result.keyword,
                "ai_model": result.ai_model,
                "was_used": False,
                "created_at": result.created_at.isoformat()
            }
            
            self.client.table("ai_search_logs").insert(data).execute()
        except Exception as e:
            logger.error(f"생성 로그 저장 실패: {e}")
    
    async def mark_keyword_used(self, keyword: str) -> None:
        """검색어 사용 표시"""
        try:
            self.client.table("ai_search_logs").update({
                "was_used": True,
                "used_at": datetime.now(timezone.utc).isoformat()
            }).eq("generated_keyword", keyword).is_("was_used", False).execute()
        except Exception as e:
            logger.error(f"검색어 사용 표시 실패: {e}")


# 싱글톤 인스턴스
_generator: Optional[AISearchGenerator] = None


def get_ai_search_generator() -> AISearchGenerator:
    """AISearchGenerator 싱글톤 반환"""
    global _generator
    if _generator is None:
        _generator = AISearchGenerator()
    return _generator
