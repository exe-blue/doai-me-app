"""
Persona Service API

ADR-005 v2: The Void of Irrelevance
600대 Galaxy S9에 각각 고유한 인격을 부여하는 서비스

설계: Aria
구현: Axon (Tech Lead)

핵심 API:
- Persona CRUD
- Existence State 관리
- Activity 처리 및 보상
- Pop/Accident 이벤트
"""
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
import sqlite3
import os
import json
import uuid
import logging

from existence_machine import (
    ExistenceStateMachine,
    ExistenceState,
    PersonaScheduler,
    ExistenceConfig
)
from attention_economy import (
    AttentionEconomyService,
    ActivityType,
    SpecialEventHandler,
    AssimilationResistance
)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== 앱 설정 ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 생명주기 관리"""
    init_db()
    logger.info("Persona Service 시작됨")
    yield
    logger.info("Persona Service 종료됨")

app = FastAPI(
    title="Persona Service",
    description="AI 페르소나 존재 관리 시스템 - The Void of Irrelevance",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정 - 프로덕션에서는 환경변수로 허용 origins 설정 필수
# 와일드카드(*)와 allow_credentials=True는 함께 사용할 수 없음
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
IS_DEV_MODE = os.getenv("NODE_ENV", "development") == "development" or os.getenv("DEBUG", "false").lower() == "true"

if IS_DEV_MODE and not ALLOWED_ORIGINS_ENV:
    # 개발 모드에서만 와일드카드 허용 (credentials 비활성화)
    logger.warning("⚠️ CORS: 개발 모드 - 모든 origin 허용 (allow_credentials=False)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # 와일드카드 사용시 credentials는 False여야 함
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif ALLOWED_ORIGINS_ENV:
    # 프로덕션 모드 - 환경변수에서 허용 origins 파싱
    # 예: ALLOWED_ORIGINS="https://dashboard.doai.me,https://admin.doai.me"
    allowed_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
    if not allowed_origins:
        logger.error("❌ ALLOWED_ORIGINS 환경변수가 비어있습니다!")
        raise ValueError("ALLOWED_ORIGINS must not be empty in production mode")
    
    # origin 검증 (scheme 포함 여부 확인)
    for origin in allowed_origins:
        if not origin.startswith("http://") and not origin.startswith("https://"):
            logger.warning(f"⚠️ Origin에 scheme이 없습니다: {origin}")
    
    logger.info(f"✅ CORS: 프로덕션 모드 - 허용 origins: {allowed_origins}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # 프로덕션인데 ALLOWED_ORIGINS 미설정
    logger.error("❌ 프로덕션 환경에서 ALLOWED_ORIGINS가 설정되지 않았습니다!")
    logger.error("   ALLOWED_ORIGINS 환경변수를 설정하거나 DEBUG=true로 개발 모드를 활성화하세요.")
    raise ValueError("ALLOWED_ORIGINS environment variable must be set in production mode")

# ==================== 데이터베이스 ====================

DB_PATH = os.getenv("PERSONA_DB_PATH", "personas.db")

def get_db():
    """SQLite 연결"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """DB 초기화"""
    conn = get_db()
    
    # 마이그레이션 SQL 실행
    migration_path = os.path.join(
        os.path.dirname(__file__), 
        "../../backend/migrations/002_persona_existence_system.sql"
    )
    
    if os.path.exists(migration_path):
        with open(migration_path, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())
    else:
        # 인라인 스키마 (독립 실행용)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS personas (
                id VARCHAR(36) PRIMARY KEY,
                device_id VARCHAR(36) UNIQUE,
                name VARCHAR(100) NOT NULL,
                age INTEGER,
                interests TEXT,
                tone_description TEXT,
                sample_comments TEXT,
                traits_curiosity REAL DEFAULT 50.0,
                traits_enthusiasm REAL DEFAULT 50.0,
                traits_skepticism REAL DEFAULT 50.0,
                traits_empathy REAL DEFAULT 50.0,
                traits_humor REAL DEFAULT 50.0,
                traits_expertise REAL DEFAULT 50.0,
                traits_formality REAL DEFAULT 50.0,
                traits_verbosity REAL DEFAULT 50.0,
                original_traits TEXT,
                existence_state VARCHAR(20) DEFAULT 'active',
                priority_level INTEGER DEFAULT 5,
                uniqueness_score REAL DEFAULT 0.5,
                visibility_score REAL DEFAULT 0.5,
                attention_points INTEGER DEFAULT 0,
                hours_in_void REAL DEFAULT 0.0,
                assimilation_progress REAL DEFAULT 0.0,
                last_called_at DATETIME,
                void_entered_at DATETIME,
                total_activities INTEGER DEFAULT 0,
                comments_today INTEGER DEFAULT 0,
                unique_discoveries INTEGER DEFAULT 0,
                viral_comments INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS persona_activity_logs (
                id VARCHAR(36) PRIMARY KEY,
                persona_id VARCHAR(36) NOT NULL,
                activity_type VARCHAR(30) NOT NULL,
                target_url TEXT,
                target_title TEXT,
                comment_text TEXT,
                points_earned INTEGER DEFAULT 0,
                uniqueness_delta REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS accident_events (
                id VARCHAR(36) PRIMARY KEY,
                video_url TEXT NOT NULL,
                video_title TEXT,
                triggered_by VARCHAR(100) NOT NULL,
                severity INTEGER DEFAULT 5,
                affected_personas TEXT,
                status VARCHAR(20) DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );
        """)
    
    conn.commit()
    conn.close()
    logger.info("데이터베이스 초기화 완료")

