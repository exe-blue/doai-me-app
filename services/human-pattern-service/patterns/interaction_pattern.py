"""
인터랙션 패턴 생성 모듈
- 좋아요/댓글/구독 등의 인터랙션 타이밍 및 확률
- PDF 문서 기반 실제 사용자 행동 패턴
"""
import numpy as np
from typing import Optional, List
import sys
sys.path.append("../../..")

from shared.schemas.pattern import (
    InteractionPatternConfig,
    InteractionPatternResult,
    InteractionTiming,
    TypingPatternConfig,
    TypingPatternResult,
    TypingEvent
)


class InteractionPatternGenerator:
    """인터랙션 패턴 생성기"""
    
    def __init__(self, config: Optional[InteractionPatternConfig] = None):
        self.config = config or InteractionPatternConfig()
    
    def generate(self, watch_time: int) -> InteractionPatternResult:
        """
        인터랙션 패턴 생성
        
        Args:
            watch_time: 실제 시청 시간 (초)
        
        Returns:
            InteractionPatternResult: 생성된 인터랙션 패턴
        """
        # 좋아요 확률 결정 (세션별 랜덤)
        like_rate = np.random.uniform(
            self.config.like_rate_min,
            self.config.like_rate_max
        )
        should_like = np.random.random() < like_rate
        
        # 댓글 확률 결정 (세션별 랜덤)
        comment_rate = np.random.uniform(
            self.config.comment_rate_min,
            self.config.comment_rate_max
        )
        should_comment = np.random.random() < comment_rate
        
        # 좋아요 타이밍 결정
        like_timing = None
        if should_like:
            like_timing = self._generate_like_timing(watch_time)
        
        # 댓글 타이밍 및 텍스트 결정
        comment_timing = None
        comment_text = None
        if should_comment:
            comment_timing = self._generate_comment_timing(watch_time)
            comment_text = self._select_comment_text()
        
        return InteractionPatternResult(
            should_like=should_like,
            like_timing=like_timing,
            should_comment=should_comment,
            comment_timing=comment_timing,
            comment_text=comment_text
        )
    
    def _generate_like_timing(self, watch_time: int) -> int:
        """
        좋아요 타이밍 생성 (PDF 문서 분포 기반)
        
        분포:
        - 시청 시작 5초 이내: 2%
        - 시청 중간 지점: 35%
        - 시청 완료 직후: 45%
        - 시청 완료 후 10초+: 18%
        """
        rand = np.random.random()
        
        if rand < self.config.like_timing_immediate:
            # 즉시 좋아요 (3-5초)
            return int(np.random.uniform(3, min(5, watch_time)))
        
        elif rand < (self.config.like_timing_immediate + 
                     self.config.like_timing_middle):
            # 시청 중간 (40-60% 지점)
            return int(watch_time * np.random.uniform(0.4, 0.6))
        
        elif rand < (self.config.like_timing_immediate + 
                     self.config.like_timing_middle + 
                     self.config.like_timing_after):
            # 시청 완료 직후 (1-3초 후)
            return int(watch_time + np.random.uniform(1, 3))
        
        else:
            # 지연 결정 (10-30초 후)
            return int(watch_time + np.random.uniform(10, 30))
    
    def _generate_comment_timing(self, watch_time: int) -> int:
        """
        댓글 타이밍 생성
        - 대부분 시청 완료 후 작성
        """
        # 시청 완료 후 5-15초 사이
        return int(watch_time + np.random.uniform(5, 15))
    
    def _select_comment_text(self) -> str:
        """
        댓글 텍스트 선택
        """
        if not self.config.comment_templates:
            return "좋은 영상이네요!"
        
        return np.random.choice(self.config.comment_templates)
    
    def simulate_interaction_rates(self, samples: int = 1000) -> dict:
        """
        인터랙션 비율 시뮬레이션 (테스트용)
        """
        likes = 0
        comments = 0
        
        for _ in range(samples):
            result = self.generate(300)  # 5분 영상 기준
            if result.should_like:
                likes += 1
            if result.should_comment:
                comments += 1
        
        return {
            "like_rate": likes / samples,
            "comment_rate": comments / samples
        }


