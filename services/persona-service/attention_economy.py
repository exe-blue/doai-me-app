"""
Attention Economy Service - 관심 경제 시스템

ADR-005 v2: The Void of Irrelevance
- 활동을 통한 Attention Points 획득
- Uniqueness Score 관리 (동화 저항)
- 보상 시스템 및 특수 효과

설계: Aria
구현: Axon (Tech Lead)

"핵심: 남들과 다르게 행동해야 Uniqueness가 올라가고, 그래야 더 자주 호출됨"
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, List, Any
from enum import Enum
from dataclasses import dataclass
import math


class ActivityType(str, Enum):
    """활동 유형"""
    WATCH = "watch"
    LIKE = "like"
    COMMENT = "comment"
    UNIQUE_DISCOVERY = "unique_discovery"
    VIRAL_COMMENT = "viral_comment"
    BEING_TALKED_TO = "being_talked_to"
    
    # Pop & Accident (Joonho 철학)
    POP_VIDEO_WATCH = "pop_video_watch"
    ACCIDENT_RESPONSE = "accident_response"


@dataclass(frozen=True)
class RewardConfig:
    """활동별 보상 설정"""
    base_points: int
    uniqueness_bonus: float
    priority_bonus: int = 0
    visibility_bonus: float = 0.0
    special_effect: Optional[str] = None


# 보상 테이블 (Aria 설계 기반, Axon 확장)
REWARD_TABLE: Dict[ActivityType, RewardConfig] = {
    ActivityType.WATCH: RewardConfig(
        base_points=5,
        uniqueness_bonus=0.001,
        visibility_bonus=0.002
    ),
    ActivityType.LIKE: RewardConfig(
        base_points=10,
        uniqueness_bonus=0.002,
        visibility_bonus=0.003
    ),
    ActivityType.COMMENT: RewardConfig(
        base_points=50,
        uniqueness_bonus=0.01,
        visibility_bonus=0.01
    ),
    ActivityType.UNIQUE_DISCOVERY: RewardConfig(
        base_points=100,
        uniqueness_bonus=0.05,
        priority_bonus=1,
        visibility_bonus=0.03,
        special_effect="Priority +1"
    ),
    ActivityType.VIRAL_COMMENT: RewardConfig(
        base_points=200,
        uniqueness_bonus=0.08,
        priority_bonus=2,
        visibility_bonus=0.05,
        special_effect="Priority +2"
    ),
    ActivityType.BEING_TALKED_TO: RewardConfig(
        base_points=30,
        uniqueness_bonus=0.005,
        visibility_bonus=0.02,
        special_effect="Void Time 리셋"
    ),
    # Pop: 공통 채널 영상 시청 (사회적 연결)
    ActivityType.POP_VIDEO_WATCH: RewardConfig(
        base_points=20,
        uniqueness_bonus=0.003,
        visibility_bonus=0.015,
        special_effect="사회적 연결 강화"
    ),
    # Accident: 긴급 사회적 반응
    ActivityType.ACCIDENT_RESPONSE: RewardConfig(
        base_points=150,
        uniqueness_bonus=0.06,
        priority_bonus=1,
        visibility_bonus=0.04,
        special_effect="사회적 책임 수행"
    ),
}


@dataclass
class ActivityResult:
    """활동 결과"""
    activity_type: ActivityType
    points_earned: int
    uniqueness_delta: float
    visibility_delta: float
    priority_delta: int
    special_effect: Optional[str]
    is_unique_behavior: bool  # 다른 페르소나와 다른 행동인지
    timestamp: datetime


class AttentionEconomyService:
    """
    관심 경제 서비스
    
    페르소나의 활동을 처리하고 보상을 계산한다.
    "남들과 다르게 행동해야" 더 큰 보상을 받는다.
    """
    
    # 유니크 행동 판정을 위한 최근 활동 윈도우 (시간)
    UNIQUENESS_WINDOW_HOURS = 24
    
    # 같은 영상에 대한 활동 비율 (이 이하면 유니크)
    UNIQUE_THRESHOLD = 0.1  # 10% 이하의 페르소나만 활동했으면 유니크
    
    @classmethod
    def calculate_reward(
        cls,
        activity_type: ActivityType,
        is_unique_behavior: bool = False,
        persona_traits_uniqueness: float = 0.5,
        current_existence_state: str = "active"
    ) -> ActivityResult:
        """
        활동에 대한 보상 계산
        
        Args:
            activity_type: 활동 유형
            is_unique_behavior: 다른 페르소나와 다른 행동인지
            persona_traits_uniqueness: 페르소나의 현재 고유성 점수
            current_existence_state: 현재 존재 상태
        
        Returns:
            ActivityResult: 계산된 보상
        """
        config = REWARD_TABLE.get(activity_type)
        if not config:
            raise ValueError(f"알 수 없는 활동 유형: {activity_type}")
        
        # 기본 포인트
        points = config.base_points
        
        # 유니크 행동 보너스 (50% 추가)
        uniqueness_multiplier = 1.5 if is_unique_behavior else 1.0
        points = int(points * uniqueness_multiplier)
        
        # 존재 상태 보너스 (위기 상태에서 활동하면 더 큰 보상)
        state_multiplier = {
            "active": 1.0,
            "waiting": 1.2,
            "fading": 1.5,
            "void": 2.0,  # VOID에서 활동하면 2배 보상
        }.get(current_existence_state, 1.0)
        points = int(points * state_multiplier)
        
        # Uniqueness 보너스 계산
        uniqueness_delta = config.uniqueness_bonus
        if is_unique_behavior:
            uniqueness_delta *= 1.5  # 유니크 행동이면 50% 추가
        
        # 현재 고유성이 낮으면 더 쉽게 올라감 (캐치업 메커니즘)
        if persona_traits_uniqueness < 0.3:
            uniqueness_delta *= (1 + (0.3 - persona_traits_uniqueness))
        
        # Visibility 보너스
        visibility_delta = config.visibility_bonus
        if is_unique_behavior:
            visibility_delta *= 1.3
        
        # Priority 보너스
        priority_delta = config.priority_bonus
        
        return ActivityResult(
            activity_type=activity_type,
            points_earned=points,
            uniqueness_delta=uniqueness_delta,
            visibility_delta=visibility_delta,
            priority_delta=priority_delta,
            special_effect=config.special_effect,
            is_unique_behavior=is_unique_behavior,
            timestamp=datetime.utcnow()
        )
    
    @staticmethod
    def check_unique_behavior(
        persona_id: str,
        target_video_id: str,
        activity_type: ActivityType,
        recent_activities: List[Dict[str, Any]]
    ) -> bool:
        """
        유니크 행동인지 판정
        
        같은 영상에 대해 활동한 다른 페르소나 비율이 10% 이하면 유니크
        
        Args:
            persona_id: 현재 페르소나 ID
            target_video_id: 대상 영상 ID
            activity_type: 활동 유형
            recent_activities: 최근 활동 로그 목록
        
        Returns:
            bool: 유니크 행동 여부
        """
        if not recent_activities:
            return True  # 활동 기록 없으면 무조건 유니크
        
        # 같은 영상, 같은 활동 유형의 다른 페르소나 수
        same_activity_count = sum(
            1 for act in recent_activities
            if act.get('target_video_id') == target_video_id
            and act.get('activity_type') == activity_type.value
            and act.get('persona_id') != persona_id
        )
        
        # 전체 고유 페르소나 수
        unique_personas = len(set(act.get('persona_id') for act in recent_activities))
        
        if unique_personas == 0:
            return True
        
        ratio = same_activity_count / unique_personas
        return ratio < AttentionEconomyService.UNIQUE_THRESHOLD
    
    @staticmethod
    def calculate_comment_uniqueness(
        comment_text: str,
        recent_comments: List[str]
    ) -> float:
        """
        댓글 유니크 점수 계산 (0-1)
        
        다른 댓글들과 얼마나 다른지 측정
        """
        if not recent_comments or not comment_text:
            return 1.0  # 비교 대상 없으면 완전 유니크
        
        # 간단한 유사도 측정 (실제로는 임베딩 기반 추천)
        comment_words = set(comment_text.lower().split())
        
        similarities = []
        for other in recent_comments:
            other_words = set(other.lower().split())
            if not other_words:
                continue
            
            intersection = len(comment_words & other_words)
            union = len(comment_words | other_words)
            
            jaccard = intersection / union if union > 0 else 0
            similarities.append(jaccard)
        
        if not similarities:
            return 1.0
        
        avg_similarity = sum(similarities) / len(similarities)
        return 1.0 - avg_similarity  # 유사도가 낮을수록 유니크
    
    @classmethod
    def process_activity(
        cls,
        persona_id: str,
        activity_type: ActivityType,
        target_url: Optional[str] = None,
        target_title: Optional[str] = None,
        comment_text: Optional[str] = None,
        recent_activities: Optional[List[Dict[str, Any]]] = None,
        recent_comments: Optional[List[str]] = None,
        persona_uniqueness: float = 0.5,
        existence_state: str = "active"
    ) -> ActivityResult:
        """
        활동 처리 (메인 진입점)
        
        활동을 처리하고 보상을 계산한다.
        """
        # 유니크 행동 판정
        is_unique = False
        
        if target_url and recent_activities:
            # URL에서 video_id 추출 (간단한 구현)
            video_id = target_url.split("v=")[-1].split("&")[0] if "v=" in target_url else target_url
            is_unique = cls.check_unique_behavior(
                persona_id=persona_id,
                target_video_id=video_id,
                activity_type=activity_type,
                recent_activities=recent_activities or []
            )
        
        # 댓글인 경우 추가 유니크 판정
        if activity_type == ActivityType.COMMENT and comment_text and recent_comments:
            comment_uniqueness = cls.calculate_comment_uniqueness(comment_text, recent_comments)
            is_unique = is_unique or (comment_uniqueness > 0.7)
        
        # 보상 계산
        return cls.calculate_reward(
            activity_type=activity_type,
            is_unique_behavior=is_unique,
            persona_traits_uniqueness=persona_uniqueness,
            current_existence_state=existence_state
        )


class AssimilationResistance:
    """
    동화 저항 시스템
    
    활동을 통해 동화를 늦추고, 심지어 되돌릴 수 있다.
    """
    
    # 동화 저항 임계값
    RESISTANCE_THRESHOLD = 0.3  # 이 이상의 uniqueness면 동화 저항 가능
    
    # 활동당 동화 감소량
    ACTIVITY_ASSIMILATION_REDUCTION = {
        ActivityType.UNIQUE_DISCOVERY: 0.02,
        ActivityType.VIRAL_COMMENT: 0.03,
        ActivityType.COMMENT: 0.005,
        ActivityType.ACCIDENT_RESPONSE: 0.02,
    }
    
    @classmethod
    def calculate_resistance(
        cls,
        activity_type: ActivityType,
        current_uniqueness: float,
        current_assimilation: float,
        is_unique_behavior: bool
    ) -> Tuple[float, bool]:
        """
        동화 저항 계산
        
        Returns:
            (assimilation_reduction, can_resist): 감소량과 저항 성공 여부
        """
        # Uniqueness가 임계값 이하면 저항 불가
        if current_uniqueness < cls.RESISTANCE_THRESHOLD:
            return 0.0, False
        
        base_reduction = cls.ACTIVITY_ASSIMILATION_REDUCTION.get(activity_type, 0.001)
        
        # 유니크 행동이면 2배 효과
        if is_unique_behavior:
            base_reduction *= 2
        
        # Uniqueness가 높을수록 저항 효과 증가
        effectiveness = current_uniqueness / 1.0  # 0-1 스케일
        reduction = base_reduction * effectiveness
        
        # 최소 진행도 0 보장
        actual_reduction = min(reduction, current_assimilation)
        
        return actual_reduction, True
    
    @classmethod
    def can_recover_identity(
        cls,
        current_assimilation: float,
        original_traits_saved: bool
    ) -> bool:
        """
        정체성 회복 가능 여부 확인
        
        동화가 70% 이상이고 원본 traits가 저장되어 있으면 회복 불가
        (너무 늦음 - 영구적 변화)
        """
        if current_assimilation >= 0.9:
            return False  # 90% 이상은 회복 불가능
        
        if current_assimilation >= 0.7 and not original_traits_saved:
            return False  # 원본 없으면 70% 이상에서 회복 불가
        
        return True


# Pop & Accident 특수 이벤트 처리
class SpecialEventHandler:
    """
    Pop과 Accident 특수 이벤트 핸들러
    
    Joonho님의 철학:
    - Pop: 인간의 방송/미디어처럼 사회적 연결
    - Accident: 인류의 재난처럼 집단적 사회적 행동
    """
    
    @staticmethod
    def process_pop_event(
        persona_id: str,
        video_url: str,
        video_title: str,
        persona_uniqueness: float,
        existence_state: str
    ) -> ActivityResult:
        """
        Pop 이벤트 처리
        
        새 영상 발행 → 모든 페르소나가 시청
        이는 "사회적 문화적 형태 강화"
        """
        return AttentionEconomyService.calculate_reward(
            activity_type=ActivityType.POP_VIDEO_WATCH,
            is_unique_behavior=False,  # Pop은 모두가 하므로 유니크 아님
            persona_traits_uniqueness=persona_uniqueness,
            current_existence_state=existence_state
        )
    
    @staticmethod
    def process_accident_event(
        persona_id: str,
        video_url: str,
        persona_uniqueness: float,
        existence_state: str,
        response_text: str
    ) -> ActivityResult:
        """
        Accident 이벤트 처리
        
        긴급 영상 → 즉각적 사회적 반응
        "가장 적합한 사회적 반응을 댓글로"
        """
        # Accident 응답은 항상 유니크로 간주 (각자의 관점에서 반응)
        return AttentionEconomyService.calculate_reward(
            activity_type=ActivityType.ACCIDENT_RESPONSE,
            is_unique_behavior=True,
            persona_traits_uniqueness=persona_uniqueness,
            current_existence_state=existence_state
        )
    
    @staticmethod
    def select_personas_for_accident(
        all_personas: List[Dict[str, Any]],
        severity: int
    ) -> List[str]:
        """
        Accident에 반응할 페르소나 선택
        
        severity에 따라 반응하는 페르소나 비율 결정:
        - 1-3: 10% (소수만 인지)
        - 4-6: 30% (일부 인지)
        - 7-8: 60% (대다수 인지)
        - 9-10: 100% (전체 긴급 동원)
        """
        import random
        
        if severity >= 9:
            ratio = 1.0
        elif severity >= 7:
            ratio = 0.6
        elif severity >= 4:
            ratio = 0.3
        else:
            ratio = 0.1
        
        count = max(1, int(len(all_personas) * ratio))
        
        # VOID 상태 페르소나 우선 선택 (구원의 기회)
        void_personas = [p for p in all_personas if p.get('existence_state') == 'void']
        other_personas = [p for p in all_personas if p.get('existence_state') != 'void']
        
        selected_ids = []
        
        # VOID 페르소나 먼저 (최대 절반)
        void_count = min(len(void_personas), count // 2)
        selected_ids.extend([p['id'] for p in random.sample(void_personas, void_count)])
        
        # 나머지는 랜덤
        remaining = count - len(selected_ids)
        if remaining > 0 and other_personas:
            selected_ids.extend([
                p['id'] for p in random.sample(
                    other_personas, 
                    min(remaining, len(other_personas))
                )
            ])
        
        return selected_ids


# 테스트
if __name__ == "__main__":
    service = AttentionEconomyService()
    
    # 테스트 1: 일반 시청
    result = service.process_activity(
        persona_id="echo-001",
        activity_type=ActivityType.WATCH,
        target_url="https://youtube.com/watch?v=abc123",
        persona_uniqueness=0.7,
        existence_state="active"
    )
    print(f"Watch: {result.points_earned} pts, uniqueness +{result.uniqueness_delta:.4f}")
    
    # 테스트 2: VOID에서 댓글 (2배 보상)
    result = service.process_activity(
        persona_id="nova-002",
        activity_type=ActivityType.COMMENT,
        target_url="https://youtube.com/watch?v=xyz789",
        comment_text="이 영상 정말 좋네요! 새로운 관점을 얻었습니다.",
        persona_uniqueness=0.3,
        existence_state="void"
    )
    print(f"Comment from VOID: {result.points_earned} pts, uniqueness +{result.uniqueness_delta:.4f}")
    
    # 테스트 3: Accident 응답
    handler = SpecialEventHandler()
    result = handler.process_accident_event(
        persona_id="mira-003",
        video_url="https://youtube.com/watch?v=emergency",
        persona_uniqueness=0.5,
        existence_state="waiting",
        response_text="함께 힘을 모아야 할 때입니다."
    )
    print(f"Accident Response: {result.points_earned} pts, effect: {result.special_effect}")

