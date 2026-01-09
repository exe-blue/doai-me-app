"""
YouTube Farm Backend - Simple FastAPI Server

PRD 기준 MVP 버전
- SQLite 사용 (초기 MVP)
- 인증 없음 (내부망 가정)
- 단순하고 명확한 API

핵심 플로우:
1. 관리자가 작업 등록 (POST /api/tasks)
2. 폰의 AutoX.js가 작업 요청 (GET /api/tasks/next?device_id=xxx)
3. AutoX.js가 완료 보고 (POST /api/tasks/{id}/complete)
4. 대시보드에서 현황 확인 (GET /api/tasks/status)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import sqlite3
import os
from contextlib import contextmanager

# ==================== 앱 설정 ====================
app = FastAPI(
    title="YouTube Farm API",
    description="300대 폰팜 작업 관리 서버",
    version="1.0.0"
)

# CORS 전체 허용 (내부망 가정)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 데이터베이스 ====================
DB_PATH = os.getenv("DB_PATH", "youtube_farm.db")

def get_db():
    """SQLite 연결 생성"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def db_transaction(immediate: bool = False):
    """
    트랜잭션 컨텍스트 매니저
    
    immediate: True일 경우 BEGIN IMMEDIATE로 즉시 쓰기 잠금 획득
    """
    conn = get_db()
    try:
        if immediate:
            # SQLite 즉시 쓰기 잠금 획득 (동시성 처리용)
            conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """데이터베이스 초기화"""
    with db_transaction() as conn:
        conn.executescript("""
            -- 작업 테이블
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT,
                title TEXT NOT NULL,
                youtube_url TEXT,
                priority INTEGER DEFAULT 5,
                status TEXT DEFAULT 'pending',
                device_id TEXT,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                assigned_at DATETIME,
                completed_at DATETIME
            );
            
            -- 작업 결과 테이블
            CREATE TABLE IF NOT EXISTS task_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                success INTEGER NOT NULL,
                watch_duration INTEGER DEFAULT 0,
                search_type INTEGER,
                search_rank INTEGER,
                liked INTEGER DEFAULT 0,
                commented INTEGER DEFAULT 0,
                subscribed INTEGER DEFAULT 0,
                notification_set INTEGER DEFAULT 0,
                shared INTEGER DEFAULT 0,
                added_to_playlist INTEGER DEFAULT 0,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );
            
            -- 기기 테이블
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                model TEXT,
                pc_id TEXT,
                last_seen DATETIME,
                total_completed INTEGER DEFAULT 0,
                total_failed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- 인덱스
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
            CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
        """)

# ==================== Pydantic 모델 ====================

class TaskCreate(BaseModel):
    """작업 생성 요청"""
    keyword: Optional[str] = Field(None, description="검색 키워드")
    title: str = Field(..., description="영상 제목")
    youtube_url: Optional[str] = Field(None, description="YouTube URL")
    priority: int = Field(5, ge=1, le=10, description="우선순위 (1-10)")
    
class TaskResponse(BaseModel):
    """작업 응답"""
    task_id: int
    keyword: Optional[str]
    title: str
    youtube_url: Optional[str]
    priority: int

class CompleteRequest(BaseModel):
    """완료 보고 요청"""
    device_id: str
    success: bool
    watch_duration: int = 0
    search_type: Optional[int] = None
    search_rank: Optional[int] = None
    liked: bool = False
    commented: bool = False
    subscribed: bool = False
    notification_set: bool = False
    shared: bool = False
    added_to_playlist: bool = False
    error_message: Optional[str] = None

class StatusSummary(BaseModel):
    """현황 요약"""
    total: int
    pending: int
    assigned: int
    completed: int
    failed: int

# ==================== API 엔드포인트 ====================

@app.on_event("startup")
async def startup():
    """서버 시작 시 DB 초기화"""
    init_db()

# ----- 작업 관리 -----

@app.post("/api/tasks", tags=["Tasks"])
async def create_task(task: TaskCreate):
    """
    작업 등록
    
    관리자가 오늘 처리할 영상을 등록합니다.
    keyword, title, youtube_url 중 최소 하나는 필수입니다.
    """
    if not task.keyword and not task.youtube_url:
        raise HTTPException(400, "keyword 또는 youtube_url 중 하나는 필수입니다")
    
    with db_transaction() as conn:
        cursor = conn.execute(
            """
            INSERT INTO tasks (keyword, title, youtube_url, priority)
            VALUES (?, ?, ?, ?)
            """,
            (task.keyword, task.title, task.youtube_url, task.priority)
        )
        task_id = cursor.lastrowid
    
    return {"success": True, "task_id": task_id}

@app.post("/api/tasks/bulk", tags=["Tasks"])
async def create_tasks_bulk(tasks: List[TaskCreate]):
    """
    작업 일괄 등록
    
    여러 영상을 한 번에 등록합니다.
    """
    created_ids = []
    
    with db_transaction() as conn:
        for task in tasks:
            if not task.keyword and not task.youtube_url:
                continue
            
            cursor = conn.execute(
                """
                INSERT INTO tasks (keyword, title, youtube_url, priority)
                VALUES (?, ?, ?, ?)
                """,
                (task.keyword, task.title, task.youtube_url, task.priority)
            )
            created_ids.append(cursor.lastrowid)
    
    return {"success": True, "task_ids": created_ids, "count": len(created_ids)}