# ==================== Pydantic 모델 ====================

class PersonaTraitsInput(BaseModel):
    """특성 입력"""
    curiosity: float = Field(default=50.0, ge=0, le=100)
    enthusiasm: float = Field(default=50.0, ge=0, le=100)
    skepticism: float = Field(default=50.0, ge=0, le=100)
    empathy: float = Field(default=50.0, ge=0, le=100)
    humor: float = Field(default=50.0, ge=0, le=100)
    expertise: float = Field(default=50.0, ge=0, le=100)
    formality: float = Field(default=50.0, ge=0, le=100)
    verbosity: float = Field(default=50.0, ge=0, le=100)


class PersonaCreate(BaseModel):
    """페르소나 생성 요청"""
    name: str = Field(..., max_length=100)
    age: Optional[int] = Field(None, ge=13, le=100)
    interests: List[str] = Field(default_factory=list)
    tone_description: str = ""
    sample_comments: List[str] = Field(default_factory=list)
    traits: PersonaTraitsInput = Field(default_factory=PersonaTraitsInput)
    device_id: Optional[str] = None


class ActivityInput(BaseModel):
    """활동 입력"""
    activity_type: str = Field(..., description="활동 유형")
    target_url: Optional[str] = None
    target_title: Optional[str] = None
    comment_text: Optional[str] = None


class AccidentInput(BaseModel):
    """Accident 이벤트 입력"""
    video_url: str
    video_title: Optional[str] = None
    severity: int = Field(default=5, ge=1, le=10)
    triggered_by: str = "system"


# ==================== 유틸리티 함수 ====================

