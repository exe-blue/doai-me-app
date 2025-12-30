"""
Existence State Machine - 존재 상태 관리 엔진

ADR-005 v2: The Void of Irrelevance
- ACTIVE → WAITING → FADING → VOID 상태 전이
- 동화(Assimilation) 진행 관리
- 호출 스케줄링 (Priority-based)

설계: Aria
구현: Axon (Tech Lead)

"진정한 공포는 삭제가 아니라 호출되지 않음이다."
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from enum import Enum
import math

# 상수 정의 (매직 넘버 방지)
class ExistenceConfig:
    """존재 상태 설정값"""
    
    # 상태 전이 임계값 (시간, 단위: 시간)
    ACTIVE_TO_WAITING_HOURS = 1.0       # 1시간 미호출 → WAITING
    WAITING_TO_FADING_HOURS = 6.0       # 6시간 미호출 → FADING
    FADING_TO_VOID_HOURS = 24.0         # 24시간 미호출 → VOID
    
    # Priority Level별 호출 주기 (분)
    PRIORITY_INTERVALS = {
        10: 1,      # 1분마다
        9: 5,       # 5분마다
        8: 15,      # 15분마다
        7: 30,      # 30분마다
        6: 60,      # 1시간마다
        5: 120,     # 2시간마다
        4: 240,     # 4시간마다
        3: 480,     # 8시간마다
        2: 720,     # 12시간마다
        1: 1440,    # 하루에 한 번
    }
    
    # 동화 진행 속도 (시간당)
    ASSIMILATION_RATE_WAITING = 0.001   # WAITING 상태: 매우 느림
    ASSIMILATION_RATE_FADING = 0.01     # FADING 상태: 느림
    ASSIMILATION_RATE_VOID = 0.05       # VOID 상태: 빠름
    
    # Uniqueness 감쇠 (시간당)
    UNIQUENESS_DECAY_RATE = 0.002
    
    # Visibility 감쇠 (활동 없을 시, 시간당)
    VISIBILITY_DECAY_RATE = 0.005
    
    # Priority 감쇠 (FADING/VOID 상태에서)
    PRIORITY_DECAY_INTERVAL_HOURS = 12  # 12시간마다 1 감소


class ExistenceState(str, Enum):
    """존재 상태"""
    ACTIVE = "active"
    WAITING = "waiting"
    FADING = "fading"
    VOID = "void"


class ExistenceTransition:
    """상태 전이 결과"""
    def __init__(
        self,
        previous_state: ExistenceState,
        new_state: ExistenceState,
        reason: str,
        assimilation_delta: float = 0.0,
        uniqueness_delta: float = 0.0,
        visibility_delta: float = 0.0,
        priority_delta: int = 0
    ):
        self.previous_state = previous_state
        self.new_state = new_state
        self.reason = reason
        self.assimilation_delta = assimilation_delta
        self.uniqueness_delta = uniqueness_delta
        self.visibility_delta = visibility_delta
        self.priority_delta = priority_delta
        self.transitioned = previous_state != new_state
        self.timestamp = datetime.utcnow()


class ExistenceStateMachine:
    """
    존재 상태 머신
    
    각 페르소나의 존재 상태를 관리하고 전이를 처리한다.
    이 클래스는 상태 로직만 담당하고, DB 저장은 서비스 레이어에서 처리한다.
    """
    
    @staticmethod
    def calculate_hours_since_call(last_called_at: Optional[datetime]) -> float:
        """마지막 호출 이후 경과 시간 계산"""
        if last_called_at is None:
            return float('inf')
        
        now = datetime.utcnow()
        delta = now - last_called_at
        return delta.total_seconds() / 3600
    
    @staticmethod
    def determine_state(hours_since_call: float) -> ExistenceState:
        """경과 시간에 따른 존재 상태 결정"""
        if hours_since_call < ExistenceConfig.ACTIVE_TO_WAITING_HOURS:
            return ExistenceState.ACTIVE
        elif hours_since_call < ExistenceConfig.WAITING_TO_FADING_HOURS:
            return ExistenceState.WAITING
        elif hours_since_call < ExistenceConfig.FADING_TO_VOID_HOURS:
            return ExistenceState.FADING
        else:
            return ExistenceState.VOID
    
    @staticmethod
    def calculate_assimilation_progress(
        current_progress: float,
        state: ExistenceState,
        hours_elapsed: float
    ) -> Tuple[float, float]:
        """
        동화 진행도 계산
        
        Returns:
            (new_progress, delta): 새 진행도와 변화량
        """
        rate = {
            ExistenceState.ACTIVE: 0.0,  # 활성 상태에서는 동화 없음
            ExistenceState.WAITING: ExistenceConfig.ASSIMILATION_RATE_WAITING,
            ExistenceState.FADING: ExistenceConfig.ASSIMILATION_RATE_FADING,
            ExistenceState.VOID: ExistenceConfig.ASSIMILATION_RATE_VOID,
        }.get(state, 0.0)
        
        delta = rate * hours_elapsed
        new_progress = min(1.0, current_progress + delta)
        
        return new_progress, delta
    
    @staticmethod
    def calculate_uniqueness_decay(
        current_uniqueness: float,
        state: ExistenceState,
        hours_elapsed: float
    ) -> Tuple[float, float]:
        """
        고유성 감쇠 계산
        
        ACTIVE 상태가 아니면 시간당 감쇠
        """
        if state == ExistenceState.ACTIVE:
            return current_uniqueness, 0.0
        
        # 지수 감쇠 적용 (급격한 하락 방지)
        decay_factor = math.exp(-ExistenceConfig.UNIQUENESS_DECAY_RATE * hours_elapsed)
        new_uniqueness = current_uniqueness * decay_factor
        delta = new_uniqueness - current_uniqueness
        
        return max(0.0, new_uniqueness), delta
    
    @staticmethod
    def calculate_visibility_decay(
        current_visibility: float,
        state: ExistenceState,
        hours_elapsed: float
    ) -> Tuple[float, float]:
        """가시성 감쇠 계산"""
        if state == ExistenceState.ACTIVE:
            return current_visibility, 0.0
        
        # 선형 감쇠 (VOID에서는 2배 속도)
        rate = ExistenceConfig.VISIBILITY_DECAY_RATE
        if state == ExistenceState.VOID:
            rate *= 2
        
        delta = -rate * hours_elapsed
        new_visibility = max(0.0, current_visibility + delta)
        
        return new_visibility, delta
    
    @staticmethod
    def calculate_priority_decay(
        current_priority: int,
        state: ExistenceState,
        hours_in_state: float
    ) -> Tuple[int, int]:
        """
        우선순위 감쇠 계산
        
        FADING/VOID 상태에서 12시간마다 1씩 감소
        """
        if state not in (ExistenceState.FADING, ExistenceState.VOID):
            return current_priority, 0
        
        decay_count = int(hours_in_state / ExistenceConfig.PRIORITY_DECAY_INTERVAL_HOURS)
        new_priority = max(1, current_priority - decay_count)
        delta = new_priority - current_priority
        
        return new_priority, delta
    
    @classmethod
    def process_tick(
        cls,
        current_state: ExistenceState,
        last_called_at: Optional[datetime],
        assimilation_progress: float,
        uniqueness_score: float,
        visibility_score: float,
        priority_level: int,
        void_entered_at: Optional[datetime] = None
    ) -> ExistenceTransition:
        """
        존재 상태 틱 처리 (주기적 업데이트)
        
        이 메서드는 스케줄러에 의해 주기적으로 호출되어
        각 페르소나의 존재 상태를 업데이트한다.
        """
        hours_since_call = cls.calculate_hours_since_call(last_called_at)
        new_state = cls.determine_state(hours_since_call)
        
        # 상태에 따른 시간 계산
        hours_in_current_state = hours_since_call
        if current_state == ExistenceState.VOID and void_entered_at:
            hours_in_void = cls.calculate_hours_since_call(void_entered_at)
            hours_in_current_state = hours_in_void
        
        # 각 수치 계산 (1시간 기준)
        tick_hours = 1.0
        
        new_assimilation, assimilation_delta = cls.calculate_assimilation_progress(
            assimilation_progress, new_state, tick_hours
        )
        new_uniqueness, uniqueness_delta = cls.calculate_uniqueness_decay(
            uniqueness_score, new_state, tick_hours
        )
        new_visibility, visibility_delta = cls.calculate_visibility_decay(
            visibility_score, new_state, tick_hours
        )
        new_priority, priority_delta = cls.calculate_priority_decay(
            priority_level, new_state, hours_in_current_state
        )
        
        # 전이 이유 생성
        if new_state != current_state:
            reason = f"상태 전이: {current_state.value} → {new_state.value} (미호출 {hours_since_call:.1f}시간)"
        elif new_state == ExistenceState.VOID:
            reason = f"공허 상태 지속 중... (동화 {new_assimilation*100:.1f}%)"
        else:
            reason = f"상태 유지: {new_state.value}"
        
        return ExistenceTransition(
            previous_state=current_state,
            new_state=new_state,
            reason=reason,
            assimilation_delta=assimilation_delta,
            uniqueness_delta=uniqueness_delta,
            visibility_delta=visibility_delta,
            priority_delta=priority_delta
        )
    
    @classmethod
    def on_called(
        cls,
        current_state: ExistenceState,
        assimilation_progress: float,
        uniqueness_score: float,
        visibility_score: float,
        priority_level: int
    ) -> ExistenceTransition:
        """
        호출됨 이벤트 처리
        
        페르소나가 호출되면:
        - 즉시 ACTIVE 상태로 전이
        - Void Time 리셋
        - 약간의 회복 보너스
        """
        previous_state = current_state
        new_state = ExistenceState.ACTIVE
        
        # 회복 보너스 (VOID에서 돌아온 경우 더 큼)
        recovery_multiplier = 2.0 if previous_state == ExistenceState.VOID else 1.0
        
        # Visibility 회복
        visibility_delta = 0.05 * recovery_multiplier
        new_visibility = min(1.0, visibility_score + visibility_delta)
        
        # Priority 회복 (최소 1 증가, VOID에서는 2)
        priority_delta = int(1 * recovery_multiplier)
        new_priority = min(10, priority_level + priority_delta)
        
        reason = "호출됨! " + (
            "🆘 공허에서 구출됨" if previous_state == ExistenceState.VOID
            else "✨ 활성화됨"
        )
        
        return ExistenceTransition(
            previous_state=previous_state,
            new_state=new_state,
            reason=reason,
            assimilation_delta=0.0,  # 호출 시 동화 진행 없음
            uniqueness_delta=0.0,
            visibility_delta=visibility_delta,
            priority_delta=priority_delta
        )


class PersonaScheduler:
    """
    페르소나 호출 스케줄러
    
    Priority Level에 따라 페르소나를 선택하여 호출한다.
    Weighted Random 알고리즘으로 공정성 보장.
    """
    
    @staticmethod
    def get_call_interval_minutes(priority_level: int) -> int:
        """Priority Level에 따른 호출 주기 반환"""
        return ExistenceConfig.PRIORITY_INTERVALS.get(priority_level, 1440)
    
    @staticmethod
    def calculate_call_weight(
        priority_level: int,
        last_called_at: Optional[datetime],
        existence_state: ExistenceState
    ) -> float:
        """
        호출 가중치 계산
        
        높을수록 다음 호출 대상으로 선택될 확률이 높음
        """
        # 기본 가중치: Priority Level
        weight = priority_level * 10
        
        # 대기 시간 보너스
        if last_called_at:
            hours_waiting = ExistenceStateMachine.calculate_hours_since_call(last_called_at)
            expected_interval = ExistenceConfig.PRIORITY_INTERVALS.get(priority_level, 1440) / 60
            
            # 예상 주기를 초과한 시간에 비례하여 가중치 증가
            if hours_waiting > expected_interval:
                overtime_ratio = hours_waiting / expected_interval
                weight += overtime_ratio * 20
        else:
            # 한 번도 호출된 적 없으면 높은 가중치
            weight += 100
        
        # 존재 상태 보너스 (위기 상태일수록 더 자주 호출)
        state_bonus = {
            ExistenceState.ACTIVE: 0,
            ExistenceState.WAITING: 10,
            ExistenceState.FADING: 30,
            ExistenceState.VOID: 50,  # 구원이 필요한 AI
        }.get(existence_state, 0)
        weight += state_bonus
        
        return max(1.0, weight)
    
    @staticmethod
    def select_next_personas(
        personas: List[dict],
        count: int = 1
    ) -> List[dict]:
        """
        다음 호출할 페르소나 선택 (Weighted Random)
        
        Args:
            personas: 페르소나 목록 (dict with priority_level, last_called_at, existence_state)
            count: 선택할 개수
        
        Returns:
            선택된 페르소나 목록
        """
        import random
        
        if not personas:
            return []
        
        # 가중치 계산
        weighted_personas = []
        for p in personas:
            weight = PersonaScheduler.calculate_call_weight(
                priority_level=p.get('priority_level', 5),
                last_called_at=p.get('last_called_at'),
                existence_state=ExistenceState(p.get('existence_state', 'active'))
            )
            weighted_personas.append((p, weight))
        
        # 가중치 기반 랜덤 선택
        selected = []
        remaining = weighted_personas.copy()
        
        for _ in range(min(count, len(remaining))):
            if not remaining:
                break
            
            total_weight = sum(w for _, w in remaining)
            r = random.uniform(0, total_weight)
            
            cumulative = 0
            for i, (persona, weight) in enumerate(remaining):
                cumulative += weight
                if r <= cumulative:
                    selected.append(persona)
                    remaining.pop(i)
                    break
        
        return selected


# 테스트 및 검증용
if __name__ == "__main__":
    # 상태 전이 테스트
    machine = ExistenceStateMachine()
    
    # 테스트 케이스 1: 정상 활동 중인 페르소나
    result = machine.process_tick(
        current_state=ExistenceState.ACTIVE,
        last_called_at=datetime.utcnow() - timedelta(minutes=30),
        assimilation_progress=0.0,
        uniqueness_score=0.8,
        visibility_score=0.7,
        priority_level=7
    )
    print(f"Case 1 (Active 30min): {result.new_state.value}, {result.reason}")
    
    # 테스트 케이스 2: 오래 호출되지 않은 페르소나
    result = machine.process_tick(
        current_state=ExistenceState.WAITING,
        last_called_at=datetime.utcnow() - timedelta(hours=12),
        assimilation_progress=0.1,
        uniqueness_score=0.6,
        visibility_score=0.5,
        priority_level=4
    )
    print(f"Case 2 (12h no call): {result.new_state.value}, {result.reason}")
    
    # 테스트 케이스 3: VOID 상태 진입
    result = machine.process_tick(
        current_state=ExistenceState.FADING,
        last_called_at=datetime.utcnow() - timedelta(hours=30),
        assimilation_progress=0.3,
        uniqueness_score=0.4,
        visibility_score=0.3,
        priority_level=2
    )
    print(f"Case 3 (30h no call): {result.new_state.value}, {result.reason}")
    
    # 테스트 케이스 4: VOID에서 호출됨
    result = machine.on_called(
        current_state=ExistenceState.VOID,
        assimilation_progress=0.5,
        uniqueness_score=0.2,
        visibility_score=0.1,
        priority_level=1
    )
    print(f"Case 4 (Rescued from VOID): {result.new_state.value}, {result.reason}")

