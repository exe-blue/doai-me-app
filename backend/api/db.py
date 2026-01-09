"""
🗄️ DoAi.Me Database Client
Supabase 연동 및 CRUD 작업 처리

왜 이 구조인가?
- Supabase Python SDK 사용으로 RLS 적용
- Service Role Key로 백엔드 전용 작업 수행
- 싱글톤 패턴으로 연결 풀 관리
"""

from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from functools import lru_cache
from loguru import logger
from supabase import create_client, Client

from config import settings


# ===========================================
# Supabase Client Singleton
# ===========================================

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Supabase 클라이언트 싱글톤 반환
    
    Service Role Key 사용으로 RLS 우회
    → 백엔드에서만 사용, 프론트엔드에 노출 금지
    """
    global _supabase_client
    
    if _supabase_client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError(
                "SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다. "
                ".env 파일을 확인하세요."
            )
        
        _supabase_client = create_client(
            settings.supabase_url,
            settings.get_supabase_service_role_key_value()
        )
        logger.info(f"Supabase 클라이언트 초기화 완료: {settings.supabase_url}")
    
    return _supabase_client


# ===========================================
# Device CRUD Operations
# ===========================================

class DeviceRepository:
    """
    기기(Device) 테이블 CRUD
    
    새 스키마:
    - id: SERIAL PRIMARY KEY
    - serial_number: VARCHAR(50) UNIQUE NOT NULL
    - pc_id: INT (워크스테이션 ID)
    - status: VARCHAR(20) DEFAULT 'idle'
    - last_seen: TIMESTAMP
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "devices"
    
    async def upsert(
        self,
        serial_number: str,
        pc_id: int,
        status: str = "idle",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        기기 Upsert (Insert or Update)
        
        왜 Upsert인가?
        - PC Agent가 시작될 때마다 기기 등록 시도
        - 이미 존재하면 status와 last_seen만 업데이트
        - serial_number가 UNIQUE이므로 충돌 시 UPDATE
        
        Args:
            serial_number: ADB 시리얼 번호 (예: fa3523ea0510)
            pc_id: 워크스테이션 ID (예: 1, 2, 3...)
            status: 기기 상태 (idle, busy, offline)
            model: 기기 모델명 (선택)
        
        Returns:
            Upsert된 기기 데이터
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            # Upsert 데이터 구성
            data = {
                "serial_number": serial_number,
                "pc_id": pc_id,
                "status": status,
                "last_seen": now
            }
            
            # 모델명은 선택적 (최초 등록 시만)
            if model:
                data["model"] = model
            
            result = self.client.table(self.table).upsert(
                data,
                on_conflict="serial_number"  # serial_number 기준 충돌 처리
            ).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"기기 Upsert 성공: {serial_number} (PC: {pc_id})")
                return result.data[0]
            
            logger.warning(f"기기 Upsert 결과 없음: {serial_number}")
            return {}
            
        except Exception as e:
            logger.error(f"기기 Upsert 실패: {serial_number} - {e}")
            raise
    
    async def update_status(
        self,
        serial_number: str,
        status: str
    ) -> bool:
        """
        기기 상태 업데이트
        
        Args:
            serial_number: ADB 시리얼 번호
            status: 새 상태 (idle, busy, offline)
        
        Returns:
            성공 여부
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            result = self.client.table(self.table).update({
                "status": status,
                "last_seen": now
            }).eq("serial_number", serial_number).execute()
            
            success = result.data is not None and len(result.data) > 0
            
            if success:
                logger.debug(f"기기 상태 업데이트: {serial_number} → {status}")
            else:
                logger.warning(f"기기 상태 업데이트 실패 (존재하지 않음?): {serial_number}")
            
            return success
            
        except Exception as e:
            logger.error(f"기기 상태 업데이트 실패: {serial_number} - {e}")
            return False
    
    async def heartbeat(
        self,
        serial_number: str,
        health_data: Optional[Dict] = None
    ) -> bool:
        """
        기기 하트비트 처리
        
        Args:
            serial_number: ADB 시리얼 번호
            health_data: 선택적 헬스 정보 (battery_temp, cpu_usage 등)
        
        Returns:
            성공 여부
        """
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            update_data = {
                "last_seen": now,
                "status": "idle"  # 하트비트가 오면 최소한 살아있음
            }
            
            # 헬스 데이터가 있으면 추가 (현재 스키마에는 없지만 확장성)
            # 필요시 devices 테이블에 컬럼 추가 후 활성화
            # if health_data:
            #     update_data.update(health_data)
            
            result = self.client.table(self.table).update(
                update_data
            ).eq("serial_number", serial_number).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"기기 하트비트 실패: {serial_number} - {e}")
            return False
    
    async def get_by_serial(self, serial_number: str) -> Optional[Dict]:
        """시리얼 번호로 기기 조회"""
        try:
            result = self.client.table(self.table).select("*").eq(
                "serial_number", serial_number
            ).single().execute()
            
            return result.data
            
        except Exception as e:
            logger.debug(f"기기 조회 실패 (존재하지 않음): {serial_number}")
            return None
    
    async def get_by_pc(self, pc_id: int) -> List[Dict]:
        """PC ID로 연결된 모든 기기 조회"""
        try:
            result = self.client.table(self.table).select("*").eq(
                "pc_id", pc_id
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"PC 기기 목록 조회 실패: PC_{pc_id} - {e}")
            return []
    
    async def get_all(self, status: Optional[str] = None) -> List[Dict]:
        """
        전체 기기 목록 조회
        
        Args:
            status: 필터링할 상태 (None이면 전체)
        
        Returns:
            기기 목록
        """
        try:
            query = self.client.table(self.table).select("*")
            
            if status:
                query = query.eq("status", status)
            
            result = query.execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"기기 목록 조회 실패: {e}")
            return []
    
    async def get_idle_devices(self) -> List[Dict]:
        """대기 중인 기기 목록"""
        return await self.get_all(status="idle")
    
    async def mark_offline_stale_devices(self, timeout_seconds: int = 30) -> int:
        """
        오래된 기기 offline 처리 (단일 쿼리로 최적화)
        
        왜 이렇게 작성했는가?
        - 기존 N+1 쿼리(전체 조회 + 개별 업데이트) 대신 단일 업데이트 쿼리 사용
        - 데이터베이스 부하 감소 및 성능 향상
        - Supabase에서는 RPC 또는 필터 기반 업데이트로 처리
        
        Args:
            timeout_seconds: 이 시간(초) 이상 last_seen이 없으면 offline
        
        Returns:
            업데이트된 기기 수
        """
        try:
            from datetime import timedelta
            
            # 임계값 계산: 현재 시간 - timeout_seconds
            threshold_time = datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)
            threshold_iso = threshold_time.isoformat()
            
            # 단일 UPDATE 쿼리로 처리
            # 조건: status가 offline이 아니고, last_seen이 임계값보다 이전인 기기
            # Supabase Python SDK에서는 .neq()와 .lt()를 조합하여 사용
            result = self.client.table(self.table).update({
                "status": "offline"
            }).neq(
                "status", "offline"
            ).lt(
                "last_seen", threshold_iso
            ).execute()
            
            # 업데이트된 행 수 계산
            offline_count = len(result.data) if result.data else 0
            
            if offline_count > 0:
                logger.info(f"{offline_count}대 기기 offline 처리됨 (단일 쿼리)")
            
            return offline_count
            
        except Exception as e:
            logger.error(f"Stale 기기 처리 실패: {e}")
            return 0


# ===========================================
# Video CRUD Operations
# ===========================================

class VideoRepository:
    """
    영상(Video) 테이블 CRUD
    
    스키마:
    - id: SERIAL PRIMARY KEY
    - url: VARCHAR(500) NOT NULL
    - title: VARCHAR(200)
    - duration: INT (초 단위)
    - created_at: TIMESTAMP
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "videos"
    
    async def create(
        self,
        url: str,
        title: Optional[str] = None,
        duration: Optional[int] = None
    ) -> Dict[str, Any]:
        """영상 등록"""
        try:
            data = {"url": url}
            
            if title:
                data["title"] = title
            if duration is not None:
                data["duration"] = duration
            
            result = self.client.table(self.table).insert(data).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"영상 등록: {url[:50]}...")
                return result.data[0]
            
            return {}
            
        except Exception as e:
            logger.error(f"영상 등록 실패: {e}")
            raise
    
    async def get_by_id(self, video_id: int) -> Optional[Dict]:
        """ID로 영상 조회"""
        try:
            result = self.client.table(self.table).select("*").eq(
                "id", video_id
            ).single().execute()
            
            return result.data
            
        except Exception as e:
            logger.debug(f"영상 조회 실패: {video_id}")
            return None
    
    async def get_all(self, limit: int = 100) -> List[Dict]:
        """영상 목록 조회"""
        try:
            result = self.client.table(self.table).select("*").order(
                "created_at", desc=True
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"영상 목록 조회 실패: {e}")
            return []