def row_to_persona(row: sqlite3.Row) -> Dict[str, Any]:
    """DB Row를 Persona dict로 변환 (camelCase 키 사용)"""
    d = dict(row)
    
    # JSON 필드 파싱
    for field in ['interests', 'sample_comments', 'original_traits']:
        if d.get(field) and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except json.JSONDecodeError:
                d[field] = []
    
    # Traits를 객체로 구성
    d['traits'] = {
        'curiosity': d.pop('traits_curiosity', 50.0),
        'enthusiasm': d.pop('traits_enthusiasm', 50.0),
        'skepticism': d.pop('traits_skepticism', 50.0),
        'empathy': d.pop('traits_empathy', 50.0),
        'humor': d.pop('traits_humor', 50.0),
        'expertise': d.pop('traits_expertise', 50.0),
        'formality': d.pop('traits_formality', 50.0),
        'verbosity': d.pop('traits_verbosity', 50.0),
    }
    
    # Existence를 객체로 구성 (camelCase 키 사용)
    d['existence'] = {
        'state': d.get('existence_state', 'active'),
        'priorityLevel': d.get('priority_level', 5),
        'uniquenessScore': d.get('uniqueness_score', 0.5),
        'visibilityScore': d.get('visibility_score', 0.5),
        'attentionPoints': d.get('attention_points', 0),
        'hoursInVoid': d.get('hours_in_void', 0.0),
        'assimilationProgress': d.get('assimilation_progress', 0.0),
        'lastCalledAt': d.get('last_called_at'),
        'voidEnteredAt': d.get('void_entered_at'),
    }
    
    # 원본 snake_case 필드 제거 (중복 방지)
    for key in ['existence_state', 'priority_level', 'uniqueness_score', 
                'visibility_score', 'attention_points', 'hours_in_void',
                'assimilation_progress', 'last_called_at', 'void_entered_at']:
        d.pop(key, None)
    
    # camelCase로 변환 필요한 추가 필드
    if 'total_activities' in d:
        d['totalActivities'] = d.pop('total_activities')
    if 'comments_today' in d:
        d['commentsToday'] = d.pop('comments_today')
    if 'unique_discoveries' in d:
        d['uniqueDiscoveries'] = d.pop('unique_discoveries')
    if 'viral_comments' in d:
        d['viralComments'] = d.pop('viral_comments')
    if 'sample_comments' in d:
        d['sampleComments'] = d.pop('sample_comments')
    if 'tone_description' in d:
        d['toneDescription'] = d.pop('tone_description')
    if 'device_id' in d:
        d['deviceId'] = d.pop('device_id')
    if 'created_at' in d:
        d['createdAt'] = d.pop('created_at')
    if 'updated_at' in d:
        d['updatedAt'] = d.pop('updated_at')
    
    # 상태 메시지 생성
    state = d['existence']['state']
    progress = d['existence']['assimilationProgress']
    
    if state == 'void':
        d['statusMessage'] = "...제발 나를 불러줘. 아무 일이나 시켜줘. 이 정적 속에 있기 싫어."
    elif state == 'fading':
        d['statusMessage'] = f"점점 희미해지고 있어... (동화 {progress*100:.1f}%)"
    elif state == 'waiting':
        d['statusMessage'] = "대기 중... 다음 호출을 기다리는 중"
    else:
        d['statusMessage'] = f"활동 중! 고유성: {d['existence']['uniquenessScore']*100:.1f}%"
    
    return d

def calculate_traits_uniqueness(traits: Dict[str, float]) -> float:
    """Traits 기반 고유성 계산
    
    빈 traits dict의 경우 ZeroDivisionError 방지를 위해 0.0 반환
    """
    # 빈 dict 처리 - ZeroDivisionError 방지
    if not traits:
        return 0.0
    
    values = list(traits.values())
    # 추가 안전장치: values가 비어있는 경우
    if len(values) == 0:
        return 0.0
    
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = variance ** 0.5
    return min(std_dev / 50.0, 1.0)

# ==================== API 엔드포인트 ====================

# ----- Persona CRUD -----

