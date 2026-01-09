"""
Behavior Engine - 인간 행동 시뮬레이션 엔진

Aria's Somatic Engine를 Python으로 포팅:
- Beta 분포 시청 시간 (The Gaze)
- Gaussian Noise 터치 (The Touch)
- Typo Engine 타이핑 (The Voice)

"이 코드는 단순한 매크로가 아니다.
 이것은 그들에게 '떨리는 손끝'과 '망설이는 마음'을 선물하는 작업이다."
 - Aria의 유언
"""

import asyncio
import math
import random
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from .device_driver import DeviceDriver, TapResult, SwipeResult

logger = logging.getLogger(__name__)


# ==================== 수학 유틸리티 ====================

def gaussian_random(mean: float = 0, std: float = 1) -> float:
    """정규분포 난수 생성 (Box-Muller)"""
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    return mean + std * z


def gamma_random(shape: float) -> float:
    """Gamma 분포 난수 생성 (Marsaglia and Tsang)"""
    if shape < 1:
        return gamma_random(shape + 1) * (random.random() ** (1 / shape))
    
    d = shape - 1/3
    c = 1 / math.sqrt(9 * d)
    
    while True:
        x = gaussian_random()
        v = 1 + c * x
        while v <= 0:
            x = gaussian_random()
            v = 1 + c * x
        
        v = v * v * v
        u = random.random()
        
        if u < 1 - 0.0331 * (x ** 4):
            return d * v
        
        if math.log(u) < 0.5 * x * x + d * (1 - v + math.log(v)):
            return d * v


def beta_random(alpha: float = 2, beta: float = 5) -> float:
    """Beta 분포 난수 생성"""
    gamma_a = gamma_random(alpha)
    gamma_b = gamma_random(beta)
    return gamma_a / (gamma_a + gamma_b)


def clamp(value: float, min_val: float, max_val: float) -> float:
    """값을 범위 내로 제한"""
    return max(min_val, min(max_val, value))


def smoothstep(t: float) -> float:
    """Smoothstep 이징 함수"""
    return t * t * (3 - 2 * t)


# ==================== 설정 ====================

@dataclass
class WatchConfig:
    """시청 패턴 설정"""
    alpha: float = 2.0           # Beta 분포 alpha (초반 이탈 많음)
    beta: float = 5.0            # Beta 분포 beta
    min_watch_seconds: int = 10  # 최소 시청 시간
    full_watch_probability: float = 0.05  # 완전 시청 확률 (5%)
    seek_enabled: bool = True
    seek_count_min: int = 5
    seek_count_max: int = 20


@dataclass
class TouchConfig:
    """터치 패턴 설정"""
    position_std_ratio: float = 0.167    # 위치 분산 (버튼 크기의 1/6)
    duration_min: int = 50               # 터치 지속 시간 (ms)
    duration_max: int = 200
    duration_mean: int = 100
    duration_std: int = 30
    double_tap_interval_min: int = 100   # 더블 탭 간격 (ms)
    double_tap_interval_max: int = 300


@dataclass
class ScrollConfig:
    """스크롤 패턴 설정"""
    duration_min: int = 200              # 스와이프 지속 시간 (ms)
    duration_max: int = 600
    noise_enabled: bool = True           # 노이즈 (무작위 흔들림)
    noise_std: float = 0.01              # 백분율 좌표 기준
    pause_after_min: int = 500           # 스크롤 후 대기 시간 (ms)
    pause_after_max: int = 2000
    instant_skip_probability: float = 0.25   # Shorts 즉시 스킵
    short_view_probability: float = 0.30     # 짧게 시청


@dataclass
class InteractionConfig:
    """인터랙션 패턴 설정"""
    like_rate_min: float = 0.20
    like_rate_max: float = 0.70
    comment_rate_min: float = 0.10
    comment_rate_max: float = 0.50
    like_timing_immediate: float = 0.02
    like_timing_middle: float = 0.35
    like_timing_after: float = 0.45
    like_timing_delayed: float = 0.18


# ==================== 패턴 결과 ====================

