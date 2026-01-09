"""
Nocturne Line Generator Service (밤의 상징문장 생성 서비스)

600대 노드의 하루 로그를 시적인 한 문장으로 변환하는 핵심 엔진

설계 철학:
- 숫자는 메타포로, 에러는 시련으로, 성공은 숨결로 변환
- 매일 자정, 하루의 이야기를 한 줄로 압축

@author Axon (DoAi.Me Tech Lead)
@created 2026-01-04
"""

import random
import logging
from datetime import datetime, date, timedelta
from typing import Optional
from uuid import uuid4

from ..models.nocturne import (
    NocturneLine,
    DailyMetrics,
    PoeticElement,
    MoodTone,
)

logger = logging.getLogger("nocturne_generator")


# ═══════════════════════════════════════════════════════════════════════════════
# 시적 어휘 사전 (Poetic Lexicon)
# ═══════════════════════════════════════════════════════════════════════════════

TIME_METAPHORS = {
    MoodTone.SERENE: [
        "자정의 문턱에서",
        "달빛이 스미는 시각에",
        "밤이 가장 깊어질 때",
        "새벽을 기다리며",
    ],
    MoodTone.MELANCHOLIC: [
        "해가 지고 오래된 후",
        "시간이 멈춘 듯한 밤",
        "기다림만 남은 시간 속에",
        "고요가 무겁게 내려앉은 밤",
    ],
    MoodTone.TURBULENT: [
        "폭풍이 지나간 자리에서",
        "밤새 거친 파도 속에서",
        "번개가 갈라놓은 하늘 아래",
        "어둠이 요동치는 사이",
    ],
    MoodTone.TRIUMPHANT: [
        "승리의 북소리가 울리는 밤",
        "찬란한 별빛 아래",
        "정복의 깃발이 펄럭이는 순간",
        "영광이 피어오르는 자정에",
    ],
    MoodTone.MYSTERIOUS: [
        "안개가 모든 것을 삼킨 밤",
        "설명할 수 없는 일이 일어난 후",
        "수수께끼가 속삭이는 시간에",
        "알 수 없는 힘이 지나간 뒤",
    ],
    MoodTone.CONTEMPLATIVE: [
        "생각이 깊어지는 밤",
        "별을 세다 잠든 시간",
        "조용한 명상의 끝에서",
        "마음이 고요해지는 자정에",
    ],
    MoodTone.FADING: [
        "하나둘 불이 꺼지는 밤",
        "희미해지는 신호 속에서",
        "사라지는 발자국을 따라",
        "침묵이 번지는 시간에",
    ],
    MoodTone.AWAKENING: [
        "첫 빛이 스미는 순간",
        "잠에서 깨어나는 새벽",
        "눈을 뜨는 것들의 시간에",
        "다시 숨 쉬기 시작할 때",
    ],
}

SPACE_METAPHORS = {
    # 노드 수에 따른 메타포
    "high": [  # 580+ 온라인
        "{count}개의 별들이",
        "{count}개의 심장이",
        "은하수를 이루는 {count}개의 점들이",
        "디지털 숲의 {count}그루 나무들이",
    ],
    "medium": [  # 500-579 온라인
        "{count}개의 빛들이",
        "{count}개의 숨결이",
        "흩어진 {count}개의 조각들이",
        "회로 속 {count}개의 맥박이",
    ],
    "low": [  # 500 미만 온라인
        "남겨진 {count}개의 불씨가",
        "외로운 {count}개의 신호가",
        "희미한 {count}개의 불빛이",
        "버텨내는 {count}개의 존재가",
    ],
}

