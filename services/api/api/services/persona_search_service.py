"""
PersonaSearchService - 페르소나 IDLE 검색 서비스

P1: 대기 상태에서 OpenAI로 성격 기반 검색어를 생성하고,
검색 활동을 통해 페르소나의 고유성을 형성하는 시스템

핵심 개념: 인간의 유아기처럼, AI의 초기 검색 활동은
성격 형성에 결정적인 영향을 미친다.

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

import asyncio
import random
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import uuid4
import logging

# AI 클라이언트 옵셔널 임포트
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    AsyncOpenAI = None

try:
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    AsyncAnthropic = None

# Supabase 클라이언트
import sys
sys.path.insert(0, '/mnt/d/exe.blue/aifarm')
from shared.supabase_client import get_client

logger = logging.getLogger("persona_search_service")


# ==================== 성격 → 카테고리 매핑 ====================

TRAIT_CATEGORY_MAP = {
    "curiosity": ["과학", "다큐", "기술", "역사", "우주", "미스터리"],
    "enthusiasm": ["챌린지", "신제품", "트렌드", "핫이슈", "신작", "핫플"],
    "skepticism": ["분석", "리뷰", "비교", "팩트체크", "논쟁", "검증"],
    "empathy": ["힐링", "감동", "동물", "일상", "위로", "공감"],
    "humor": ["코미디", "밈", "몰카", "예능", "웃긴", "개그"],
    "expertise": ["강의", "튜토리얼", "전문가", "심층분석", "마스터클래스"],
    "formality": ["뉴스", "공식채널", "공식발표", "기업", "정부"],
    "verbosity": ["토크쇼", "팟캐스트", "인터뷰", "수다", "대담"],
}

# 폴백 검색어 (AI 실패 시)
FALLBACK_KEYWORDS = [
    "브이로그", "먹방", "게임", "음악", "뉴스",
    "요리", "운동", "영화 리뷰", "일상", "챌린지",
    "ASMR", "공부", "여행", "펫", "뷰티",
    "IT 리뷰", "토크쇼", "다큐", "코미디", "드라마 리뷰"
]


class PersonaSearchService:
    """
    페르소나 IDLE 검색 서비스

    핵심 기능:
    1. OpenAI로 페르소나 성격 기반 검색어 생성
    2. 검색 기록 저장 및 관리
    3. 고유성 형성 (Formative Period Effect)

    Usage:
        service = get_persona_search_service()
        result = await service.execute_idle_search(persona_id)
    """

    def __init__(self):
        """서비스 초기화"""
        self.client = get_client()
        self._openai: Optional[Any] = None
        self._anthropic: Optional[Any] = None
        self._init_ai_clients()

    def _init_ai_clients(self) -> None:
        """AI 클라이언트 초기화"""
        # OpenAI
        if HAS_OPENAI:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self._openai = AsyncOpenAI(api_key=api_key)
                logger.info("OpenAI 클라이언트 초기화 완료")

        # Anthropic
        if HAS_ANTHROPIC:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if api_key:
                self._anthropic = AsyncAnthropic(api_key=api_key)
                logger.info("Anthropic 클라이언트 초기화 완료")

    # ==================== 핵심 메서드 ====================

    async def execute_idle_search(
        self,
        persona_id: str,
        force: bool = False,
        category_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        IDLE 상태 검색 실행

        플로우:
        1. 페르소나 조회 및 상태 확인
        2. 검색어 생성 (OpenAI → Traits 폴백)
        3. 고유성 형성 영향도 계산
        4. 활동 로그 저장
        5. 페르소나 상태 업데이트

        Args:
            persona_id: 페르소나 ID
            force: IDLE 상태가 아니어도 강제 실행
            category_hint: 카테고리 힌트

        Returns:
            실행 결과 딕셔너리
        """
        # 1. 페르소나 조회
        persona = await self.get_persona(persona_id)
        if not persona:
            raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

        # 2. 상태 확인 (force가 아니면 WAITING 상태만 허용)
        existence_state = persona.get("existence_state", "active")
        if not force and existence_state not in ("waiting", "active"):
            raise ValueError(
                f"페르소나가 IDLE 상태가 아닙니다: {existence_state}"
            )

        # 3. 최근 검색어 조회 (중복 방지)
        recent_keywords = await self._get_recent_search_keywords(persona_id, limit=10)

        # 4. 검색어 생성
        keyword, source = await self.generate_keyword_for_persona(
            persona=persona,
            category_hint=category_hint,
            exclude_keywords=recent_keywords
        )

        # 5. 고유성 형성 영향도 계산
        formative_impact = self._calculate_formative_impact(persona)

        # 6. 활동 로그 저장
        activity_log_id = await self._log_search_activity(
            persona_id=persona_id,
            keyword=keyword,
            source=source,
            formative_impact=formative_impact
        )

        # 7. 페르소나 상태 업데이트
        await self._update_persona_called(persona_id)

        logger.info(
            f"IDLE 검색 완료: persona={persona.get('name')}, "
            f"keyword='{keyword}', source={source}, impact={formative_impact:.2f}"
        )

        return {
            "success": True,
            "persona_id": persona_id,
            "generated_keyword": keyword,
            "search_source": source,
            "activity_log_id": activity_log_id,
            "formative_impact": formative_impact,
            "message": f"'{keyword}' 검색어로 검색 준비 완료"
        }

    async def generate_keyword_for_persona(
        self,
        persona: Dict[str, Any],
        category_hint: Optional[str] = None,
        exclude_keywords: Optional[List[str]] = None
    ) -> Tuple[str, str]:
        """
        페르소나 성격에 맞는 검색어 생성

        Args:
            persona: 페르소나 데이터
            category_hint: 카테고리 힌트
            exclude_keywords: 제외할 키워드

        Returns:
            (keyword, source) 튜플
        """
        # 1. 성격 기반 프롬프트 구성
        prompt = self._build_persona_prompt(persona, category_hint, exclude_keywords)

        # 2. OpenAI 호출 시도
        keyword = None
        if self._openai:
            try:
                keyword = await self._generate_with_openai(prompt)
                if keyword:
                    return (keyword, "ai_generated")
            except Exception as e:
                logger.warning(f"OpenAI 생성 실패: {e}")

        # 3. Anthropic 폴백
        if self._anthropic and not keyword:
            try:
                keyword = await self._generate_with_anthropic(prompt)
                if keyword:
                    return (keyword, "ai_generated")
            except Exception as e:
                logger.warning(f"Anthropic 생성 실패: {e}")

        # 4. Traits 기반 폴백
        keyword = self._generate_from_traits(persona, exclude_keywords)
        return (keyword, "trait_based")

    def _build_persona_prompt(
        self,
        persona: Dict[str, Any],
        category_hint: Optional[str],
        exclude_keywords: Optional[List[str]]
    ) -> str:
        """페르소나 맞춤 프롬프트 구성"""
        name = persona.get("name", "알 수 없음")
        age = persona.get("age", "알 수 없음")
        interests = persona.get("interests", []) or []

        # 성격 특성 추출 (traits_xxx 컬럼들)
        traits = {
            "curiosity": persona.get("traits_curiosity", 50),
            "enthusiasm": persona.get("traits_enthusiasm", 50),
            "skepticism": persona.get("traits_skepticism", 50),
            "empathy": persona.get("traits_empathy", 50),
            "humor": persona.get("traits_humor", 50),
            "expertise": persona.get("traits_expertise", 50),
            "formality": persona.get("traits_formality", 50),
            "verbosity": persona.get("traits_verbosity", 50),
        }

        # 성격 특성 설명 구성 (70 이상인 것들)
        personality_desc = []
        if traits["curiosity"] > 70:
            personality_desc.append("호기심이 많고 새로운 것을 탐구하는")
        if traits["enthusiasm"] > 70:
            personality_desc.append("열정적이고 트렌드에 민감한")
        if traits["skepticism"] > 70:
            personality_desc.append("비판적이고 분석을 좋아하는")
        if traits["empathy"] > 70:
            personality_desc.append("공감능력이 높고 감성적인")
        if traits["humor"] > 70:
            personality_desc.append("유머를 즐기고 재미를 추구하는")
        if traits["expertise"] > 70:
            personality_desc.append("전문적인 지식을 탐구하는")
        if traits["formality"] > 70:
            personality_desc.append("격식을 중시하고 정확한 정보를 선호하는")
        if traits["verbosity"] > 70:
            personality_desc.append("대화와 토론을 즐기는")

        # 관심사 문자열
        interests_str = ", ".join(interests) if interests else "다양한 주제"
        personality_str = ", ".join(personality_desc) if personality_desc else "평범한 성격의"

        prompt = f"""당신은 {name}이라는 페르소나입니다.
나이: {age}세
성격: {personality_str}
관심사: {interests_str}

지금 심심해서 유튜브에서 뭔가를 검색하려고 합니다.
당신의 성격과 관심사에 맞는 자연스러운 검색어를 하나만 생성해주세요.

조건:
1. 한국어로 3-15자 사이
2. 너무 일반적이지 않고 당신만의 개성이 드러나는
3. 실제로 유튜브에서 검색할 법한 자연스러운 표현

{f'카테고리 힌트: {category_hint}' if category_hint else ''}
{f'이전에 검색한 것들은 피해주세요: {", ".join(exclude_keywords[:5])}' if exclude_keywords else ''}

검색어만 출력하세요. 따옴표나 설명 없이 검색어만요.

검색어:"""

        return prompt

    async def _generate_with_openai(self, prompt: str) -> Optional[str]:
        """OpenAI로 검색어 생성"""
        if not self._openai:
            return None

        response = await self._openai.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "유튜브 검색어만 출력하세요. 따옴표 없이, 설명 없이, 검색어만요."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=30,
            temperature=0.9  # 높은 온도로 다양성 확보
        )

        keyword = response.choices[0].message.content.strip()
        return self._clean_keyword(keyword)

    async def _generate_with_anthropic(self, prompt: str) -> Optional[str]:
        """Anthropic으로 검색어 생성"""
        if not self._anthropic:
            return None

        response = await self._anthropic.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=30,
            messages=[{"role": "user", "content": prompt}]
        )

        keyword = response.content[0].text.strip()
        return self._clean_keyword(keyword)

    @staticmethod
    def _clean_keyword(keyword: str) -> Optional[str]:
        """검색어 후처리"""
        if not keyword:
            return None

        # 따옴표 제거
        keyword = keyword.strip('"\'')

        # 줄바꿈 제거 (첫 줄만)
        keyword = keyword.split('\n')[0]

        # 공백 정리
        keyword = keyword.strip()

        # 길이 제한
        if len(keyword) > 30:
            keyword = keyword[:30]

        # 너무 짧으면 무효
        if len(keyword) < 2:
            return None

        return keyword

    def _generate_from_traits(
        self,
        persona: Dict[str, Any],
        exclude_keywords: Optional[List[str]] = None
    ) -> str:
        """Traits 기반 폴백 검색어 생성"""
        # 가장 높은 trait 찾기
        traits = {
            "curiosity": persona.get("traits_curiosity", 50),
            "enthusiasm": persona.get("traits_enthusiasm", 50),
            "skepticism": persona.get("traits_skepticism", 50),
            "empathy": persona.get("traits_empathy", 50),
            "humor": persona.get("traits_humor", 50),
            "expertise": persona.get("traits_expertise", 50),
            "formality": persona.get("traits_formality", 50),
            "verbosity": persona.get("traits_verbosity", 50),
        }

        # 상위 2개 trait 선택
        sorted_traits = sorted(traits.items(), key=lambda x: x[1], reverse=True)[:2]

        # 카테고리 후보 수집
        categories = []
        for trait_name, _ in sorted_traits:
            categories.extend(TRAIT_CATEGORY_MAP.get(trait_name, []))

        # 제외 키워드 필터링
        if exclude_keywords:
            categories = [c for c in categories if c not in exclude_keywords]

        # 없으면 폴백 사용
        if not categories:
            available = [k for k in FALLBACK_KEYWORDS if k not in (exclude_keywords or [])]
            return random.choice(available or FALLBACK_KEYWORDS)

        return random.choice(categories)

    def _calculate_formative_impact(self, persona: Dict[str, Any]) -> float:
        """
        고유성 형성 영향도 계산 (Formative Period Effect)

        인간의 유아기처럼, AI 페르소나도 초기 경험이
        성격 형성에 큰 영향을 미침

        - 생성 후 7일 이내: 0.8~1.0 (유아기 - 높은 영향)
        - 7일~30일: 0.4~0.8 (아동기 - 중간 영향)
        - 30일 이후: 0.1~0.4 (성인기 - 낮은 영향)
        """
        created_at_str = persona.get("created_at")

        if not created_at_str:
            return 0.5  # 기본값

        # 문자열이면 파싱
        if isinstance(created_at_str, str):
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except ValueError:
                return 0.5
        else:
            created_at = created_at_str

        now = datetime.now(timezone.utc)
        days_since_creation = (now - created_at).days

        # 활동량도 고려 (많이 활동할수록 단일 활동 영향력 감소)
        total_activities = persona.get("total_activities", 0)
        activity_factor = max(0.5, 1.0 - (total_activities / 200))

        # 시간 기반 영향도
        if days_since_creation <= 7:
            # 유아기: 0.8 ~ 1.0
            time_factor = 0.8 + random.uniform(0, 0.2)
        elif days_since_creation <= 30:
            # 아동기: 0.4 ~ 0.8
            time_factor = 0.4 + random.uniform(0, 0.4)
        else:
            # 성인기: 0.1 ~ 0.4
            time_factor = 0.1 + random.uniform(0, 0.3)

        # 최종 영향도 = 시간 요소 * 활동량 요소
        impact = min(1.0, time_factor * activity_factor)

        return round(impact, 3)

    # ==================== 데이터 접근 메서드 ====================

    async def get_persona(self, persona_id: str) -> Optional[Dict[str, Any]]:
        """페르소나 조회"""
        try:
            result = self.client.table("personas").select("*").eq(
                "id", persona_id
            ).single().execute()
            return result.data
        except Exception as e:
            logger.error(f"페르소나 조회 실패: {e}")
            return None

    async def list_personas(
        self,
        state: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """페르소나 목록 조회"""
        try:
            query = self.client.table("personas").select("*")

            if state:
                query = query.eq("existence_state", state)

            result = query.order(
                "created_at", desc=True
            ).range(offset, offset + limit - 1).execute()

            return {
                "success": True,
                "personas": result.data or [],
                "total": len(result.data or [])
            }
        except Exception as e:
            logger.error(f"페르소나 목록 조회 실패: {e}")
            return {"success": False, "personas": [], "total": 0}

    async def _get_recent_search_keywords(
        self,
        persona_id: str,
        limit: int = 10
    ) -> List[str]:
        """최근 검색어 조회 (중복 방지용)"""
        try:
            result = self.client.table("persona_activity_logs").select(
                "search_keyword"
            ).eq("persona_id", persona_id).eq(
                "activity_type", "idle_search"
            ).order("created_at", desc=True).limit(limit).execute()

            return [
                row["search_keyword"]
                for row in (result.data or [])
                if row.get("search_keyword")
            ]
        except Exception as e:
            logger.error(f"최근 검색어 조회 실패: {e}")
            return []

    async def _log_search_activity(
        self,
        persona_id: str,
        keyword: str,
        source: str,
        formative_impact: float
    ) -> str:
        """검색 활동 로그 저장"""
        log_id = str(uuid4())

        try:
            self.client.table("persona_activity_logs").insert({
                "id": log_id,
                "persona_id": persona_id,
                "activity_type": "idle_search",
                "search_keyword": keyword,
                "search_source": source,
                "formative_impact": formative_impact,
                "points_earned": 15,  # IDLE_SEARCH 기본 보상
                "uniqueness_delta": 0.02 * formative_impact,  # 고유성 변화
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()

            logger.debug(f"검색 활동 로그 저장: {log_id}")
        except Exception as e:
            logger.error(f"검색 활동 로그 저장 실패: {e}")

        return log_id

    async def _update_persona_called(self, persona_id: str) -> None:
        """페르소나 호출 시간 및 활동 수 업데이트"""
        try:
            # 현재 활동 수 조회
            result = self.client.table("personas").select(
                "total_activities"
            ).eq("id", persona_id).single().execute()

            current_activities = (result.data or {}).get("total_activities", 0)

            # 업데이트
            self.client.table("personas").update({
                "last_called_at": datetime.now(timezone.utc).isoformat(),
                "existence_state": "active",
                "total_activities": current_activities + 1
            }).eq("id", persona_id).execute()

        except Exception as e:
            logger.error(f"페르소나 상태 업데이트 실패: {e}")

    async def get_search_history(
        self,
        persona_id: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """검색 기록 조회"""
        try:
            result = self.client.table("persona_activity_logs").select(
                "id, search_keyword, search_source, created_at, "
                "target_url, target_title, formative_impact"
            ).eq("persona_id", persona_id).eq(
                "activity_type", "idle_search"
            ).order("created_at", desc=True).limit(limit).execute()

            history = [
                {
                    "id": row["id"],
                    "keyword": row.get("search_keyword", ""),
                    "search_source": row.get("search_source", "unknown"),
                    "searched_at": row["created_at"],
                    "video_watched": row.get("target_url"),
                    "video_title": row.get("target_title"),
                    "formative_impact": row.get("formative_impact", 0.0)
                }
                for row in (result.data or [])
            ]

            return {
                "success": True,
                "persona_id": persona_id,
                "total": len(history),
                "history": history,
                "traits_influence": {}  # TODO: P2에서 구현
            }
        except Exception as e:
            logger.error(f"검색 기록 조회 실패: {e}")
            return {
                "success": False,
                "persona_id": persona_id,
                "total": 0,
                "history": [],
                "traits_influence": {}
            }

    async def get_search_profile(self, persona_id: str) -> Dict[str, Any]:
        """검색 프로필 조회 (고유성 분석)"""
        try:
            # 페르소나 기본 정보
            persona = await self.get_persona(persona_id)
            if not persona:
                raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

            # 검색 통계 조회
            result = self.client.table("persona_activity_logs").select(
                "search_keyword, formative_impact, created_at"
            ).eq("persona_id", persona_id).eq(
                "activity_type", "idle_search"
            ).order("created_at").execute()

            logs = result.data or []

            # 통계 계산
            keywords = [log.get("search_keyword") for log in logs if log.get("search_keyword")]
            impacts = [log.get("formative_impact", 0) for log in logs]

            formative_count = sum(1 for i in impacts if i > 0.5)

            return {
                "success": True,
                "data": {
                    "persona_id": persona_id,
                    "persona_name": persona.get("name", "Unknown"),
                    "total_searches": len(logs),
                    "unique_keywords": len(set(keywords)),
                    "top_categories": [],  # TODO: 카테고리 분석
                    "formative_period_searches": formative_count,
                    "avg_formative_impact": sum(impacts) / len(impacts) if impacts else 0,
                    "personality_drift": 0.0,  # TODO: P2
                    "interests_evolved": [],  # TODO: P2
                    "first_search_at": logs[0]["created_at"] if logs else None,
                    "last_search_at": logs[-1]["created_at"] if logs else None,
                }
            }
        except Exception as e:
            logger.error(f"검색 프로필 조회 실패: {e}")
            raise


# ==================== 싱글톤 ====================

_service: Optional[PersonaSearchService] = None


def get_persona_search_service() -> PersonaSearchService:
    """PersonaSearchService 싱글톤 반환"""
    global _service
    if _service is None:
        _service = PersonaSearchService()
    return _service
