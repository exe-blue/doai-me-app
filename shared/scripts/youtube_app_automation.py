"""
YouTube App 자동화 스크립트

Laixi WebSocket API를 통해 Android YouTube 앱을 제어합니다.

주요 기능:
1. YouTube 앱 실행
2. 검색어 입력 및 검색
3. 영상 찾기 및 클릭
4. 광고 스킵
5. 영상 시청
6. 좋아요 클릭 (확률 기반)
7. 댓글 작성 (확률 기반)

좌표는 백분율 (0.0 ~ 1.0) 기준입니다.
Galaxy S9 (1440x2960) 기준으로 측정되었으나, 백분율이므로 다른 기기에서도 동작합니다.
"""

import asyncio
import random
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from shared.laixi_client import LaixiClient, get_laixi_client


class ExecutionResult(Enum):
    """실행 결과"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class YouTubeCoordinates:
    """YouTube 앱 UI 좌표 (백분율)"""
    # 검색 관련
    search_icon: Tuple[float, float] = (0.92, 0.05)  # 우상단 검색 아이콘
    search_input: Tuple[float, float] = (0.5, 0.08)  # 검색 입력창
    search_clear: Tuple[float, float] = (0.85, 0.08)  # 검색 지우기
    
    # 검색 결과
    first_result: Tuple[float, float] = (0.5, 0.30)  # 첫 번째 검색 결과
    second_result: Tuple[float, float] = (0.5, 0.55)  # 두 번째 검색 결과
    third_result: Tuple[float, float] = (0.5, 0.80)  # 세 번째 검색 결과
    
    # 영상 플레이어
    player_center: Tuple[float, float] = (0.5, 0.25)  # 플레이어 중앙
    player_pause: Tuple[float, float] = (0.5, 0.25)  # 일시정지/재생
    
    # 광고
    ad_skip: Tuple[float, float] = (0.90, 0.88)  # 광고 스킵 버튼
    ad_skip_alt: Tuple[float, float] = (0.85, 0.82)  # 광고 스킵 (대체 위치)
    
    # 인터랙션
    like_button: Tuple[float, float] = (0.15, 0.62)  # 좋아요 버튼
    dislike_button: Tuple[float, float] = (0.28, 0.62)  # 싫어요 버튼
    share_button: Tuple[float, float] = (0.42, 0.62)  # 공유 버튼
    
    # 댓글
    comment_section: Tuple[float, float] = (0.5, 0.85)  # 댓글 섹션 탭
    comment_input: Tuple[float, float] = (0.5, 0.95)  # 댓글 입력창
    comment_submit: Tuple[float, float] = (0.92, 0.95)  # 댓글 제출


@dataclass
class WatchTask:
    """시청 작업 정보"""
    video_id: str
    title: str
    search_keyword: str
    duration_seconds: Optional[int] = None
    target_watch_percent: float = 0.7
    
    # 인터랙션 설정
    should_like: bool = False
    should_comment: bool = False
    comment_text: Optional[str] = None
    
    # 디바이스 정보
    device_id: str = ""
    device_logged_in: bool = False


@dataclass
class WatchResult:
    """시청 결과"""
    task: WatchTask
    status: ExecutionResult = ExecutionResult.FAILED
    
    # 시청 데이터
    watch_duration_seconds: int = 0
    watch_percent: float = 0.0
    
    # 인터랙션 결과
    liked: bool = False
    like_attempted: bool = False
    commented: bool = False
    comment_attempted: bool = False
    
    # 검색 결과
    search_result_rank: int = 0
    
    # 에러
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    
    # 타이밍
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class YouTubeAppAutomation:
    """
    YouTube 앱 자동화 클래스
    
    Usage:
        automation = YouTubeAppAutomation()
        
        task = WatchTask(
            video_id="dQw4w9WgXcQ",
            title="Rick Astley - Never Gonna Give You Up",
            search_keyword="Rick Astley",
            duration_seconds=212,
            should_like=True,
            device_id="ABC123"
        )
        
        result = await automation.execute(task)
    """
    
    def __init__(
        self,
        laixi: Optional[LaixiClient] = None,
        coords: Optional[YouTubeCoordinates] = None
    ):
        """
        YouTubeAppAutomation 초기화
        
        Args:
            laixi: LaixiClient 인스턴스 (None이면 싱글톤 사용)
            coords: 좌표 설정 (None이면 기본값)
        """
        self.laixi = laixi or get_laixi_client()
        self.coords = coords or YouTubeCoordinates()
        
        # YouTube 앱 패키지
        self.youtube_package = "com.google.android.youtube"
        self.youtube_activity = "com.google.android.youtube.HomeActivity"
    
    async def execute(self, task: WatchTask) -> WatchResult:
        """
        시청 작업 실행
        
        Args:
            task: 시청 작업 정보
        
        Returns:
            시청 결과
        """
        result = WatchResult(task=task, started_at=datetime.utcnow())
        device_id = task.device_id
        
        try:
            # 1. YouTube 앱 실행
            logger.info(f"[{device_id}] YouTube 앱 실행")
            if not await self._launch_youtube(device_id):
                result.status = ExecutionResult.ERROR
                result.error_code = "APP_LAUNCH_FAILED"
                result.error_message = "YouTube 앱 실행 실패"
                return result
            
            await asyncio.sleep(random.uniform(2.0, 3.5))
            
            # 2. 검색
            logger.info(f"[{device_id}] 검색: {task.search_keyword}")
            if not await self._search_video(device_id, task.search_keyword):
                result.status = ExecutionResult.ERROR
                result.error_code = "SEARCH_FAILED"
                result.error_message = "검색 실패"
                return result
            
            await asyncio.sleep(random.uniform(3.0, 5.0))
            
            # 3. 영상 찾기 및 클릭
            logger.info(f"[{device_id}] 영상 찾기: {task.title}")
            rank = await self._find_and_click_video(device_id, task.title)
            if rank == 0:
                result.status = ExecutionResult.FAILED
                result.error_code = "VIDEO_NOT_FOUND"
                result.error_message = f"영상을 찾지 못함: {task.title}"
                return result
            
            result.search_result_rank = rank
            await asyncio.sleep(random.uniform(2.0, 4.0))
            
            # 4. 광고 처리
            logger.debug(f"[{device_id}] 광고 확인")
            await self._handle_ads(device_id)
            
            # 5. 영상 시청
            watch_duration = self._calculate_watch_duration(task)
            logger.info(f"[{device_id}] 시청 시작: {watch_duration}초")
            
            actual_watched = await self._watch_video(
                device_id,
                watch_duration,
                task.duration_seconds or 180
            )
            
            result.watch_duration_seconds = actual_watched
            if task.duration_seconds:
                result.watch_percent = (actual_watched / task.duration_seconds) * 100
            
            # 6. 좋아요 (조건부)
            if task.should_like and task.device_logged_in:
                result.like_attempted = True
                logger.info(f"[{device_id}] 좋아요 시도")
                result.liked = await self._click_like(device_id)
                await asyncio.sleep(random.uniform(0.5, 1.5))
            
            # 7. 댓글 (조건부)
            if task.should_comment and task.device_logged_in and task.comment_text:
                result.comment_attempted = True
                logger.info(f"[{device_id}] 댓글 시도: {task.comment_text[:20]}...")
                result.commented = await self._write_comment(
                    device_id,
                    task.comment_text
                )
                await asyncio.sleep(random.uniform(1.0, 2.0))
            
            # 8. 홈으로 나가기
            await self._go_home(device_id)
            
            # 성공 여부 판정
            if result.watch_percent >= task.target_watch_percent * 100:
                if (task.should_like and not result.liked) or \
                   (task.should_comment and not result.commented):
                    result.status = ExecutionResult.PARTIAL
                else:
                    result.status = ExecutionResult.SUCCESS
            else:
                result.status = ExecutionResult.PARTIAL
                result.error_code = "LOW_WATCH_TIME"
                result.error_message = f"시청률 미달: {result.watch_percent:.1f}%"
            
            logger.info(
                f"[{device_id}] 완료: status={result.status.value}, "
                f"watch={result.watch_duration_seconds}s, "
                f"liked={result.liked}, commented={result.commented}"
            )
        
        except asyncio.TimeoutError:
            result.status = ExecutionResult.ERROR
            result.error_code = "TIMEOUT"
            result.error_message = "작업 시간 초과"
            logger.error(f"[{device_id}] 타임아웃")
        
        except Exception as e:
            result.status = ExecutionResult.ERROR
            result.error_code = "UNKNOWN_ERROR"
            result.error_message = str(e)
            logger.error(f"[{device_id}] 오류: {e}")
        
        finally:
            result.completed_at = datetime.utcnow()
        
        return result
    
    # =========================================
    # YouTube 앱 제어
    # =========================================
    
    async def _launch_youtube(self, device_id: str) -> bool:
        """YouTube 앱 실행"""
        try:
            # 먼저 홈으로 이동
            await self.laixi.press_home(device_id)
            await asyncio.sleep(0.5)
            
            # YouTube 앱 실행
            command = (
                f"am start -n {self.youtube_package}/{self.youtube_activity}"
            )
            return await self.laixi.execute_adb(device_id, command)
        except Exception as e:
            logger.error(f"YouTube 실행 실패: {e}")
            return False
    
    async def _search_video(
        self,
        device_id: str,
        keyword: str
    ) -> bool:
        """영상 검색"""
        try:
            # 검색 아이콘 클릭
            await self.laixi.tap(
                device_id,
                self.coords.search_icon[0],
                self.coords.search_icon[1]
            )
            await asyncio.sleep(random.uniform(1.0, 2.0))
            
            # 검색어 입력 (클립보드 사용)
            await self.laixi.set_clipboard(device_id, keyword)
            await asyncio.sleep(0.3)
            
            # 검색 입력창 탭
            await self.laixi.tap(
                device_id,
                self.coords.search_input[0],
                self.coords.search_input[1]
            )
            await asyncio.sleep(0.5)
            
            # 붙여넣기 (Ctrl+V 또는 롱프레스 후 붙여넣기)
            # ADB input 사용
            await self.laixi.execute_adb(
                device_id,
                "input keyevent 279"  # KEYCODE_PASTE
            )
            await asyncio.sleep(random.uniform(0.5, 1.0))
            
            # 검색 실행 (Enter)
            await self.laixi.execute_adb(
                device_id,
                "input keyevent 66"  # KEYCODE_ENTER
            )
            
            return True
        except Exception as e:
            logger.error(f"검색 실패: {e}")
            return False
    
    async def _find_and_click_video(
        self,
        device_id: str,
        title: str,
        max_scrolls: int = 5
    ) -> int:
        """
        영상 찾기 및 클릭
        
        Returns:
            검색 순위 (못찾으면 0)
        """
        try:
            # 검색 결과 위치들
            result_positions = [
                self.coords.first_result,
                self.coords.second_result,
                self.coords.third_result
            ]
            
            for scroll in range(max_scrolls):
                # 현재 화면에서 영상 클릭 시도
                # (실제로는 OCR이나 접근성 서비스가 필요하지만,
                #  여기서는 첫 번째 결과를 클릭하는 단순 방식 사용)
                
                if scroll == 0:
                    # 첫 화면에서는 첫 번째 결과 클릭
                    pos = result_positions[0]
                    await self.laixi.tap(device_id, pos[0], pos[1])
                    return 1
                
                # 스크롤 다운
                await self.laixi.swipe(
                    device_id,
                    0.5, 0.7,
                    0.5, 0.3,
                    duration_ms=random.randint(300, 500)
                )
                await asyncio.sleep(random.uniform(1.5, 2.5))
                
                # 랜덤 위치 클릭 (스크롤 후)
                pos = random.choice(result_positions[:2])
                await self.laixi.tap(device_id, pos[0], pos[1])
                return scroll * 3 + 1
            
            return 0
        except Exception as e:
            logger.error(f"영상 찾기 실패: {e}")
            return 0
    
    async def _handle_ads(self, device_id: str, timeout: int = 30) -> None:
        """광고 처리"""
        try:
            start_time = asyncio.get_event_loop().time()
            
            while (asyncio.get_event_loop().time() - start_time) < timeout:
                # 광고 스킵 버튼 클릭 시도
                await self.laixi.tap(
                    device_id,
                    self.coords.ad_skip[0],
                    self.coords.ad_skip[1]
                )
                await asyncio.sleep(0.5)
                
                # 대체 위치도 시도
                await self.laixi.tap(
                    device_id,
                    self.coords.ad_skip_alt[0],
                    self.coords.ad_skip_alt[1]
                )
                await asyncio.sleep(1.0)
                
                # 5초 후 다시 시도
                await asyncio.sleep(4.0)
                
                # 총 2번 시도 후 종료 (대부분 광고는 5초 후 스킵 가능)
                if (asyncio.get_event_loop().time() - start_time) > 12:
                    break
        except Exception as e:
            logger.warning(f"광고 처리 중 오류 (무시): {e}")
    
    async def _watch_video(
        self,
        device_id: str,
        target_seconds: int,
        video_duration: int
    ) -> int:
        """
        영상 시청
        
        Returns:
            실제 시청 시간 (초)
        """
        try:
            watched = 0
            segment_min = 10
            segment_max = 30
            
            while watched < target_seconds:
                # 세그먼트 시청
                segment = min(
                    random.randint(segment_min, segment_max),
                    target_seconds - watched
                )
                await asyncio.sleep(segment)
                watched += segment
                
                # 랜덤 행동 (휴먼 패턴)
                action = random.random()
                
                if action < 0.1:
                    # 10% 확률로 플레이어 탭 (일시정지/재생)
                    await self.laixi.tap(
                        device_id,
                        self.coords.player_center[0],
                        self.coords.player_center[1]
                    )
                    await asyncio.sleep(random.uniform(0.5, 2.0))
                    await self.laixi.tap(
                        device_id,
                        self.coords.player_center[0],
                        self.coords.player_center[1]
                    )
                
                elif action < 0.2:
                    # 10% 확률로 살짝 스크롤
                    await self.laixi.swipe(
                        device_id,
                        0.5, 0.5,
                        0.5, 0.45,
                        duration_ms=200
                    )
                
                # 광고 체크 (간헐적)
                if random.random() < 0.05:
                    await self.laixi.tap(
                        device_id,
                        self.coords.ad_skip[0],
                        self.coords.ad_skip[1]
                    )
            
            return watched
        except Exception as e:
            logger.error(f"시청 중 오류: {e}")
            return watched if 'watched' in locals() else 0
    
    async def _click_like(self, device_id: str) -> bool:
        """좋아요 클릭"""
        try:
            # 영상 정보 영역으로 스크롤
            await self.laixi.swipe(
                device_id,
                0.5, 0.5,
                0.5, 0.35,
                duration_ms=300
            )
            await asyncio.sleep(0.5)
            
            # 좋아요 버튼 클릭
            await self.laixi.tap(
                device_id,
                self.coords.like_button[0],
                self.coords.like_button[1]
            )
            await asyncio.sleep(0.3)
            
            return True
        except Exception as e:
            logger.error(f"좋아요 클릭 실패: {e}")
            return False
    
    async def _write_comment(
        self,
        device_id: str,
        comment_text: str
    ) -> bool:
        """댓글 작성"""
        try:
            # 댓글 섹션으로 스크롤
            await self.laixi.swipe(
                device_id,
                0.5, 0.7,
                0.5, 0.3,
                duration_ms=400
            )
            await asyncio.sleep(1.0)
            
            # 댓글 입력창 탭
            await self.laixi.tap(
                device_id,
                self.coords.comment_section[0],
                self.coords.comment_section[1]
            )
            await asyncio.sleep(1.5)
            
            # 댓글 텍스트 입력 (클립보드)
            await self.laixi.set_clipboard(device_id, comment_text)
            await asyncio.sleep(0.3)
            
            # 댓글 입력창 탭
            await self.laixi.tap(
                device_id,
                self.coords.comment_input[0],
                self.coords.comment_input[1]
            )
            await asyncio.sleep(0.5)
            
            # 붙여넣기
            await self.laixi.execute_adb(
                device_id,
                "input keyevent 279"
            )
            await asyncio.sleep(random.uniform(0.5, 1.0))
            
            # 제출 버튼 클릭
            await self.laixi.tap(
                device_id,
                self.coords.comment_submit[0],
                self.coords.comment_submit[1]
            )
            await asyncio.sleep(1.0)
            
            return True
        except Exception as e:
            logger.error(f"댓글 작성 실패: {e}")
            return False
    
    async def _go_home(self, device_id: str) -> None:
        """홈으로 나가기"""
        try:
            await self.laixi.press_back(device_id)
            await asyncio.sleep(0.3)
            await self.laixi.press_back(device_id)
            await asyncio.sleep(0.3)
            await self.laixi.press_home(device_id)
        except Exception as e:
            logger.warning(f"홈 이동 실패: {e}")
    
    # =========================================
    # 유틸리티
    # =========================================
    
    def _calculate_watch_duration(self, task: WatchTask) -> int:
        """시청 시간 계산"""
        if task.duration_seconds:
            target = int(task.duration_seconds * task.target_watch_percent)
            # 랜덤 변동 추가 (-5% ~ +10%)
            variation = random.uniform(-0.05, 0.10)
            target = int(target * (1 + variation))
            # 최소 30초, 최대 영상 길이
            return max(30, min(target, task.duration_seconds))
        else:
            # 영상 길이 모를 때 기본 2-5분
            return random.randint(120, 300)


# 배치 실행용 함수
async def execute_batch(
    tasks: List[WatchTask],
    concurrency: int = 5
) -> List[WatchResult]:
    """
    여러 작업 배치 실행
    
    Args:
        tasks: 작업 목록
        concurrency: 동시 실행 수
    
    Returns:
        결과 목록
    """
    automation = YouTubeAppAutomation()
    semaphore = asyncio.Semaphore(concurrency)
    
    async def execute_with_limit(task: WatchTask) -> WatchResult:
        async with semaphore:
            return await automation.execute(task)
    
    results = await asyncio.gather(
        *[execute_with_limit(task) for task in tasks],
        return_exceptions=True
    )
    
    # 예외를 결과로 변환
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            final_results.append(WatchResult(
                task=tasks[i],
                status=ExecutionResult.ERROR,
                error_code="EXECUTION_ERROR",
                error_message=str(result)
            ))
        else:
            final_results.append(result)
    
    return final_results
