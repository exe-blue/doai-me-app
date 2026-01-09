"""
PersonaLaixiService - 페르소나 Laixi 연동 서비스

P2: 실제 YouTube 검색 실행
- Laixi를 통해 할당된 기기에서 YouTube 검색 실행
- 영상 시청 및 좋아요 처리
- 활동 로그 기록

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-09
"""

import os
import random
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from uuid import uuid4

# Supabase 클라이언트
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

# Laixi 클라이언트 (선택적)
try:
    from shared.laixi_client import LaixiClient, get_laixi_client
    HAS_LAIXI = True
except ImportError:
    HAS_LAIXI = False
    LaixiClient = None
    get_laixi_client = None

# PersonaSearchService import
try:
    from .persona_search_service import get_persona_search_service
except ImportError:
    from persona_search_service import get_persona_search_service

logger = logging.getLogger("persona_laixi_service")


def _is_mock_mode() -> bool:
    """런타임에 Mock 모드 확인"""
    return os.getenv("MOCK_MODE", "").lower() in ("true", "1", "yes")


class PersonaLaixiService:
    """
    페르소나 Laixi 연동 서비스

    기능:
    1. 페르소나에 할당된 기기에서 YouTube 검색 실행
    2. 검색 결과 첫 번째 영상 시청
    3. 확률적 좋아요 처리
    4. 활동 로그 기록
    """

    def __init__(self, force_mock: bool = False):
        self._mock_mode = force_mock or _is_mock_mode() or not HAS_LAIXI
        self.client = None
        self.laixi: Optional[Any] = None
        self._laixi_connected = False

        if not self._mock_mode:
            try:
                self.client = get_client()
            except Exception as e:
                logger.warning(f"Supabase 연결 실패: {e}")

        if self._mock_mode:
            logger.info("🧪 PersonaLaixiService Mock 모드 활성화")
        elif HAS_LAIXI:
            try:
                self.laixi = get_laixi_client()
            except Exception as e:
                logger.warning(f"Laixi 클라이언트 생성 실패: {e}")
                self._mock_mode = True

        self._search_service = get_persona_search_service()

    async def execute_search(
        self,
        persona_id: str,
        keyword: Optional[str] = None,
        watch_video: bool = True,
        watch_duration_seconds: Optional[int] = None,
        like_probability: float = 0.1
    ) -> Dict[str, Any]:
        """
        YouTube 검색 실행

        Args:
            persona_id: 페르소나 ID
            keyword: 검색어 (미입력시 자동 생성)
            watch_video: 영상 시청 여부
            watch_duration_seconds: 시청 시간 (초)
            like_probability: 좋아요 확률

        Returns:
            실행 결과
        """
        # 1. 페르소나 조회
        persona = await self._search_service.get_persona(persona_id)
        if not persona:
            raise ValueError(f"페르소나를 찾을 수 없습니다: {persona_id}")

        device_id = persona.get("device_id")

        # 2. 검색어 결정
        keyword_source = "user_provided"
        if not keyword:
            # IDLE search로 검색어 생성
            search_result = await self._search_service.execute_idle_search(
                persona_id=persona_id,
                force=True
            )
            keyword = search_result["generated_keyword"]
            keyword_source = search_result["search_source"]
            formative_impact = search_result["formative_impact"]
            activity_log_id = search_result["activity_log_id"]
        else:
            # 사용자 제공 검색어 → 별도 로그
            formative_impact = self._search_service._calculate_formative_impact(persona)
            activity_log_id = await self._log_search_activity(
                persona_id=persona_id,
                keyword=keyword,
                source=keyword_source,
                formative_impact=formative_impact
            )

        # 3. Mock 모드 처리
        if self._mock_mode:
            return await self._mock_execute_search(
                persona_id=persona_id,
                device_id=device_id,
                keyword=keyword,
                keyword_source=keyword_source,
                watch_video=watch_video,
                watch_duration_seconds=watch_duration_seconds,
                like_probability=like_probability,
                formative_impact=formative_impact,
                activity_log_id=activity_log_id
            )

        # 4. 실제 Laixi 실행
        return await self._real_execute_search(
            persona_id=persona_id,
            device_id=device_id,
            keyword=keyword,
            keyword_source=keyword_source,
            watch_video=watch_video,
            watch_duration_seconds=watch_duration_seconds,
            like_probability=like_probability,
            formative_impact=formative_impact,
            activity_log_id=activity_log_id
        )

    async def _mock_execute_search(
        self,
        persona_id: str,
        device_id: Optional[str],
        keyword: str,
        keyword_source: str,
        watch_video: bool,
        watch_duration_seconds: Optional[int],
        like_probability: float,
        formative_impact: float,
        activity_log_id: str
    ) -> Dict[str, Any]:
        """Mock 검색 실행 (테스트용)"""
        logger.info(f"[Mock] YouTube 검색 실행: '{keyword}'")

        # 시뮬레이션 지연
        await asyncio.sleep(0.5)

        # Mock 결과 생성
        video_watched = None
        video_title = None
        actual_watch_duration = None
        liked = False

        if watch_video:
            video_id = f"mock_{uuid4().hex[:8]}"
            video_watched = f"https://youtube.com/watch?v={video_id}"
            video_title = f"[Mock] {keyword} 관련 영상"
            actual_watch_duration = watch_duration_seconds or random.randint(30, 180)

            # 좋아요 결정
            if random.random() < like_probability:
                liked = True

        logger.info(
            f"[Mock] 검색 완료: keyword='{keyword}', "
            f"watched={video_watched is not None}, liked={liked}"
        )

        return {
            "success": True,
            "persona_id": persona_id,
            "device_id": device_id or "mock-device",
            "keyword": keyword,
            "keyword_source": keyword_source,
            "video_watched": video_watched,
            "video_title": video_title,
            "watch_duration_seconds": actual_watch_duration,
            "liked": liked,
            "formative_impact": formative_impact,
            "activity_log_id": activity_log_id,
            "message": f"[Mock] '{keyword}' 검색 완료"
        }

    async def _real_execute_search(
        self,
        persona_id: str,
        device_id: Optional[str],
        keyword: str,
        keyword_source: str,
        watch_video: bool,
        watch_duration_seconds: Optional[int],
        like_probability: float,
        formative_impact: float,
        activity_log_id: str
    ) -> Dict[str, Any]:
        """실제 Laixi 검색 실행"""
        if not device_id:
            raise ValueError("페르소나에 할당된 기기가 없습니다.")

        if not self.laixi:
            raise RuntimeError("Laixi 클라이언트가 초기화되지 않았습니다.")

        # Laixi 연결 확인
        if not self._laixi_connected:
            connected = await self.laixi.connect()
            if not connected:
                raise ConnectionError("Laixi 연결 실패")
            self._laixi_connected = True

        video_watched = None
        video_title = None
        actual_watch_duration = None
        liked = False

        try:
            # 1. YouTube 앱 열기
            await self.laixi.execute_adb(
                device_id,
                "am start -n com.google.android.youtube/com.google.android.youtube.HomeActivity"
            )
            await asyncio.sleep(2)

            # 2. 검색 버튼 탭 (대략적 위치)
            await self.laixi.tap(device_id, 0.9, 0.05)
            await asyncio.sleep(1)

            # 3. 검색어 입력
            await self.laixi.set_clipboard(device_id, keyword)
            await asyncio.sleep(0.3)

            # 클립보드 붙여넣기 (Ctrl+V 에뮬레이션)
            await self.laixi.execute_adb(
                device_id,
                f"input text '{keyword}'"
            )
            await asyncio.sleep(0.5)

            # 4. 검색 실행 (Enter)
            await self.laixi.execute_adb(device_id, "input keyevent 66")
            await asyncio.sleep(2)

            if watch_video:
                # 5. 첫 번째 영상 탭
                await self.laixi.tap(device_id, 0.5, 0.3)
                await asyncio.sleep(3)

                video_watched = f"https://youtube.com/search?q={keyword}"
                video_title = f"{keyword} 검색 결과 영상"

                # 6. 시청
                actual_watch_duration = watch_duration_seconds or random.randint(30, 120)
                await asyncio.sleep(actual_watch_duration)

                # 7. 좋아요 (확률적)
                if random.random() < like_probability:
                    # 좋아요 버튼 탭 (대략적 위치)
                    await self.laixi.tap(device_id, 0.15, 0.85)
                    await asyncio.sleep(0.5)
                    liked = True

            # 8. 홈으로
            await self.laixi.press_home(device_id)

            # 활동 로그 업데이트
            await self._update_activity_log(
                activity_log_id=activity_log_id,
                video_url=video_watched,
                video_title=video_title
            )

            logger.info(
                f"YouTube 검색 완료: persona={persona_id}, "
                f"keyword='{keyword}', watched={watch_video}, liked={liked}"
            )

            return {
                "success": True,
                "persona_id": persona_id,
                "device_id": device_id,
                "keyword": keyword,
                "keyword_source": keyword_source,
                "video_watched": video_watched,
                "video_title": video_title,
                "watch_duration_seconds": actual_watch_duration,
                "liked": liked,
                "formative_impact": formative_impact,
                "activity_log_id": activity_log_id,
                "message": f"'{keyword}' 검색 및 시청 완료"
            }

        except Exception as e:
            logger.error(f"Laixi 실행 오류: {e}")
            raise

    async def _log_search_activity(
        self,
        persona_id: str,
        keyword: str,
        source: str,
        formative_impact: float
    ) -> str:
        """검색 활동 로그 저장"""
        log_id = str(uuid4())

        if self._mock_mode or not self.client:
            logger.debug(f"[Mock] 검색 활동 로그: {log_id}")
            return log_id

        try:
            log_data = {
                "id": log_id,
                "persona_id": persona_id,
                "activity_type": "idle_search",
                "search_keyword": keyword,
                "search_source": source,
                "formative_impact": formative_impact,
                "points_earned": 15,
                "uniqueness_delta": 0.02 * formative_impact,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.client.table("persona_activity_logs").insert(log_data).execute()
        except Exception as e:
            logger.error(f"활동 로그 저장 실패: {e}")

        return log_id

    async def _update_activity_log(
        self,
        activity_log_id: str,
        video_url: Optional[str],
        video_title: Optional[str]
    ) -> None:
        """활동 로그 업데이트 (시청 정보 추가)"""
        if self._mock_mode or not self.client:
            return

        try:
            self.client.table("persona_activity_logs").update({
                "target_url": video_url,
                "target_title": video_title
            }).eq("id", activity_log_id).execute()
        except Exception as e:
            logger.error(f"활동 로그 업데이트 실패: {e}")


# ==================== Singleton ====================

_service: Optional[PersonaLaixiService] = None


def get_persona_laixi_service() -> PersonaLaixiService:
    """PersonaLaixiService 싱글톤 반환"""
    global _service
    if _service is None:
        _service = PersonaLaixiService()
    return _service
