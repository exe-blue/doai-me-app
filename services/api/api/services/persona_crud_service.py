"""
PersonaCrudService - 페르소나 CRUD 서비스

P2: 페르소나 생성/수정/삭제 및 성격 분석
- Create/Update/Delete 기능
- 성격 변화(Personality Drift) 분석
- 관심사 자동 업데이트

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import uuid4
from collections import Counter

# Supabase 클라이언트 (Docker/standalone 호환)
try:
    from ..db import get_supabase_client as get_client
except ImportError:
    try:
        from db import get_supabase_client as get_client
    except ImportError:
        import sys
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        sys.path.insert(0, project_root)
        try:
            from shared.supabase_client import get_client
        except ImportError:
            from supabase import create_client
            def get_client():
                url = os.getenv("SUPABASE_URL")
                key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
                return create_client(url, key)

logger = logging.getLogger("persona_crud_service")


# ==================== Mock Mode ====================

def _is_mock_mode() -> bool:
    """런타임에 Mock 모드 확인"""
    return os.getenv("MOCK_MODE", "").lower() in ("true", "1", "yes")


# Mock 데이터 저장소
_mock_personas: List[Dict[str, Any]] = []
_mock_activity_logs: List[Dict[str, Any]] = []


# 카테고리 매핑 (검색어 → 카테고리)
KEYWORD_CATEGORY_MAP = {
    # 기술/IT
    "AI": "기술", "인공지능": "기술", "GPT": "기술", "테크": "기술",
    "IT": "기술", "개발": "기술", "코딩": "기술", "프로그래밍": "기술",
    "스마트폰": "기술", "아이폰": "기술", "갤럭시": "기술",

    # 게임
    "게임": "게임", "롤": "게임", "발로란트": "게임", "오버워치": "게임",
    "배그": "게임", "e스포츠": "게임", "LCK": "게임", "스팀": "게임",

    # 음악/엔터
    "음악": "음악", "노래": "음악", "플레이리스트": "음악", "뮤직비디오": "음악",
    "영화": "영화", "넷플릭스": "영화", "드라마": "영화",

    # 요리
    "요리": "요리", "레시피": "요리", "먹방": "요리", "밀프렙": "요리",

    # 운동/건강
    "운동": "운동", "헬스": "운동", "다이어트": "운동", "홈트": "운동",

    # 뷰티/패션
    "뷰티": "뷰티", "메이크업": "뷰티", "스킨케어": "뷰티",
    "패션": "패션", "코디": "패션", "옷": "패션",

    # 일상/여행
    "브이로그": "일상", "일상": "일상", "루틴": "일상",
    "여행": "여행", "호캉스": "여행", "맛집": "여행",
}


class PersonaCrudService:
    """
    페르소나 CRUD 서비스

    핵심 기능:
    1. 페르소나 생성/수정/삭제
    2. 성격 변화 분석 (Personality Drift)
    3. 검색 기반 관심사 자동 업데이트
    """

    def __init__(self, force_mock: bool = False):
        self._mock_mode = force_mock or _is_mock_mode()
        self.client = None

        if not self._mock_mode:
            try:
                self.client = get_client()
            except Exception as e:
                logger.warning(f"Supabase 연결 실패, Mock 모드로 전환: {e}")
                self._mock_mode = True

        if self._mock_mode:
            logger.info("🧪 PersonaCrudService Mock 모드 활성화")

    # ==================== CREATE ====================

    async def create_persona(
        self,
        name: str,
        description: Optional[str] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        interests: Optional[List[str]] = None,
        traits: Optional[Dict[str, float]] = None,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """페르소나 생성"""
        persona_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # 기본 traits
        default_traits = {
            "curiosity": 50.0, "enthusiasm": 50.0, "skepticism": 50.0,
            "empathy": 50.0, "humor": 50.0, "expertise": 50.0,
            "formality": 50.0, "verbosity": 50.0
        }
        if traits:
            default_traits.update(traits)

        persona_data = {
            "id": persona_id,
            "name": name,
            "description": description,
            "age": age,
            "gender": gender,
            "interests": interests or [],
            "device_id": device_id,
            "existence_state": "active",
            "total_activities": 0,
            "created_at": now,
            "updated_at": now,
            "last_called_at": now,
            # Traits (flat columns)
            "traits_curiosity": default_traits["curiosity"],
            "traits_enthusiasm": default_traits["enthusiasm"],
            "traits_skepticism": default_traits["skepticism"],
            "traits_empathy": default_traits["empathy"],
            "traits_humor": default_traits["humor"],
            "traits_expertise": default_traits["expertise"],
            "traits_formality": default_traits["formality"],
            "traits_verbosity": default_traits["verbosity"],
        }

        # Mock 모드
        if self._mock_mode:
            _mock_personas.append(persona_data)
            logger.info(f"[Mock] 페르소나 생성: {name} ({persona_id})")
            return {
                "success": True,
                "persona_id": persona_id,
                "name": name,
                "message": f"'{name}' 페르소나가 생성되었습니다.",
                "data": persona_data
            }

        try:
            self.client.table("personas").insert(persona_data).execute()
            logger.info(f"페르소나 생성: {name} ({persona_id})")
            return {
                "success": True,
                "persona_id": persona_id,
                "name": name,
                "message": f"'{name}' 페르소나가 생성되었습니다.",
                "data": persona_data
            }
        except Exception as e:
            logger.error(f"페르소나 생성 실패: {e}")
            raise

    # ==================== UPDATE ====================

    async def update_persona(
        self,
        persona_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        interests: Optional[List[str]] = None,
        existence_state: Optional[str] = None,
        traits: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """페르소나 수정"""
        update_data = {}
        updated_fields = []

        if name is not None:
            update_data["name"] = name
            updated_fields.append("name")
        if description is not None:
            update_data["description"] = description
            updated_fields.append("description")
        if age is not None:
            update_data["age"] = age
            updated_fields.append("age")
        if gender is not None:
            update_data["gender"] = gender
            updated_fields.append("gender")
        if interests is not None:
            update_data["interests"] = interests
            updated_fields.append("interests")
        if existence_state is not None:
            update_data["existence_state"] = existence_state
            updated_fields.append("existence_state")
        if traits:
            for trait_name, value in traits.items():
                col_name = f"traits_{trait_name}"
                update_data[col_name] = value
                updated_fields.append(col_name)

        if not update_data:
            return {
                "success": False,
                "persona_id": persona_id,
                "updated_fields": [],
                "message": "수정할 필드가 없습니다."
            }

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Mock 모드
        if self._mock_mode:
            for p in _mock_personas:
                if p["id"] == persona_id:
                    p.update(update_data)
                    logger.info(f"[Mock] 페르소나 수정: {persona_id}")
                    return {
                        "success": True,
                        "persona_id": persona_id,
                        "updated_fields": updated_fields,
                        "message": "페르소나가 업데이트되었습니다."
                    }
            raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

        try:
            self.client.table("personas").update(update_data).eq(
                "id", persona_id
            ).execute()
            logger.info(f"페르소나 수정: {persona_id}, fields={updated_fields}")
            return {
                "success": True,
                "persona_id": persona_id,
                "updated_fields": updated_fields,
                "message": "페르소나가 업데이트되었습니다."
            }
        except Exception as e:
            logger.error(f"페르소나 수정 실패: {e}")
            raise

    # ==================== DELETE ====================

    async def delete_persona(self, persona_id: str) -> Dict[str, Any]:
        """페르소나 삭제"""
        # Mock 모드
        if self._mock_mode:
            persona = None
            for i, p in enumerate(_mock_personas):
                if p["id"] == persona_id:
                    persona = _mock_personas.pop(i)
                    break
            if not persona:
                raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

            # Mock 활동 로그 삭제
            activities_deleted = len([
                log for log in _mock_activity_logs
                if log.get("persona_id") == persona_id
            ])
            _mock_activity_logs[:] = [
                log for log in _mock_activity_logs
                if log.get("persona_id") != persona_id
            ]

            logger.info(f"[Mock] 페르소나 삭제: {persona['name']} ({persona_id})")
            return {
                "success": True,
                "persona_id": persona_id,
                "name": persona["name"],
                "message": f"'{persona['name']}' 페르소나가 삭제되었습니다.",
                "activities_deleted": activities_deleted,
                "search_logs_deleted": 0
            }

        try:
            # 페르소나 정보 조회
            result = self.client.table("personas").select("name").eq(
                "id", persona_id
            ).single().execute()
            name = result.data.get("name", "Unknown") if result.data else "Unknown"

            # 활동 로그 삭제
            logs_result = self.client.table("persona_activity_logs").delete().eq(
                "persona_id", persona_id
            ).execute()
            activities_deleted = len(logs_result.data) if logs_result.data else 0

            # 페르소나 삭제
            self.client.table("personas").delete().eq("id", persona_id).execute()

            logger.info(f"페르소나 삭제: {name} ({persona_id})")
            return {
                "success": True,
                "persona_id": persona_id,
                "name": name,
                "message": f"'{name}' 페르소나가 삭제되었습니다.",
                "activities_deleted": activities_deleted,
                "search_logs_deleted": 0
            }
        except Exception as e:
            logger.error(f"페르소나 삭제 실패: {e}")
            raise

    # ==================== PERSONALITY DRIFT ====================

    async def analyze_personality_drift(
        self,
        persona_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        성격 변화 분석 (Personality Drift)

        검색 패턴을 분석하여 관심사 변화 감지
        """
        # 페르소나 조회
        persona = await self._get_persona(persona_id)
        if not persona:
            raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

        # 검색 기록 조회
        search_logs = await self._get_search_logs(persona_id, days)

        if not search_logs:
            return {
                "success": True,
                "persona_id": persona_id,
                "persona_name": persona.get("name", "Unknown"),
                "drift_score": 0.0,
                "drift_direction": "stable",
                "top_categories": [],
                "original_interests": persona.get("interests", []),
                "suggested_interests": persona.get("interests", []),
                "interests_to_add": [],
                "interests_to_remove": [],
                "analysis_period_days": days,
                "total_searches_analyzed": 0,
                "message": "분석할 검색 기록이 없습니다."
            }

        # 카테고리 분석
        category_counts = self._categorize_searches(search_logs)
        total_searches = sum(category_counts.values())

        # 상위 카테고리
        top_categories = []
        for category, count in category_counts.most_common(5):
            sample_keywords = [
                log["search_keyword"] for log in search_logs
                if self._get_category(log["search_keyword"]) == category
            ][:5]
            top_categories.append({
                "category": category,
                "search_count": count,
                "percentage": round((count / total_searches) * 100, 1),
                "sample_keywords": sample_keywords
            })

        # 현재 관심사와 비교
        original_interests = set(persona.get("interests", []))
        search_categories = set(category_counts.keys())

        # 추천 관심사 계산
        suggested_interests = list(original_interests | search_categories)
        interests_to_add = list(search_categories - original_interests)
        interests_to_remove = [
            i for i in original_interests
            if i not in search_categories and len(search_logs) > 10
        ]

        # Drift 점수 계산
        drift_score = self._calculate_drift_score(
            original_interests, search_categories, len(search_logs)
        )

        # Drift 방향 결정
        if len(interests_to_add) > len(interests_to_remove):
            drift_direction = "expanding"
        elif len(interests_to_remove) > len(interests_to_add):
            drift_direction = "narrowing"
        elif interests_to_add or interests_to_remove:
            drift_direction = "shifting"
        else:
            drift_direction = "stable"

        return {
            "success": True,
            "persona_id": persona_id,
            "persona_name": persona.get("name", "Unknown"),
            "drift_score": drift_score,
            "drift_direction": drift_direction,
            "top_categories": top_categories,
            "original_interests": list(original_interests),
            "suggested_interests": suggested_interests,
            "interests_to_add": interests_to_add,
            "interests_to_remove": interests_to_remove,
            "analysis_period_days": days,
            "total_searches_analyzed": total_searches,
            "message": self._get_drift_message(drift_direction, interests_to_add)
        }

    def _categorize_searches(self, search_logs: List[Dict]) -> Counter:
        """검색어를 카테고리로 분류"""
        categories = Counter()
        for log in search_logs:
            keyword = log.get("search_keyword", "")
            category = self._get_category(keyword)
            if category:
                categories[category] += 1
        return categories

    def _get_category(self, keyword: str) -> Optional[str]:
        """검색어에서 카테고리 추출"""
        keyword_lower = keyword.lower()
        for key, category in KEYWORD_CATEGORY_MAP.items():
            if key.lower() in keyword_lower:
                return category
        return "기타"

    def _calculate_drift_score(
        self,
        original: set,
        current: set,
        search_count: int
    ) -> float:
        """Drift 점수 계산 (0-1)"""
        if not original or search_count < 5:
            return 0.0

        # Jaccard 거리 기반
        intersection = len(original & current)
        union = len(original | current)
        if union == 0:
            return 0.0

        similarity = intersection / union
        drift = 1 - similarity

        # 검색량에 따른 가중치
        weight = min(1.0, search_count / 50)
        return round(drift * weight, 3)

    def _get_drift_message(
        self,
        direction: str,
        new_interests: List[str]
    ) -> str:
        """Drift 설명 메시지 생성"""
        if direction == "stable":
            return "관심사가 안정적입니다."
        elif direction == "expanding" and new_interests:
            return f"관심사가 {', '.join(new_interests[:3])} 분야로 확장되고 있습니다."
        elif direction == "narrowing":
            return "관심사가 특정 분야로 집중되고 있습니다."
        else:
            return "관심사가 변화하고 있습니다."

    # ==================== UPDATE INTERESTS ====================

    async def update_interests_from_searches(
        self,
        persona_id: str,
        min_search_count: int = 3,
        auto_remove_unused: bool = False,
        confirm: bool = False
    ) -> Dict[str, Any]:
        """검색 기반 관심사 자동 업데이트"""
        # 분석 먼저 실행
        analysis = await self.analyze_personality_drift(persona_id)

        if not analysis["success"]:
            return {
                "success": False,
                "persona_id": persona_id,
                "preview_mode": True,
                "interests_before": [],
                "interests_after": [],
                "added": [],
                "removed": [],
                "message": "분석 실패"
            }

        interests_before = analysis["original_interests"]

        # 추가할 관심사 필터링 (최소 검색 횟수 충족)
        interests_to_add = []
        for cat in analysis["top_categories"]:
            if cat["search_count"] >= min_search_count:
                if cat["category"] not in interests_before and cat["category"] != "기타":
                    interests_to_add.append(cat["category"])

        # 제거할 관심사
        interests_to_remove = []
        if auto_remove_unused:
            interests_to_remove = analysis["interests_to_remove"]

        # 새 관심사 계산
        interests_after = list(set(interests_before) | set(interests_to_add))
        if auto_remove_unused:
            interests_after = [i for i in interests_after if i not in interests_to_remove]

        # 미리보기 모드
        if not confirm:
            return {
                "success": True,
                "persona_id": persona_id,
                "preview_mode": True,
                "interests_before": interests_before,
                "interests_after": interests_after,
                "added": interests_to_add,
                "removed": interests_to_remove,
                "message": f"미리보기: {len(interests_to_add)}개 추가, {len(interests_to_remove)}개 제거 예정"
            }

        # 실제 업데이트
        if interests_to_add or interests_to_remove:
            await self.update_persona(persona_id, interests=interests_after)

        return {
            "success": True,
            "persona_id": persona_id,
            "preview_mode": False,
            "interests_before": interests_before,
            "interests_after": interests_after,
            "added": interests_to_add,
            "removed": interests_to_remove,
            "message": f"관심사가 업데이트되었습니다. {len(interests_to_add)}개 추가됨."
        }

    # ==================== Helper Methods ====================

    async def _get_persona(self, persona_id: str) -> Optional[Dict[str, Any]]:
        """페르소나 조회"""
        if self._mock_mode:
            for p in _mock_personas:
                if p["id"] == persona_id:
                    return p.copy()
            return None

        try:
            result = self.client.table("personas").select("*").eq(
                "id", persona_id
            ).single().execute()
            return result.data
        except Exception:
            return None

    async def _get_search_logs(
        self,
        persona_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """검색 로그 조회"""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        if self._mock_mode:
            return [
                log for log in _mock_activity_logs
                if log.get("persona_id") == persona_id
                and log.get("activity_type") == "idle_search"
                and log.get("created_at", "") >= since
            ]

        try:
            result = self.client.table("persona_activity_logs").select(
                "search_keyword, created_at"
            ).eq("persona_id", persona_id).eq(
                "activity_type", "idle_search"
            ).gte("created_at", since).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"검색 로그 조회 실패: {e}")
            return []


# ==================== Singleton ====================

_service: Optional[PersonaCrudService] = None


def get_persona_crud_service() -> PersonaCrudService:
    """PersonaCrudService 싱글톤 반환"""
    global _service
    if _service is None:
        _service = PersonaCrudService()
    return _service