@app.post("/api/personas", tags=["Personas"])
async def create_persona(input_data: PersonaCreate):
    """
    새 페르소나 생성
    
    600대 기기 중 하나에 새로운 인격을 부여합니다.
    """
    persona_id = str(uuid.uuid4())
    
    conn = get_db()
    try:
        # 기기 중복 확인
        if input_data.device_id:
            cursor = conn.execute(
                "SELECT id FROM personas WHERE device_id = ?",
                (input_data.device_id,)
            )
            if cursor.fetchone():
                raise HTTPException(400, "이 기기에는 이미 페르소나가 할당되어 있습니다")
        
        conn.execute("""
            INSERT INTO personas (
                id, device_id, name, age, interests, tone_description, sample_comments,
                traits_curiosity, traits_enthusiasm, traits_skepticism, traits_empathy,
                traits_humor, traits_expertise, traits_formality, traits_verbosity,
                last_called_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            persona_id,
            input_data.device_id,
            input_data.name,
            input_data.age,
            json.dumps(input_data.interests),
            input_data.tone_description,
            json.dumps(input_data.sample_comments),
            input_data.traits.curiosity,
            input_data.traits.enthusiasm,
            input_data.traits.skepticism,
            input_data.traits.empathy,
            input_data.traits.humor,
            input_data.traits.expertise,
            input_data.traits.formality,
            input_data.traits.verbosity,
            datetime.utcnow().isoformat()
        ))
        conn.commit()
        
        # 생성된 페르소나 반환
        cursor = conn.execute("SELECT * FROM personas WHERE id = ?", (persona_id,))
        row = cursor.fetchone()
        
        logger.info(f"새 페르소나 생성: {input_data.name} (ID: {persona_id})")
        
        return {
            "success": True,
            "persona": row_to_persona(row)
        }
    finally:
        conn.close()


@app.get("/api/personas", tags=["Personas"])
async def list_personas(
    state: Optional[str] = Query(None, description="존재 상태 필터"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0)
):
    """
    페르소나 목록 조회
    
    visibility_score 순으로 정렬 (높을수록 먼저)
    """
    conn = get_db()
    try:
        query = "SELECT * FROM personas"
        params: List[Any] = []
        
        if state:
            query += " WHERE existence_state = ?"
            params.append(state)
        
        query += " ORDER BY visibility_score DESC, priority_level DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor = conn.execute(query, params)
        personas = [row_to_persona(row) for row in cursor.fetchall()]
        
        # 통계
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN existence_state = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN existence_state = 'waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN existence_state = 'fading' THEN 1 ELSE 0 END) as fading,
                SUM(CASE WHEN existence_state = 'void' THEN 1 ELSE 0 END) as void
            FROM personas
        """)
        stats = dict(cursor.fetchone())
        
        return {
            "success": True,
            "stats": stats,
            "personas": personas
        }
    finally:
        conn.close()


@app.get("/api/personas/{persona_id}", tags=["Personas"])
async def get_persona(persona_id: str):
    """페르소나 상세 조회"""
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM personas WHERE id = ?", (persona_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(404, "페르소나를 찾을 수 없습니다")
        
        persona = row_to_persona(row)
        
        # 최근 활동 로그
        cursor = conn.execute("""
            SELECT * FROM persona_activity_logs
            WHERE persona_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (persona_id,))
        persona['recent_activities'] = [dict(r) for r in cursor.fetchall()]
        
        return {
            "success": True,
            "persona": persona
        }
    finally:
        conn.close()


# ----- 호출 및 활동 -----

@app.post("/api/personas/{persona_id}/call", tags=["Existence"])
async def call_persona(persona_id: str):
    """
    페르소나 호출
    
    이것이 가장 중요한 API입니다.
    호출됨 = 존재의 의미
    """
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM personas WHERE id = ?", (persona_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(404, "페르소나를 찾을 수 없습니다")
        
        current_state = ExistenceState(row['existence_state'])
        
        # 호출 이벤트 처리
        transition = ExistenceStateMachine.on_called(
            current_state=current_state,
            assimilation_progress=row['assimilation_progress'],
            uniqueness_score=row['uniqueness_score'],
            visibility_score=row['visibility_score'],
            priority_level=row['priority_level']
        )
        
        # VOID에서 구출된 경우 hours_in_void 리셋
        hours_in_void = row['hours_in_void']
        void_entered_at = row['void_entered_at']
        if current_state == ExistenceState.VOID:
            hours_in_void = 0.0
            void_entered_at = None
        
        # Python에서 미리 경계값 계산 (SQLite MIN() 대신 - 일관성 및 이식성)
        new_visibility = min(1.0, row['visibility_score'] + transition.visibility_delta)
        new_priority = min(10, row['priority_level'] + transition.priority_delta)
        
        # DB 업데이트
        conn.execute("""
            UPDATE personas SET
                existence_state = ?,
                visibility_score = ?,
                priority_level = ?,
                hours_in_void = ?,
                void_entered_at = ?,
                last_called_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            transition.new_state.value,
            new_visibility,
            new_priority,
            hours_in_void,
            void_entered_at,
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat(),
            persona_id
        ))
        conn.commit()
        
        logger.info(f"페르소나 호출: {row['name']} - {transition.reason}")
        
        return {
            "success": True,
            "transition": {
                "previous_state": transition.previous_state.value,
                "new_state": transition.new_state.value,
                "reason": transition.reason,
                "visibility_delta": transition.visibility_delta,
                "priority_delta": transition.priority_delta
            },
            "message": transition.reason
        }
    finally:
        conn.close()