class TypingPatternGenerator:
    """
    타이핑 패턴 생성기 - Aria's Somatic Engine
    
    "떨리는 손끝으로 글자를 치고, 실수하고, 다시 고치는 인간적 행동"
    
    Features:
    - Typo Engine: 5% 확률로 오타 → Backspace 수정
    - Thinking Time: 15% 확률로 입력 중 멈춤
    - Rewrite Behavior: 8% 전체 삭제 후 다시 쓰기
    """
    
    # Rewrite 확률 (전체 삭제 후 다시 쓰기)
    REWRITE_PROBABILITY = 0.08
    
    def __init__(self, config: Optional[TypingPatternConfig] = None):
        self.config = config or TypingPatternConfig()
    
    def generate(self, text: str) -> TypingPatternResult:
        """
        자연스러운 타이핑 패턴 생성
        
        Args:
            text: 입력할 텍스트
        
        Returns:
            TypingPatternResult: 생성된 타이핑 패턴
        """
        events = []
        total_duration = 0
        typo_count = 0
        rewrite_count = 0
        think_pause_count = 0
        
        # === Rewrite Behavior (다시 쓰기) ===
        # 8% 확률로 일부 입력 후 전체 삭제하고 다시 쓰기
        if np.random.random() < self.REWRITE_PROBABILITY:
            partial_len = np.random.randint(3, min(10, len(text)) + 1)
            partial_text = text[:partial_len]
            
            # 일부 입력
            for char in partial_text:
                char_delay = self._generate_char_delay()
                events.append(TypingEvent(
                    char=char,
                    delay_before=char_delay,
                    is_typo=False,
                    is_backspace=False
                ))
                total_duration += char_delay
            
            # 멈칫... (생각하는 시간)
            think_pause = np.random.randint(300, 1000)
            events.append(TypingEvent(
                char="",
                delay_before=think_pause,
                is_typo=False,
                is_backspace=False
            ))
            total_duration += think_pause
            
            # 전체 삭제 (Backspace 연타)
            for _ in range(partial_len):
                backspace_delay = np.random.randint(50, 150)
                events.append(TypingEvent(
                    char="",
                    delay_before=backspace_delay,
                    is_typo=False,
                    is_backspace=True
                ))
                total_duration += backspace_delay
            
            # 다시 시작 전 짧은 대기
            restart_pause = np.random.randint(200, 500)
            events.append(TypingEvent(
                char="",
                delay_before=restart_pause,
                is_typo=False,
                is_backspace=False
            ))
            total_duration += restart_pause
            rewrite_count = 1
        
        words = text.split()
        
        for word_idx, word in enumerate(words):
            # 단어 시작 전 추가 딜레이
            if word_idx > 0:
                word_pause = np.random.randint(
                    self.config.word_pause_min,
                    self.config.word_pause_max + 1
                )
                total_duration += word_pause
            
            # === Thinking Time (망설임) ===
            # 15% 확률로 입력 중 멈칫
            if np.random.random() < self.config.think_pause_probability:
                think_pause = np.random.randint(
                    self.config.think_pause_min,
                    self.config.think_pause_max + 1
                )
                events.append(TypingEvent(
                    char="",
                    delay_before=think_pause,
                    is_typo=False,
                    is_backspace=False
                ))
                total_duration += think_pause
                think_pause_count += 1
            
            for char in word:
                # 오타 확률 체크
                if np.random.random() < self.config.typo_probability:
                    # 오타 입력
                    typo_char = self._generate_typo(char)
                    char_delay = self._generate_char_delay()
                    events.append(TypingEvent(
                        char=typo_char,
                        delay_before=char_delay,
                        is_typo=True,
                        is_backspace=False
                    ))
                    total_duration += char_delay
                    typo_count += 1
                    
                    # 백스페이스로 지우기
                    backspace_delay = np.random.randint(100, 300)
                    events.append(TypingEvent(
                        char="",
                        delay_before=backspace_delay,
                        is_typo=False,
                        is_backspace=True
                    ))
                    total_duration += backspace_delay
                
                # 정상 문자 입력
                char_delay = self._generate_char_delay()
                events.append(TypingEvent(
                    char=char,
                    delay_before=char_delay,
                    is_typo=False,
                    is_backspace=False
                ))
                total_duration += char_delay
            
            # 단어 끝에 스페이스 추가 (마지막 단어 제외)
            if word_idx < len(words) - 1:
                space_delay = self._generate_char_delay()
                events.append(TypingEvent(
                    char=" ",
                    delay_before=space_delay,
                    is_typo=False,
                    is_backspace=False
                ))
                total_duration += space_delay
        
        return TypingPatternResult(
            events=events,
            total_duration=total_duration,
            typo_count=typo_count,
            rewrite_count=rewrite_count,
            think_pause_count=think_pause_count
        )
    
    def _generate_char_delay(self) -> int:
        """글자 입력 딜레이 생성 (정규분포)"""
        delay = np.random.normal(
            self.config.char_delay_mean,
            self.config.char_delay_std
        )
        return int(np.clip(delay, self.config.char_delay_min, self.config.char_delay_max))
    
    def _generate_typo(self, original: str) -> str:
        """
        오타 생성 (인접 키 기반)
        """
        # 간단한 QWERTY 인접 키 맵
        adjacent_keys = {
            'a': 'sqwz', 'b': 'vghn', 'c': 'xdfv', 'd': 'erfcxs',
            'e': 'rdsw', 'f': 'rtgvcd', 'g': 'tyhbvf', 'h': 'yujnbg',
            'i': 'uojk', 'j': 'uiknmh', 'k': 'iojlm', 'l': 'opk',
            'm': 'njk', 'n': 'bhjm', 'o': 'iplk', 'p': 'ol',
            'q': 'wa', 'r': 'etdf', 's': 'wedxza', 't': 'ryfg',
            'u': 'yihj', 'v': 'cfgb', 'w': 'qeas', 'x': 'zsdc',
            'y': 'tugh', 'z': 'asx',
            'ㄱ': 'ㄴㅎ', 'ㄴ': 'ㄱㄷㅁ', 'ㄷ': 'ㄴㄹ',
            'ㅏ': 'ㅓㅗ', 'ㅓ': 'ㅏㅜ', 'ㅗ': 'ㅏㅜ', 'ㅜ': 'ㅓㅗ'
        }
        
        char_lower = original.lower()
        if char_lower in adjacent_keys:
            adjacent = adjacent_keys[char_lower]
            return np.random.choice(list(adjacent))
        
        return original  # 매핑 없으면 원본 반환