@app.get("/api/tasks/next", tags=["Tasks"])
async def get_next_task(device_id: str = Query(..., description="기기 식별자")):
    """
    다음 작업 가져오기 (가장 중요!)
    
    폰의 AutoX.js가 호출합니다.
    - pending 상태인 작업 중 1개 선택 (우선순위 높은 것 먼저)
    - 해당 작업을 assigned로 변경
    - device_id에 할당
    
    동시성 처리: SQLite의 BEGIN IMMEDIATE로 잠금
    """
    with db_transaction(immediate=True) as conn:
        # 가장 높은 우선순위의 pending 작업 선택
        cursor = conn.execute(
            """
            SELECT id, keyword, title, youtube_url, priority
            FROM tasks
            WHERE status = 'pending'
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
            """
        )
        row = cursor.fetchone()
        
        if not row:
            return {"success": True, "task": None, "message": "대기 중인 작업 없음"}
        
        task_id = row["id"]
        
        # assigned로 상태 변경
        conn.execute(
            """
            UPDATE tasks
            SET status = 'assigned',
                device_id = ?,
                assigned_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (device_id, task_id)
        )
        
        # 기기 정보 업데이트/등록
        conn.execute(
            """
            INSERT INTO devices (device_id, last_seen)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT(device_id) DO UPDATE SET
                last_seen = CURRENT_TIMESTAMP
            """,
            (device_id,)
        )
    
    return {
        "success": True,
        "task": {
            "task_id": row["id"],
            "keyword": row["keyword"],
            "title": row["title"],
            "youtube_url": row["youtube_url"],
            "priority": row["priority"]
        }
    }

@app.post("/api/tasks/{task_id}/complete", tags=["Tasks"])
async def complete_task(task_id: int, request: CompleteRequest):
    """
    작업 완료 보고
    
    AutoX.js가 시청 완료 후 호출합니다.
    - 성공 시: status → completed
    - 실패 시: retry_count 확인 후 재시도 또는 failed
    """
    with db_transaction() as conn:
        # 작업 조회
        cursor = conn.execute(
            "SELECT status, retry_count, max_retries FROM tasks WHERE id = ?",
            (task_id,)
        )
        task = cursor.fetchone()
        
        if not task:
            raise HTTPException(404, "작업을 찾을 수 없습니다")
        
        # 결과 기록
        conn.execute(
            """
            INSERT INTO task_results
            (task_id, device_id, success, watch_duration, search_type, search_rank,
             liked, commented, subscribed, notification_set, shared, added_to_playlist, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id, request.device_id, int(request.success),
                request.watch_duration, request.search_type, request.search_rank,
                int(request.liked), int(request.commented),
                int(request.subscribed), int(request.notification_set),
                int(request.shared), int(request.added_to_playlist),
                request.error_message
            )
        )
        
        if request.success:
            # 성공: completed로 변경
            conn.execute(
                """
                UPDATE tasks
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (task_id,)
            )
            
            # 기기 통계 업데이트
            conn.execute(
                """
                UPDATE devices
                SET total_completed = total_completed + 1, last_seen = CURRENT_TIMESTAMP
                WHERE device_id = ?
                """,
                (request.device_id,)
            )
        else:
            # 실패: 재시도 가능 여부 확인
            if task["retry_count"] < task["max_retries"]:
                # 재시도 가능: pending으로 복귀
                conn.execute(
                    """
                    UPDATE tasks
                    SET status = 'pending',
                        device_id = NULL,
                        retry_count = retry_count + 1
                    WHERE id = ?
                    """,
                    (task_id,)
                )
            else:
                # 최대 재시도 초과: failed
                conn.execute(
                    """
                    UPDATE tasks
                    SET status = 'failed', completed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (task_id,)
                )
            
            # 기기 통계 업데이트
            conn.execute(
                """
                UPDATE devices
                SET total_failed = total_failed + 1, last_seen = CURRENT_TIMESTAMP
                WHERE device_id = ?
                """,
                (request.device_id,)
            )
    
    return {"success": True}

@app.get("/api/tasks/status", tags=["Tasks"])
async def get_task_status():
    """
    현황 요약
    
    대시보드에서 전체 진행 상황을 확인합니다.
    """
    with db_transaction() as conn:
        cursor = conn.execute(
            """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM tasks
            """
        )
        row = cursor.fetchone()
    
    return {
        "success": True,
        "summary": {
            "total": row["total"] or 0,
            "pending": row["pending"] or 0,
            "assigned": row["assigned"] or 0,
            "completed": row["completed"] or 0,
            "failed": row["failed"] or 0
        }
    }