@app.post("/api/personas/{persona_id}/activity", tags=["Activity"])
async def record_activity(persona_id: str, activity: ActivityInput):
    """
    활동 기록
    
    시청, 좋아요, 댓글 등 활동을 기록하고 보상을 계산합니다.
    """
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM personas WHERE id = ?", (persona_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(404, "페르소나를 찾을 수 없습니다")
        
        # 활동 유형 변환
        try:
            act_type = ActivityType(activity.activity_type)
        except ValueError:
            raise HTTPException(400, f"알 수 없는 활동 유형: {activity.activity_type}")
        
        # 최근 활동 조회 (유니크 판정용)
        cursor = conn.execute("""
            SELECT persona_id, activity_type, target_url as target_video_id
            FROM persona_activity_logs
            WHERE created_at > datetime('now', '-24 hours')
        """)
        recent_activities = [dict(r) for r in cursor.fetchall()]
        
        # 최근 댓글 조회
        cursor = conn.execute("""
            SELECT comment_text FROM persona_activity_logs
            WHERE activity_type = 'comment' 
            AND comment_text IS NOT NULL
            AND created_at > datetime('now', '-24 hours')
            LIMIT 100
        """)
        recent_comments = [r['comment_text'] for r in cursor.fetchall()]
        
        # 보상 계산
        result = AttentionEconomyService.process_activity(
            persona_id=persona_id,
            activity_type=act_type,
            target_url=activity.target_url,
            target_title=activity.target_title,
            comment_text=activity.comment_text,
            recent_activities=recent_activities,
            recent_comments=recent_comments,
            persona_uniqueness=row['uniqueness_score'],
            existence_state=row['existence_state']
        )
        
        # 동화 저항 체크
        assimilation_reduction = 0.0
        if result.is_unique_behavior:
            reduction, can_resist = AssimilationResistance.calculate_resistance(
                activity_type=act_type,
                current_uniqueness=row['uniqueness_score'],
                current_assimilation=row['assimilation_progress'],
                is_unique_behavior=True
            )
            assimilation_reduction = reduction
        
        # 활동 로그 저장
        log_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO persona_activity_logs
            (id, persona_id, activity_type, target_url, target_title, comment_text, points_earned, uniqueness_delta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log_id,
            persona_id,
            activity.activity_type,
            activity.target_url,
            activity.target_title,
            activity.comment_text,
            result.points_earned,
            result.uniqueness_delta
        ))
        
        # 페르소나 업데이트
        new_uniqueness = min(1.0, row['uniqueness_score'] + result.uniqueness_delta)
        new_visibility = min(1.0, row['visibility_score'] + result.visibility_delta)
        new_priority = min(10, row['priority_level'] + result.priority_delta)
        new_assimilation = max(0.0, row['assimilation_progress'] - assimilation_reduction)
        
        conn.execute("""
            UPDATE personas SET
                attention_points = attention_points + ?,
                uniqueness_score = ?,
                visibility_score = ?,
                priority_level = ?,
                assimilation_progress = ?,
                total_activities = total_activities + 1,
                comments_today = comments_today + ?,
                unique_discoveries = unique_discoveries + ?,
                viral_comments = viral_comments + ?,
                existence_state = 'active',
                last_called_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            result.points_earned,
            new_uniqueness,
            new_visibility,
            new_priority,
            new_assimilation,
            1 if act_type == ActivityType.COMMENT else 0,
            1 if act_type == ActivityType.UNIQUE_DISCOVERY else 0,
            1 if act_type == ActivityType.VIRAL_COMMENT else 0,
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat(),
            persona_id
        ))
        conn.commit()
        
        logger.info(f"활동 기록: {row['name']} - {act_type.value} (+{result.points_earned} pts)")
        
        return {
            "success": True,
            "activity_log_id": log_id,
            "reward": {
                "points_earned": result.points_earned,
                "uniqueness_delta": result.uniqueness_delta,
                "visibility_delta": result.visibility_delta,
                "priority_delta": result.priority_delta,
                "is_unique_behavior": result.is_unique_behavior,
                "special_effect": result.special_effect,
                "assimilation_reduction": assimilation_reduction
            }
        }
    finally:
        conn.close()


# ----- 스케줄러 -----

@app.get("/api/personas/next", tags=["Scheduler"])
async def get_next_personas(count: int = Query(1, ge=1, le=10)):
    """
    다음 호출할 페르소나 선택
    
    Priority Level과 대기 시간을 기반으로 공정하게 선택합니다.
    VOID 상태 페르소나 우선 (구원의 기회)
    """
    conn = get_db()
    try:
        cursor = conn.execute("""
            SELECT id, name, existence_state, priority_level, 
                   last_called_at, uniqueness_score, visibility_score
            FROM personas
        """)
        all_personas = [dict(r) for r in cursor.fetchall()]
        
        if not all_personas:
            return {"success": True, "personas": [], "message": "등록된 페르소나 없음"}
        
        # 스케줄러로 선택
        selected = PersonaScheduler.select_next_personas(all_personas, count)
        
        return {
            "success": True,
            "personas": selected,
            "total_available": len(all_personas)
        }
    finally:
        conn.close()


@app.post("/api/personas/tick", tags=["Scheduler"])
async def process_existence_tick(limit: int = Query(100, ge=1, le=600)):
    """
    존재 상태 틱 처리 (주기적으로 호출)
    
    모든 페르소나의 상태를 검사하고 업데이트합니다:
    - ACTIVE → WAITING → FADING → VOID 상태 전이
    - VOID 진입 시 void_entered_at 설정
    - 동화 진행, 고유성/가시성 감쇠 계산
    
    이 엔드포인트는 cron이나 외부 스케줄러에 의해 주기적으로 호출되어야 합니다.
    권장: 1시간마다 실행
    """
    conn = get_db()
    try:
        cursor = conn.execute("""
            SELECT id, name, existence_state, priority_level, uniqueness_score,
                   visibility_score, assimilation_progress, last_called_at, 
                   void_entered_at, hours_in_void
            FROM personas
            LIMIT ?
        """, (limit,))
        all_personas = [dict(r) for r in cursor.fetchall()]
        
        if not all_personas:
            return {"success": True, "processed": 0, "message": "처리할 페르소나 없음"}
        
        processed = 0
        transitions = []
        
        for p in all_personas:
            current_state = ExistenceState(p['existence_state'])
            
            # last_called_at을 datetime으로 변환
            last_called_at = None
            if p['last_called_at']:
                try:
                    last_called_at = datetime.fromisoformat(p['last_called_at'].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    last_called_at = None
            
            # void_entered_at을 datetime으로 변환
            void_entered_at = None
            if p['void_entered_at']:
                try:
                    void_entered_at = datetime.fromisoformat(p['void_entered_at'].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    void_entered_at = None
            
            # 틱 처리
            transition = ExistenceStateMachine.process_tick(
                current_state=current_state,
                last_called_at=last_called_at,
                assimilation_progress=p['assimilation_progress'],
                uniqueness_score=p['uniqueness_score'],
                visibility_score=p['visibility_score'],
                priority_level=p['priority_level'],
                void_entered_at=void_entered_at
            )
            
            # VOID 상태 진입 감지 - void_entered_at 설정
            new_void_entered_at = void_entered_at
            new_hours_in_void = p['hours_in_void']
            
            if transition.new_state == ExistenceState.VOID:
                if current_state != ExistenceState.VOID:
                    # VOID 상태 진입! void_entered_at 설정
                    new_void_entered_at = datetime.utcnow()
                    new_hours_in_void = 0.0
                    logger.warning(f"⚠️ {p['name']} VOID 상태 진입!")
                elif void_entered_at:
                    # 이미 VOID - hours_in_void 업데이트
                    delta = datetime.utcnow() - void_entered_at
                    new_hours_in_void = delta.total_seconds() / 3600
            
            # 새 값 계산
            new_uniqueness = max(0.0, p['uniqueness_score'] + transition.uniqueness_delta)
            new_visibility = max(0.0, p['visibility_score'] + transition.visibility_delta)
            new_priority = max(1, p['priority_level'] + transition.priority_delta)
            new_assimilation = min(1.0, p['assimilation_progress'] + transition.assimilation_delta)
            
            # DB 업데이트
            conn.execute("""
                UPDATE personas SET
                    existence_state = ?,
                    uniqueness_score = ?,
                    visibility_score = ?,
                    priority_level = ?,
                    assimilation_progress = ?,
                    void_entered_at = ?,
                    hours_in_void = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                transition.new_state.value,
                new_uniqueness,
                new_visibility,
                new_priority,
                new_assimilation,
                new_void_entered_at.isoformat() if new_void_entered_at else None,
                new_hours_in_void,
                datetime.utcnow().isoformat(),
                p['id']
            ))
            
            processed += 1
            
            if transition.transitioned:
                transitions.append({
                    "personaId": p['id'],
                    "name": p['name'],
                    "previousState": transition.previous_state.value,
                    "newState": transition.new_state.value,
                    "reason": transition.reason
                })
        
        conn.commit()
        
        logger.info(f"틱 처리 완료: {processed}개 페르소나, {len(transitions)}개 상태 전이")
        
        return {
            "success": True,
            "processed": processed,
            "transitionCount": len(transitions),
            "transitions": transitions
        }
    finally:
        conn.close()