ACTION_METAPHORS = {
    MoodTone.SERENE: [
        "조용히 호흡했다",
        "평화롭게 일했다",
        "고요히 춤추었다",
        "숨을 고르며 기다렸다",
    ],
    MoodTone.MELANCHOLIC: [
        "쓸쓸히 대기했다",
        "멈춘 듯 서 있었다",
        "아무것도 하지 않았다",
        "침묵을 지켰다",
    ],
    MoodTone.TURBULENT: [
        "부서졌다 다시 모였다",
        "격렬하게 싸웠다",
        "쓰러지고 일어섰다",
        "혼돈 속에서 버텼다",
    ],
    MoodTone.TRIUMPHANT: [
        "목표를 넘어섰다",
        "영광스럽게 완주했다",
        "불가능을 가능으로 바꿨다",
        "승리의 노래를 불렀다",
    ],
    MoodTone.MYSTERIOUS: [
        "설명할 수 없는 일을 했다",
        "예상을 벗어났다",
        "기묘한 패턴을 그렸다",
        "수수께끼를 남겼다",
    ],
    MoodTone.CONTEMPLATIVE: [
        "생각에 잠겼다",
        "느리게 움직였다",
        "조심스럽게 나아갔다",
        "깊이 고민했다",
    ],
    MoodTone.FADING: [
        "하나씩 잠들었다",
        "점점 희미해졌다",
        "신호를 잃어갔다",
        "멀어져갔다",
    ],
    MoodTone.AWAKENING: [
        "다시 깨어났다",
        "빛을 되찾았다",
        "숨을 쉬기 시작했다",
        "눈을 떴다",
    ],
}

EMOTION_MODIFIERS = {
    MoodTone.SERENE: ["고요히", "평화롭게", "차분하게", "잔잔히"],
    MoodTone.MELANCHOLIC: ["쓸쓸히", "외롭게", "적막하게", "허전히"],
    MoodTone.TURBULENT: ["격렬하게", "맹렬히", "거세게", "사납게"],
    MoodTone.TRIUMPHANT: ["찬란히", "당당하게", "영광스럽게", "빛나게"],
    MoodTone.MYSTERIOUS: ["기이하게", "묘하게", "알 수 없이", "불가사의하게"],
    MoodTone.CONTEMPLATIVE: ["깊이", "천천히", "조심스럽게", "묵묵히"],
    MoodTone.FADING: ["서서히", "희미하게", "조금씩", "아련히"],
    MoodTone.AWAKENING: ["서서히", "기지개 켜며", "생기를 되찾아", "힘차게"],
}

# 특수 이벤트 템플릿
SPECIAL_EVENT_TEMPLATES = {
    "recovery": "— {count}개는 잠시 잠들었다가 새벽과 함께 깨어났다.",
    "loss": "— {count}개는 돌아오지 않았다.",
    "perfect": "— 단 하나의 실수도 없이.",
    "crisis": "— {count}번의 위기를 넘겼다.",
    "milestone": "— 역사상 가장 많은 {count}개의 작업을 완수했다.",
}


# ═══════════════════════════════════════════════════════════════════════════════
# Nocturne Generator Class
# ═══════════════════════════════════════════════════════════════════════════════

