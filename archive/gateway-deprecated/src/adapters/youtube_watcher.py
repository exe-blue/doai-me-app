"""
YouTube Auto Watcher - 자동 유튜브 시청 엔진

Orion의 지시: "Laixi 앱이 켜진 상태에서, 우리 코드가 보낸 명령에 따라 
폰이 스스로 유튜브를 보는 것을 1시간 내에 시연해라."

이 모듈은 BehaviorEngine을 사용하여 자연스러운 YouTube 시청을 수행합니다.
"""

import asyncio
import logging
from typing import Optional, List
from dataclasses import dataclass

from .device_driver import DeviceDriver
from .laixi_driver import LaixiDriver
from .behavior_engine import BehaviorEngine, HumanPattern

logger = logging.getLogger(__name__)


@dataclass
class WatchSession:
    """시청 세션 정보"""
    device_id: str
    video_url: str
    pattern: HumanPattern
    started: bool = False
    completed: bool = False
    liked: bool = False
    commented: bool = False
    elapsed_seconds: int = 0


class YouTubeWatcher:
    """
    YouTube 자동 시청 엔진
    
    LaixiDriver + BehaviorEngine을 조합하여 
    자연스러운 YouTube 시청을 수행합니다.
    """
    
    def __init__(
        self,
        driver: Optional[DeviceDriver] = None,
        behavior_engine: Optional[BehaviorEngine] = None
    ):
        self.driver = driver or LaixiDriver()
        self.behavior = behavior_engine or BehaviorEngine(self.driver)
        self._active_sessions: dict[str, WatchSession] = {}
    
    async def connect(self) -> bool:
        """Laixi에 연결"""
        return await self.driver.connect("all")
    
    async def disconnect(self) -> None:
        """연결 해제"""
        await self.driver.disconnect("all")
    
    async def list_devices(self) -> List[str]:
        """연결된 디바이스 ID 목록"""
        devices = await self.driver.list_devices()
        return [d.device_id for d in devices]
    
    async def watch_video(
        self,
        device_id: str,
        video_url: str,
        estimated_duration: int = 300,  # 기본 5분
        enable_interaction: bool = True
    ) -> WatchSession:
        """
        YouTube 영상 시청
        
        Args:
            device_id: 디바이스 ID 또는 "all"
            video_url: YouTube 영상 URL
            estimated_duration: 예상 영상 길이 (초)
            enable_interaction: 좋아요/댓글 활성화
            
        Returns:
            WatchSession
        """
        # 휴먼 패턴 생성
        pattern = self.behavior.generate_human_pattern(estimated_duration)
        
        session = WatchSession(
            device_id=device_id,
            video_url=video_url,
            pattern=pattern
        )
        
        logger.info(f"시청 세션 시작: {device_id}")
        logger.info(f"  - 영상: {video_url}")
        logger.info(f"  - 예상 시청 시간: {pattern.watch.watch_time}초 ({pattern.watch.watch_percent:.1f}%)")
        logger.info(f"  - Seek 횟수: {pattern.watch.seek_count}")
        logger.info(f"  - 좋아요: {pattern.interaction.should_like}")
        logger.info(f"  - 댓글: {pattern.interaction.should_comment}")
        
        self._active_sessions[device_id] = session
        
        try:
            # 1. YouTube 앱으로 영상 열기
            logger.info("YouTube 영상 열기...")
            await self.driver.open_youtube_video(device_id, video_url)
            await asyncio.sleep(3)  # 앱 로딩 대기
            session.started = True
            
            # 2. 영상 중앙 탭 (재생 확인)
            await self.behavior.tap_video_center(device_id)
            await asyncio.sleep(2)
            
            # 3. 시청 루프
            await self._watch_loop(session, enable_interaction)
            
            session.completed = True
            logger.info(f"시청 완료: {device_id}")
            
        except asyncio.CancelledError:
            logger.info(f"시청 취소됨: {device_id}")
        except Exception as e:
            logger.error(f"시청 오류: {e}")
        finally:
            if device_id in self._active_sessions:
                del self._active_sessions[device_id]
        
        return session
    
    async def _watch_loop(
        self,
        session: WatchSession,
        enable_interaction: bool
    ) -> None:
        """시청 메인 루프"""
        pattern = session.pattern
        watch_time = pattern.watch.watch_time
        seek_timings = pattern.watch.seek_timings.copy()
        
        like_timing = pattern.interaction.like_timing if enable_interaction else None
        comment_timing = pattern.interaction.comment_timing if enable_interaction else None
        
        elapsed = 0
        check_interval = 1  # 1초마다 체크
        
        while elapsed < watch_time:
            await asyncio.sleep(check_interval)
            elapsed += check_interval
            session.elapsed_seconds = elapsed
            
            # Seek 체크
            while seek_timings and seek_timings[0] <= elapsed:
                seek_timings.pop(0)
                direction = "forward" if random.random() > 0.3 else "backward"
                logger.info(f"Seek: {elapsed}초 ({direction})")
                await self.behavior.double_tap_seek(session.device_id, direction)
                await asyncio.sleep(0.5)
            
            # 좋아요 체크
            if like_timing and not session.liked and elapsed >= like_timing:
                logger.info(f"좋아요 탭: {elapsed}초")
                await self.behavior.tap_like_button(session.device_id)
                session.liked = True
                await asyncio.sleep(0.5)
            
            # 진행 상황 로그 (30초마다)
            if elapsed % 30 == 0:
                progress = (elapsed / watch_time) * 100
                logger.info(f"시청 중: {elapsed}/{watch_time}초 ({progress:.0f}%)")
        
        # 댓글 (시청 완료 후)
        if comment_timing and not session.commented and pattern.interaction.should_comment:
            await asyncio.sleep(2)
            logger.info(f"댓글 예정: {pattern.interaction.comment_text}")
            # TODO: 댓글 UI 자동화 구현
            session.commented = True
    
    async def watch_shorts(
        self,
        device_id: str,
        count: int = 10,
        max_duration: int = 300
    ) -> int:
        """
        YouTube Shorts 시청
        
        Args:
            device_id: 디바이스 ID
            count: 시청할 Shorts 개수
            max_duration: 최대 시청 시간 (초)
            
        Returns:
            실제 시청한 Shorts 개수
        """
        logger.info(f"Shorts 시청 시작: {count}개 목표")
        
        # Shorts 탭 열기
        await self.driver.execute_adb(
            device_id,
            "am start -a android.intent.action.VIEW -d https://www.youtube.com/shorts"
        )
        await asyncio.sleep(3)
        
        watched = 0
        total_time = 0
        
        for i in range(count):
            if total_time >= max_duration:
                logger.info(f"최대 시청 시간 도달: {total_time}초")
                break
            
            # Shorts 시청 시간 결정
            watch_time = self.behavior.generate_shorts_scroll_timing()
            logger.info(f"Shorts #{i+1}: {watch_time:.1f}초 시청")
            
            await asyncio.sleep(watch_time)
            total_time += watch_time
            
            # 다음 Shorts로 스크롤
            await self.behavior.scroll_down(device_id)
            watched += 1
        
        logger.info(f"Shorts 시청 완료: {watched}개, 총 {total_time:.0f}초")
        return watched
    
    async def browse_home(
        self,
        device_id: str,
        scroll_count: int = 5,
        video_count: int = 2
    ) -> List[WatchSession]:
        """
        홈 피드 탐색 및 영상 시청
        
        Args:
            device_id: 디바이스 ID
            scroll_count: 스크롤 횟수
            video_count: 시청할 영상 개수
            
        Returns:
            시청 세션 리스트
        """
        logger.info(f"홈 피드 탐색: {scroll_count}회 스크롤, {video_count}개 시청")
        
        # YouTube 홈 열기
        await self.driver.execute_adb(
            device_id,
            "am start -n com.google.android.youtube/.HomeActivity"
        )
        await asyncio.sleep(3)
        
        sessions = []
        videos_watched = 0
        
        for i in range(scroll_count):
            # 스크롤
            logger.info(f"스크롤 #{i+1}")
            await self.behavior.scroll_down(device_id)
            
            # 랜덤하게 영상 선택 (30% 확률)
            if videos_watched < video_count and random.random() < 0.3:
                logger.info("영상 선택!")
                
                # 화면 중앙 탭 (첫 번째 영상 선택)
                await self.behavior.natural_tap(device_id, 0.5, 0.4, 0.8, 0.2)
                await asyncio.sleep(3)
                
                # 짧은 시청 (30-120초)
                watch_time = random.randint(30, 120)
                logger.info(f"영상 시청: {watch_time}초")
                await asyncio.sleep(watch_time)
                
                videos_watched += 1
                
                # 뒤로가기
                await self.driver.press_back(device_id)
                await asyncio.sleep(2)
        
        logger.info(f"홈 탐색 완료: {videos_watched}개 시청")
        return sessions