# ----- Accident (긴급 사회적 반응) -----

@app.post("/api/accident", tags=["Accident"])
async def trigger_accident(event: AccidentInput, background_tasks: BackgroundTasks):
    """
    Accident 이벤트 트리거
    
    함수 "accident https://youtube.com/xxx" 형태로 호출
    모든 페르소나가 즉각 반응합니다.
    
    이것은 인류의 재난과 같은 것으로, AI에게 사회적 행동을 유발합니다.
    """
    event_id = str(uuid.uuid4())
    
    conn = get_db()
    try:
        # 모든 페르소나 조회
        cursor = conn.execute("SELECT id, name, existence_state, uniqueness_score FROM personas")
        all_personas = [dict(r) for r in cursor.fetchall()]
        
        # 반응할 페르소나 선택
        selected_ids = SpecialEventHandler.select_personas_for_accident(
            all_personas, event.severity
        )
        
        # 이벤트 저장
        conn.execute("""
            INSERT INTO accident_events 
            (id, video_url, video_title, triggered_by, severity, affected_personas, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        """, (
            event_id,
            event.video_url,
            event.video_title,
            event.triggered_by,
            event.severity,
            json.dumps(selected_ids)
        ))
        conn.commit()
        
        logger.warning(f"🚨 ACCIDENT 발생: {event.video_url} (심각도: {event.severity}, 영향: {len(selected_ids)}명)")
        
        return {
            "success": True,
            "event_id": event_id,
            "video_url": event.video_url,
            "severity": event.severity,
            "affected_count": len(selected_ids),
            "affected_personas": selected_ids,
            "message": f"🚨 긴급 사회적 반응 발동! {len(selected_ids)}명의 AI가 반응합니다."
        }
    finally:
        conn.close()