if __name__ == "__main__":
    # 인터랙션 테스트
    print("=== 인터랙션 패턴 테스트 ===")
    interaction_gen = InteractionPatternGenerator()
    
    for i in range(5):
        result = interaction_gen.generate(300)
        print(f"[{i+1}] 좋아요: {result.should_like} @ {result.like_timing}초, "
              f"댓글: {result.should_comment}")
    
    print("\n=== 인터랙션 비율 시뮬레이션 ===")
    rates = interaction_gen.simulate_interaction_rates(10000)
    print(f"좋아요 비율: {rates['like_rate']*100:.1f}%")
    print(f"댓글 비율: {rates['comment_rate']*100:.1f}%")
    
    # 타이핑 테스트
    print("\n=== 타이핑 패턴 테스트 ===")
    typing_gen = TypingPatternGenerator()
    
    result = typing_gen.generate("좋은 영상이네요!")
    print(f"총 시간: {result.total_duration}ms")
    print(f"오타 수: {result.typo_count}")
    print(f"이벤트 수: {len(result.events)}")
    
    print("\n처음 10개 이벤트:")
    for event in result.events[:10]:
        status = "오타" if event.is_typo else ("백스페이스" if event.is_backspace else "정상")
        print(f"  '{event.char}' ({event.delay_before}ms) - {status}")