# ==================== 편의 함수 ====================

import random  # _watch_loop에서 사용


async def demo_watch_video(video_url: str = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"):
    """
    데모: 단일 영상 시청
    
    사용법:
        python -c "import asyncio; from youtube_watcher import demo_watch_video; asyncio.run(demo_watch_video())"
    """
    logging.basicConfig(level=logging.INFO)
    
    watcher = YouTubeWatcher()
    
    if not await watcher.connect():
        logger.error("Laixi 연결 실패! touping.exe가 실행 중인지 확인하세요.")
        return
    
    try:
        devices = await watcher.list_devices()
        if not devices:
            logger.error("연결된 디바이스가 없습니다.")
            return
        
        logger.info(f"연결된 디바이스: {devices}")
        
        # 첫 번째 디바이스로 영상 시청
        device_id = devices[0]
        session = await watcher.watch_video(
            device_id=device_id,
            video_url=video_url,
            estimated_duration=180,  # 3분 영상 가정
            enable_interaction=True
        )
        
        logger.info(f"세션 결과: 시청={session.completed}, 좋아요={session.liked}")
        
    finally:
        await watcher.disconnect()


async def demo_shorts(count: int = 5):
    """
    데모: Shorts 시청
    """
    logging.basicConfig(level=logging.INFO)
    
    watcher = YouTubeWatcher()
    
    if not await watcher.connect():
        logger.error("Laixi 연결 실패!")
        return
    
    try:
        devices = await watcher.list_devices()
        if not devices:
            logger.error("연결된 디바이스가 없습니다.")
            return
        
        watched = await watcher.watch_shorts(devices[0], count=count)
        logger.info(f"총 {watched}개 Shorts 시청 완료")
        
    finally:
        await watcher.disconnect()


if __name__ == "__main__":
    asyncio.run(demo_watch_video())