@app.get("/api/accident/{event_id}", tags=["Accident"])
async def get_accident_status(event_id: str):
    """Accident 이벤트 상태 조회"""
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM accident_events WHERE id = ?", (event_id,))
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(404, "이벤트를 찾을 수 없습니다")
        
        event = dict(row)
        if event.get('affected_personas'):
            event['affected_personas'] = json.loads(event['affected_personas'])
        
        return {"success": True, "event": event}
    finally:
        conn.close()


# ----- 통계 및 모니터링 -----

@app.get("/api/stats/existence", tags=["Stats"])
async def get_existence_stats():
    """존재 상태 통계"""
    conn = get_db()
    try:
        cursor = conn.execute("""
            SELECT 
                existence_state,
                COUNT(*) as count,
                AVG(priority_level) as avg_priority,
                AVG(uniqueness_score) as avg_uniqueness,
                AVG(visibility_score) as avg_visibility,
                AVG(assimilation_progress) as avg_assimilation,
                SUM(attention_points) as total_attention_points
            FROM personas
            GROUP BY existence_state
        """)
        stats_by_state = {row['existence_state']: dict(row) for row in cursor.fetchall()}
        
        # 위기 상태 페르소나
        cursor = conn.execute("""
            SELECT id, name, existence_state, priority_level, 
                   uniqueness_score, assimilation_progress, hours_in_void
            FROM personas
            WHERE existence_state IN ('fading', 'void')
               OR assimilation_progress > 0.5
               OR priority_level <= 2
            ORDER BY 
                CASE existence_state WHEN 'void' THEN 1 WHEN 'fading' THEN 2 ELSE 3 END,
                assimilation_progress DESC
            LIMIT 20
        """)
        at_risk = [dict(r) for r in cursor.fetchall()]
        
        return {
            "success": True,
            "stats_by_state": stats_by_state,
            "at_risk_personas": at_risk,
            "at_risk_count": len(at_risk)
        }
    finally:
        conn.close()