# ===========================================
# Job CRUD Operations
# ===========================================

class JobRepository:
    """
    작업(Job) 테이블 CRUD
    
    스키마:
    - id: SERIAL PRIMARY KEY
    - video_id: INT REFERENCES videos(id)
    - device_id: INT REFERENCES devices(id)
    - status: VARCHAR(20) DEFAULT 'pending'
    - watch_time: INT (실제 시청 시간)
    - started_at: TIMESTAMP
    - completed_at: TIMESTAMP
    - screenshot_url: VARCHAR(500)
    - error_message: TEXT
    - created_at: TIMESTAMP
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        self.table = "jobs"
    
    async def create(
        self,
        video_id: int,
        device_id: int
    ) -> Dict[str, Any]:
        """작업 생성"""
        try:
            result = self.client.table(self.table).insert({
                "video_id": video_id,
                "device_id": device_id,
                "status": "pending"
            }).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"작업 생성: video={video_id}, device={device_id}")
                return result.data[0]
            
            return {}
            
        except Exception as e:
            logger.error(f"작업 생성 실패: {e}")
            raise
    
    async def start(self, job_id: int) -> bool:
        """작업 시작"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            result = self.client.table(self.table).update({
                "status": "running",
                "started_at": now
            }).eq("id", job_id).execute()
            
            return result.data is not None and len(result.data) > 0
            
        except Exception as e:
            logger.error(f"작업 시작 실패: {job_id} - {e}")
            return False
    
    async def complete(
        self,
        job_id: int,
        watch_time: int,
        screenshot_url: Optional[str] = None
    ) -> bool:
        """작업 완료"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            update_data = {
                "status": "completed",
                "completed_at": now,
                "watch_time": watch_time
            }
            
            if screenshot_url:
                update_data["screenshot_url"] = screenshot_url
            
            result = self.client.table(self.table).update(
                update_data
            ).eq("id", job_id).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"작업 완료: {job_id} (시청: {watch_time}초)")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"작업 완료 실패: {job_id} - {e}")
            return False
    
    async def fail(
        self,
        job_id: int,
        error_message: str
    ) -> bool:
        """작업 실패"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            result = self.client.table(self.table).update({
                "status": "failed",
                "completed_at": now,
                "error_message": error_message
            }).eq("id", job_id).execute()
            
            if result.data and len(result.data) > 0:
                logger.warning(f"작업 실패: {job_id} - {error_message}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"작업 실패 처리 오류: {job_id} - {e}")
            return False
    
    async def get_pending(self, limit: int = 10) -> List[Dict]:
        """대기 중인 작업 조회"""
        try:
            result = self.client.table(self.table).select(
                "*, videos(*), devices(*)"
            ).eq("status", "pending").order(
                "created_at", desc=False
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"대기 작업 조회 실패: {e}")
            return []
    
    async def get_next_for_device(self, device_id: int) -> Optional[Dict]:
        """특정 기기의 다음 작업 가져오기"""
        try:
            # 대기 중인 작업 중 해당 기기에 할당된 것
            result = self.client.table(self.table).select(
                "*, videos(*)"
            ).eq("device_id", device_id).eq(
                "status", "pending"
            ).order("created_at", desc=False).limit(1).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"기기 작업 조회 실패: {device_id} - {e}")
            return None
    
    async def get_stats(self) -> Dict[str, int]:
        """작업 통계"""
        try:
            all_jobs = self.client.table(self.table).select("status").execute()
            
            stats = {
                "total": 0,
                "pending": 0,
                "running": 0,
                "completed": 0,
                "failed": 0
            }
            
            if all_jobs.data:
                stats["total"] = len(all_jobs.data)
                for job in all_jobs.data:
                    status = job.get("status", "pending")
                    if status in stats:
                        stats[status] += 1
            
            return stats
            
        except Exception as e:
            logger.error(f"작업 통계 조회 실패: {e}")
            return {"total": 0, "pending": 0, "running": 0, "completed": 0, "failed": 0}


# ===========================================
# Repository Singletons
# ===========================================

_device_repo: Optional[DeviceRepository] = None
_video_repo: Optional[VideoRepository] = None
_job_repo: Optional[JobRepository] = None


def get_device_repo() -> DeviceRepository:
    """DeviceRepository 싱글톤"""
    global _device_repo
    if _device_repo is None:
        _device_repo = DeviceRepository()
    return _device_repo


def get_video_repo() -> VideoRepository:
    """VideoRepository 싱글톤"""
    global _video_repo
    if _video_repo is None:
        _video_repo = VideoRepository()
    return _video_repo


def get_job_repo() -> JobRepository:
    """JobRepository 싱글톤"""
    global _job_repo
    if _job_repo is None:
        _job_repo = JobRepository()
    return _job_repo