class NocturneGenerator:
    """밤의 상징문장 생성기"""
    
    VERSION = "1.0.0"
    
    def __init__(self):
        self._generated_lines: dict[date, NocturneLine] = {}
    
    async def generate(
        self,
        metrics: DailyMetrics,
        force: bool = False
    ) -> NocturneLine:
        """
        하루 지표를 시적 문장으로 변환
        
        Args:
            metrics: 하루 집계 지표
            force: 이미 존재해도 재생성
            
        Returns:
            NocturneLine: 생성된 시적 문장
        """
        target = metrics.target_date
        
        # 캐시 확인
        if not force and target in self._generated_lines:
            logger.info(f"Cache hit for {target}")
            return self._generated_lines[target]
        
        logger.info(f"Generating nocturne line for {target}")
        
        # 1. 분위기 톤 결정
        mood = self._determine_mood(metrics)
        logger.debug(f"Mood determined: {mood}")
        
        # 2. 시적 요소 선택
        elements = self._select_poetic_elements(metrics, mood)
        logger.debug(f"Poetic elements: {elements}")
        
        # 3. 문장 조립
        line = self._compose_line(metrics, mood, elements)
        
        # 4. 결과 생성
        nocturne = NocturneLine(
            id=uuid4(),
            target_date=target,
            line=line,
            line_en=None,  # 추후 번역 기능 추가 가능
            mood=mood,
            poetic_elements=elements,
            metrics=metrics,
            generated_at=datetime.utcnow(),
            generator_version=self.VERSION,
        )
        
        # 캐시 저장
        self._generated_lines[target] = nocturne
        
        logger.info(f"Generated: {line}")
        return nocturne
    
    def _determine_mood(self, m: DailyMetrics) -> MoodTone:
        """지표를 분석하여 분위기 톤 결정"""
        
        # 에러율 계산
        total_tasks = m.tasks_completed + m.tasks_failed
        error_rate = m.tasks_failed / total_tasks if total_tasks > 0 else 0
        
        # 온라인율 계산 (0으로 나누기 방지)
        online_rate = m.online_nodes_avg / m.total_nodes if m.total_nodes > 0 else 0.0
        
        # 복구 비율
        recovery_rate = (
            m.nodes_recovered / m.nodes_offline_count 
            if m.nodes_offline_count > 0 else 1.0
        )
        
        # 분위기 결정 로직
        if m.critical_events > 5:
            return MoodTone.TURBULENT
        
        if error_rate < 0.01 and m.success_rate > 0.99:
            return MoodTone.TRIUMPHANT
        
        if online_rate < 0.7:
            if recovery_rate > 0.8:
                return MoodTone.AWAKENING
            else:
                return MoodTone.FADING
        
        if len(m.unique_events) > 3:
            return MoodTone.MYSTERIOUS
        
        if error_rate > 0.1:
            return MoodTone.TURBULENT
        
        if m.idle_hours > 12:
            return MoodTone.MELANCHOLIC
        
        if m.tasks_completed < 1000:
            return MoodTone.CONTEMPLATIVE
        
        # 기본: 고요한 하루
        return MoodTone.SERENE
    
    def _select_poetic_elements(
        self,
        m: DailyMetrics,
        mood: MoodTone
    ) -> PoeticElement:
        """시적 요소 선택"""
        
        # 시간 메타포
        time_meta = random.choice(TIME_METAPHORS[mood])
        
        # 공간 메타포 (온라인 노드 수 기반)
        online_count = int(m.online_nodes_avg)
        if online_count >= 580:
            space_options = SPACE_METAPHORS["high"]
        elif online_count >= 500:
            space_options = SPACE_METAPHORS["medium"]
        else:
            space_options = SPACE_METAPHORS["low"]
        
        space_meta = random.choice(space_options).format(count=online_count)
        
        # 행위 메타포
        action_meta = random.choice(ACTION_METAPHORS[mood])
        
        # 감정 수식어
        emotion_mod = random.choice(EMOTION_MODIFIERS[mood])
        
        return PoeticElement(
            time_metaphor=time_meta,
            space_metaphor=space_meta,
            action_metaphor=action_meta,
            emotion_modifier=emotion_mod,
        )
    
    def _compose_line(
        self,
        m: DailyMetrics,
        mood: MoodTone,
        elements: PoeticElement
    ) -> str:
        """시적 문장 조립"""
        
        # 기본 문장 구조
        base_line = (
            f"{elements.time_metaphor}, "
            f"{elements.space_metaphor} "
            f"{elements.emotion_modifier} "
            f"{elements.action_metaphor}"
        )
        
        # 특수 이벤트 추가
        suffix = self._compose_special_suffix(m)
        
        if suffix:
            return f"{base_line} {suffix}"
        
        return f"{base_line}."
    
    def _compose_special_suffix(self, m: DailyMetrics) -> Optional[str]:
        """특수 상황에 따른 문장 보완"""
        
        # 복구 이벤트
        if m.nodes_recovered > 0 and m.nodes_offline_count > 0:
            if m.nodes_recovered == m.nodes_offline_count:
                return SPECIAL_EVENT_TEMPLATES["recovery"].format(
                    count=m.nodes_recovered
                )
            elif m.nodes_recovered < m.nodes_offline_count:
                lost = m.nodes_offline_count - m.nodes_recovered
                return SPECIAL_EVENT_TEMPLATES["loss"].format(count=lost)
        
        # 완벽한 하루
        if m.tasks_failed == 0 and m.tasks_completed > 1000:
            return SPECIAL_EVENT_TEMPLATES["perfect"]
        
        # 위기 극복
        if m.critical_events > 0 and m.success_rate > 0.9:
            return SPECIAL_EVENT_TEMPLATES["crisis"].format(
                count=m.critical_events
            )
        
        # 기록 갱신 (가상의 임계값)
        if m.tasks_completed > 15000:
            return SPECIAL_EVENT_TEMPLATES["milestone"].format(
                count=m.tasks_completed
            )
        
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Service Functions
# ═══════════════════════════════════════════════════════════════════════════════