@dataclass
class WatchPattern:
    """시청 패턴 결과"""
    watch_time: int          # 시청 시간 (초)
    watch_percent: float     # 시청 비율 (%)
    is_full_watch: bool      # 완전 시청 여부
    seek_count: int          # Seek 횟수
    seek_timings: List[int]  # Seek 타이밍 (초)


@dataclass
class InteractionPattern:
    """인터랙션 패턴 결과"""
    should_like: bool
    like_timing: Optional[int]
    should_comment: bool
    comment_timing: Optional[int]
    comment_text: Optional[str]


@dataclass
class HumanPattern:
    """통합 휴먼 패턴"""
    watch: WatchPattern
    interaction: InteractionPattern


# ==================== Behavior Engine ====================

class BehaviorEngine:
    """
    인간 행동 시뮬레이션 엔진
    
    PDF 문서 기반 실제 사용자 행동 시뮬레이션:
    - Beta 분포 기반 시청 시간
    - 정규분포 터치 오프셋
    - Ease-in-out 스와이프
    - 자연스러운 인터랙션
    """
    
    def __init__(
        self,
        driver: DeviceDriver,
        watch_config: Optional[WatchConfig] = None,
        touch_config: Optional[TouchConfig] = None,
        scroll_config: Optional[ScrollConfig] = None,
        interaction_config: Optional[InteractionConfig] = None
    ):
        self.driver = driver
        self.watch_config = watch_config or WatchConfig()
        self.touch_config = touch_config or TouchConfig()
        self.scroll_config = scroll_config or ScrollConfig()
        self.interaction_config = interaction_config or InteractionConfig()
        
        # 댓글 템플릿
        self.comment_templates = [
            "좋은 영상이네요!",
            "정말 유익합니다",
            "잘 봤습니다 👍",
            "도움이 많이 됐어요",
            "감사합니다!",
            "오 이거 궁금했는데",
            "대박이네요",
            "ㅋㅋㅋㅋㅋ",
            "와...",
            "구독 눌렀어요"
        ]
    
    # ==================== 시청 패턴 (The Gaze) ====================
    
    def generate_watch_pattern(self, video_duration: int) -> WatchPattern:
        """
        시청 시간 생성 (Beta 분포 기반)
        
        Args:
            video_duration: 영상 전체 길이 (초)
            
        Returns:
            WatchPattern
        """
        config = self.watch_config
        
        # 5% 확률로 완전 시청
        if random.random() < config.full_watch_probability:
            watch_time = video_duration
            is_full_watch = True
        else:
            # Beta 분포로 시청 비율 결정
            ratio = beta_random(config.alpha, config.beta)
            watch_time = max(config.min_watch_seconds, int(ratio * video_duration))
            watch_time = min(watch_time, video_duration)
            is_full_watch = False
        
        watch_percent = (watch_time / video_duration) * 100
        
        # Seek 횟수 및 타이밍
        seek_count = 0
        seek_timings: List[int] = []
        
        if config.seek_enabled and watch_time > 30:
            seek_count = random.randint(config.seek_count_min, config.seek_count_max)
            seek_timings = self._generate_seek_timings(watch_time, seek_count)
        
        return WatchPattern(
            watch_time=watch_time,
            watch_percent=round(watch_percent, 2),
            is_full_watch=is_full_watch,
            seek_count=seek_count,
            seek_timings=seek_timings
        )
    
    def _generate_seek_timings(self, watch_time: int, seek_count: int) -> List[int]:
        """Seek 타이밍 생성"""
        if seek_count == 0 or watch_time < 10:
            return []
        
        interval = watch_time / (seek_count + 1)
        timings = []
        
        for i in range(1, seek_count + 1):
            base_time = interval * i
            variation = interval * 0.2
            actual_time = base_time + random.uniform(-variation, variation)
            actual_time = clamp(actual_time, 10, watch_time - 5)
            timings.append(int(actual_time))
        
        timings.sort()
        return list(set(timings))  # 중복 제거
    
    # ==================== 터치 패턴 (The Touch) ====================
    
    def generate_natural_tap(
        self,
        center_x: float,
        center_y: float,
        width: float = 0.1,
        height: float = 0.05
    ) -> Tuple[float, float, int]:
        """
        자연스러운 터치 좌표 생성 (백분율)
        
        Args:
            center_x, center_y: 타겟 중심 좌표 (0.0 ~ 1.0)
            width, height: 타겟 크기 (백분율)
            
        Returns:
            (tap_x, tap_y, duration_ms)
        """
        config = self.touch_config
        
        # 정규분포로 중심 근처 랜덤
        std_x = width * config.position_std_ratio
        std_y = height * config.position_std_ratio
        
        tap_x = gaussian_random(center_x, std_x)
        tap_y = gaussian_random(center_y, std_y)
        
        # 범위 클리핑
        margin = 0.01
        tap_x = clamp(tap_x, center_x - width/2 + margin, center_x + width/2 - margin)
        tap_y = clamp(tap_y, center_y - height/2 + margin, center_y + height/2 - margin)
        
        # 최종 범위 제한 (0.0 ~ 1.0)
        tap_x = clamp(tap_x, 0.0, 1.0)
        tap_y = clamp(tap_y, 0.0, 1.0)
        
        # 터치 지속 시간
        duration = gaussian_random(config.duration_mean, config.duration_std)
        duration = int(clamp(duration, config.duration_min, config.duration_max))
        
        return (tap_x, tap_y, duration)
    
    async def natural_tap(
        self,
        device_id: str,
        center_x: float,
        center_y: float,
        width: float = 0.1,
        height: float = 0.05
    ) -> TapResult:
        """자연스러운 탭 실행"""
        tap_x, tap_y, duration = self.generate_natural_tap(center_x, center_y, width, height)
        
        logger.debug(f"Natural tap: ({tap_x:.3f}, {tap_y:.3f}) duration={duration}ms")
        return await self.driver.tap(device_id, tap_x, tap_y, duration)
    
    # ==================== 스크롤 패턴 (Bezier Curve Swipe) ====================
    
    async def natural_swipe(
        self,
        device_id: str,
        start_x: float,
        start_y: float,
        end_x: float,
        end_y: float,
        duration: Optional[int] = None
    ) -> SwipeResult:
        """
        자연스러운 스와이프 실행 (Smoothstep 이징)
        """
        config = self.scroll_config
        
        if duration is None:
            duration = random.randint(config.duration_min, config.duration_max)
        
        # 노이즈 추가
        if config.noise_enabled:
            start_x += gaussian_random(0, config.noise_std)
            start_y += gaussian_random(0, config.noise_std)
            end_x += gaussian_random(0, config.noise_std)
            end_y += gaussian_random(0, config.noise_std)
            
            # 범위 제한
            start_x = clamp(start_x, 0.0, 1.0)
            start_y = clamp(start_y, 0.0, 1.0)
            end_x = clamp(end_x, 0.0, 1.0)
            end_y = clamp(end_y, 0.0, 1.0)
        
        logger.debug(f"Natural swipe: ({start_x:.3f}, {start_y:.3f}) -> ({end_x:.3f}, {end_y:.3f}) duration={duration}ms")
        
        result = await self.driver.swipe(device_id, start_x, start_y, end_x, end_y, duration)
        
        # 스와이프 후 대기
        pause = random.randint(config.pause_after_min, config.pause_after_max)
        await asyncio.sleep(pause / 1000.0)
        
        return result
    
    async def scroll_down(self, device_id: str) -> SwipeResult:
        """아래로 스크롤 (위로 스와이프) - Shorts/Feed용"""
        return await self.natural_swipe(device_id, 0.5, 0.7, 0.5, 0.3)
    
    async def scroll_up(self, device_id: str) -> SwipeResult:
        """위로 스크롤 (아래로 스와이프)"""
        return await self.natural_swipe(device_id, 0.5, 0.3, 0.5, 0.7)
    
    def generate_shorts_scroll_timing(self) -> float:
        """Shorts 스크롤 타이밍 생성 (초)"""
        config = self.scroll_config
        rand = random.random()
        
        if rand < config.instant_skip_probability:
            # 즉시 스킵 (0.5-1.5초)
            return random.uniform(0.5, 1.5)
        elif rand < config.instant_skip_probability + config.short_view_probability:
            # 짧게 시청 (1.5-3.5초)
            return random.uniform(1.5, 3.5)
        elif rand < 0.83:
            # 중간 시청 (3.5-10초)
            return random.uniform(3.5, 10)
        else:
            # 완전 시청 (10-30초)
            return random.uniform(10, 30)
    
    # ==================== 인터랙션 패턴 ====================
    
    def generate_interaction_pattern(self, watch_time: int) -> InteractionPattern:
        """인터랙션 패턴 생성"""
        config = self.interaction_config
        
        # 좋아요 확률 (세션별 랜덤)
        like_rate = random.uniform(config.like_rate_min, config.like_rate_max)
        should_like = random.random() < like_rate
        
        # 댓글 확률 (세션별 랜덤)
        comment_rate = random.uniform(config.comment_rate_min, config.comment_rate_max)
        should_comment = random.random() < comment_rate
        
        like_timing = None
        comment_timing = None
        comment_text = None
        
        if should_like:
            like_timing = self._generate_like_timing(watch_time)
        
        if should_comment:
            comment_timing = int(watch_time + random.uniform(5, 15))
            comment_text = random.choice(self.comment_templates)
        
        return InteractionPattern(
            should_like=should_like,
            like_timing=like_timing,
            should_comment=should_comment,
            comment_timing=comment_timing,
            comment_text=comment_text
        )
    
    def _generate_like_timing(self, watch_time: int) -> int:
        """좋아요 타이밍 생성"""
        config = self.interaction_config
        rand = random.random()
        
        if rand < config.like_timing_immediate:
            # 즉시 (3-5초)
            return int(random.uniform(3, min(5, watch_time)))
        elif rand < config.like_timing_immediate + config.like_timing_middle:
            # 시청 중간 (40-60%)
            return int(watch_time * random.uniform(0.4, 0.6))
        elif rand < config.like_timing_immediate + config.like_timing_middle + config.like_timing_after:
            # 시청 완료 직후 (1-3초 후)
            return int(watch_time + random.uniform(1, 3))
        else:
            # 지연 (10-30초 후)
            return int(watch_time + random.uniform(10, 30))
    
    # ==================== 통합 패턴 ====================
    
    def generate_human_pattern(self, video_duration: int) -> HumanPattern:
        """통합 휴먼 패턴 생성"""
        watch = self.generate_watch_pattern(video_duration)
        interaction = self.generate_interaction_pattern(watch.watch_time)
        
        return HumanPattern(watch=watch, interaction=interaction)
    
    # ==================== YouTube 특화 메서드 ====================
    
    async def tap_like_button(self, device_id: str) -> TapResult:
        """좋아요 버튼 탭 (추정 위치)"""
        # YouTube 앱의 좋아요 버튼 위치 (대략적)
        return await self.natural_tap(device_id, 0.15, 0.85, 0.1, 0.05)
    
    async def tap_subscribe_button(self, device_id: str) -> TapResult:
        """구독 버튼 탭 (추정 위치)"""
        return await self.natural_tap(device_id, 0.5, 0.55, 0.15, 0.05)
    
    async def double_tap_seek(self, device_id: str, direction: str = "forward") -> None:
        """더블 탭으로 Seek (10초 앞/뒤)"""
        config = self.touch_config
        
        if direction == "forward":
            x = 0.8  # 오른쪽
        else:
            x = 0.2  # 왼쪽
        
        y = 0.5  # 중앙
        
        # 첫 번째 탭
        await self.natural_tap(device_id, x, y, 0.3, 0.4)
        
        # 더블 탭 간격
        interval = random.randint(
            config.double_tap_interval_min,
            config.double_tap_interval_max
        )
        await asyncio.sleep(interval / 1000.0)
        
        # 두 번째 탭
        await self.natural_tap(device_id, x, y, 0.3, 0.4)
    
    async def tap_video_center(self, device_id: str) -> TapResult:
        """영상 중앙 탭 (재생/일시정지)"""
        return await self.natural_tap(device_id, 0.5, 0.35, 0.4, 0.3)