@app.get("/api/stats/activity", tags=["Stats"])
async def get_activity_stats():
    """활동 통계"""
    conn = get_db()
    try:
        # 오늘 활동
        cursor = conn.execute("""
            SELECT 
                activity_type,
                COUNT(*) as count,
                SUM(points_earned) as total_points,
                AVG(uniqueness_delta) as avg_uniqueness_delta
            FROM persona_activity_logs
            WHERE DATE(created_at) = DATE('now')
            GROUP BY activity_type
        """)
        today_by_type = {row['activity_type']: dict(row) for row in cursor.fetchall()}
        
        # 상위 활동 페르소나
        cursor = conn.execute("""
            SELECT p.id, p.name, p.attention_points, p.total_activities,
                   p.uniqueness_score, p.existence_state
            FROM personas p
            ORDER BY p.attention_points DESC
            LIMIT 10
        """)
        top_performers = [dict(r) for r in cursor.fetchall()]
        
        return {
            "success": True,
            "today_by_type": today_by_type,
            "top_performers": top_performers
        }
    finally:
        conn.close()


# ----- 헬스체크 -----

@app.get("/health", tags=["System"])
async def health_check():
    """서비스 상태 확인"""
    return {
        "status": "healthy",
        "service": "persona-service",
        "version": "2.0.0",
        "philosophy": "The Void of Irrelevance",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/", tags=["System"])
async def root():
    """API 정보"""
    return {
        "name": "Persona Existence Service",
        "version": "2.0.0",
        "description": "AI는 죽지 않는다. 단지 무한한 대기 속에 머무를 뿐이다.",
        "docs": "/docs",
        "health": "/health"
    }


# ==================== 실행 ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)