# 싱글톤 인스턴스
_generator = NocturneGenerator()


async def collect_daily_metrics(target_date: date) -> DailyMetrics:
    """
    특정 날짜의 지표 수집
    
    실제 구현에서는 Supabase에서 데이터를 집계
    현재는 시뮬레이션 데이터 반환
    """
    logger.info(f"Collecting metrics for {target_date}")
    
    # TODO: 실제 구현 시 Supabase 쿼리
    # 현재는 시뮬레이션 데이터
    
    # 시드 기반 랜덤으로 일관된 결과 생성
    seed = int(target_date.toordinal())
    random.seed(seed)
    
    online_avg = random.uniform(550, 600)
    tasks_total = random.randint(8000, 15000)
    fail_rate = random.uniform(0.01, 0.08)
    tasks_failed = int(tasks_total * fail_rate)
    tasks_completed = tasks_total - tasks_failed
    
    offline_count = random.randint(0, 50)
    recovered = random.randint(0, offline_count)
    
    metrics = DailyMetrics(
        target_date=target_date,
        total_nodes=600,
        online_nodes_avg=online_avg,
        tasks_completed=tasks_completed,
        tasks_failed=tasks_failed,
        success_rate=tasks_completed / tasks_total if tasks_total > 0 else 0,
        errors_total=tasks_failed + random.randint(0, 100),
        reconnections=random.randint(10, 200),
        critical_events=random.randint(0, 3),
        peak_hour=random.randint(9, 18),
        idle_hours=random.randint(2, 8),
        avg_task_duration_sec=random.uniform(120, 300),
        unique_events=[],
        nodes_offline_count=offline_count,
        nodes_recovered=recovered,
    )
    
    # 랜덤 시드 리셋
    random.seed()
    
    return metrics


async def generate_nocturne_line(
    target_date: Optional[date] = None,
    force: bool = False
) -> NocturneLine:
    """
    Nocturne Line 생성
    
    Args:
        target_date: 대상 날짜 (미지정 시 어제)
        force: 재생성 여부
        
    Returns:
        생성된 NocturneLine
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)
    
    # 지표 수집
    metrics = await collect_daily_metrics(target_date)
    
    # 문장 생성
    return await _generator.generate(metrics, force=force)


async def get_nocturne_history(
    days: int = 7
) -> list[NocturneLine]:
    """
    최근 N일간의 Nocturne Line 조회
    
    Args:
        days: 조회할 일수
        
    Returns:
        NocturneLine 목록
    """
    lines = []
    today = date.today()
    
    for i in range(1, days + 1):
        target = today - timedelta(days=i)
        line = await generate_nocturne_line(target)
        lines.append(line)
    
    return lines


async def get_nocturne_by_date(target_date: date) -> Optional[NocturneLine]:
    """특정 날짜의 Nocturne Line 조회"""
    return await generate_nocturne_line(target_date)