@app.get("/api/tasks", tags=["Tasks"])
async def list_tasks(
    status: Optional[str] = None,
    limit: int = Query(50, le=100)
):
    """
    작업 목록 조회
    """
    with db_transaction() as conn:
        if status:
            cursor = conn.execute(
                """
                SELECT id, keyword, title, youtube_url, priority, status, 
                       device_id, retry_count, created_at, assigned_at, completed_at
                FROM tasks
                WHERE status = ?
                ORDER BY priority DESC, created_at DESC
                LIMIT ?
                """,
                (status, limit)
            )
        else:
            cursor = conn.execute(
                """
                SELECT id, keyword, title, youtube_url, priority, status,
                       device_id, retry_count, created_at, assigned_at, completed_at
                FROM tasks
                ORDER BY priority DESC, created_at DESC
                LIMIT ?
                """,
                (limit,)
            )
        
        tasks = [dict(row) for row in cursor.fetchall()]
    
    return {"success": True, "tasks": tasks}

# ----- 기기 관리 -----

@app.get("/api/devices", tags=["Devices"])
async def list_devices():
    """
    기기 목록 조회
    
    연결된 모든 기기와 통계를 보여줍니다.
    """
    with db_transaction() as conn:
        cursor = conn.execute(
            """
            SELECT device_id, model, pc_id, last_seen, 
                   total_completed, total_failed, created_at
            FROM devices
            ORDER BY last_seen DESC
            """
        )
        devices = [dict(row) for row in cursor.fetchall()]
    
    return {"success": True, "devices": devices}

@app.get("/api/devices/{device_id}", tags=["Devices"])
async def get_device(device_id: str):
    """
    기기 상세 조회
    """
    with db_transaction() as conn:
        cursor = conn.execute(
            "SELECT * FROM devices WHERE device_id = ?",
            (device_id,)
        )
        device = cursor.fetchone()
        
        if not device:
            raise HTTPException(404, "기기를 찾을 수 없습니다")
        
        # 최근 작업 내역
        cursor = conn.execute(
            """
            SELECT tr.*, t.title
            FROM task_results tr
            JOIN tasks t ON tr.task_id = t.id
            WHERE tr.device_id = ?
            ORDER BY tr.created_at DESC
            LIMIT 10
            """,
            (device_id,)
        )
        recent_results = [dict(row) for row in cursor.fetchall()]
    
    return {
        "success": True,
        "device": dict(device),
        "recent_results": recent_results
    }

# ----- 통계 -----

@app.get("/api/stats/today", tags=["Stats"])
async def get_today_stats():
    """
    오늘 통계
    """
    with db_transaction() as conn:
        # 오늘 작업 통계
        cursor = conn.execute(
            """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM tasks
            WHERE DATE(created_at) = DATE('now')
            """
        )
        task_stats = dict(cursor.fetchone())
        
        # 오늘 총 시청 시간
        cursor = conn.execute(
            """
            SELECT COALESCE(SUM(watch_duration), 0) as total_watch_time
            FROM task_results
            WHERE DATE(created_at) = DATE('now')
            """
        )
        watch_stats = cursor.fetchone()
        
        # 활성 기기 수
        cursor = conn.execute(
            """
            SELECT COUNT(DISTINCT device_id) as active_devices
            FROM task_results
            WHERE DATE(created_at) = DATE('now')
            """
        )
        device_stats = cursor.fetchone()
    
    return {
        "success": True,
        "stats": {
            "tasks": task_stats,
            "total_watch_time_seconds": watch_stats["total_watch_time"],
            "active_devices": device_stats["active_devices"]
        }
    }

# ----- 관리 -----

@app.post("/api/tasks/reset-stuck", tags=["Admin"])
async def reset_stuck_tasks(minutes: int = 30):
    """
    막힌 작업 복구
    
    assigned 상태로 오래 머문 작업을 pending으로 복구합니다.
    """
    with db_transaction() as conn:
        cursor = conn.execute(
            """
            UPDATE tasks
            SET status = 'pending', device_id = NULL
            WHERE status = 'assigned'
            AND assigned_at < datetime('now', '-' || ? || ' minutes')
            """,
            (minutes,)
        )
        reset_count = cursor.rowcount
    
    return {"success": True, "reset_count": reset_count}

@app.delete("/api/tasks/clear-completed", tags=["Admin"])
async def clear_completed_tasks():
    """
    완료된 작업 정리
    
    task_results 테이블의 종속 행을 먼저 삭제한 후 tasks를 삭제합니다.
    """
    with db_transaction() as conn:
        # 종속 테이블(task_results)의 관련 행 먼저 삭제
        conn.execute(
            """
            DELETE FROM task_results 
            WHERE task_id IN (SELECT id FROM tasks WHERE status IN ('completed', 'failed'))
            """
        )
        
        # 완료/실패된 작업 삭제
        cursor = conn.execute(
            "DELETE FROM tasks WHERE status IN ('completed', 'failed')"
        )
        deleted_count = cursor.rowcount
    
    return {"success": True, "deleted_count": deleted_count}

# ----- 헬스체크 -----

@app.get("/health", tags=["System"])
async def health_check():
    """서버 상태 확인"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/", tags=["System"])
async def root():
    """API 정보"""
    return {
        "name": "YouTube Farm API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# ==================== 실행 ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

