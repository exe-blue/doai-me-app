"""
Local Storage Manager for NodeRunner

Directory Structure:
/var/noderunner/
├── config/        # Node configuration
├── logs/          # 24h retention
├── screenshots/   # 24h retention  
├── laixi_raw/     # 6h retention
└── temp/          # 1h retention
"""

import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger("Storage")

# ============================================================
# Configuration
# ============================================================

# Windows: D:\noderunner\
# Linux: /var/noderunner/
BASE_DIR = Path(os.getenv("NODERUNNER_DATA_DIR", 
    "D:/noderunner" if os.name == 'nt' else "/var/noderunner"
))

RETENTION_POLICY = {
    "logs": timedelta(hours=24),
    "screenshots": timedelta(hours=24),
    "laixi_raw": timedelta(hours=6),
    "temp": timedelta(hours=1)
}

# ============================================================
# Storage Manager
# ============================================================

class StorageManager:
    """로컬 저장소 관리"""
    
    def __init__(self):
        self.base = BASE_DIR
        self._init_dirs()
    
    def _init_dirs(self):
        """디렉토리 초기화"""
        for subdir in ["config", "logs", "screenshots", "laixi_raw", "temp"]:
            (self.base / subdir).mkdir(parents=True, exist_ok=True)
        logger.info(f"Storage 초기화: {self.base}")
    
    # ==================== Logs ====================
    
    def save_task_log(self, task_id: str, data: Dict[str, Any]):
        """Task 상세 로그 저장 (Central에 보내지 않는 데이터)"""
        today = datetime.now().strftime("%Y-%m-%d")
        log_dir = self.base / "logs" / today
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"{task_id}.json"
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump({
                "task_id": task_id,
                "saved_at": datetime.now(timezone.utc).isoformat(),
                "data": data
            }, f, ensure_ascii=False, indent=2)
        
        logger.debug(f"Task 로그 저장: {log_file}")
    
    def get_task_log(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Task 로그 조회"""
        # 최근 7일 검색
        for i in range(7):
            day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            log_file = self.base / "logs" / day / f"{task_id}.json"
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        return None
    
    # ==================== Screenshots ====================
    
    def save_screenshot(self, task_id: str, index: int, data: bytes):
        """스크린샷 저장"""
        today = datetime.now().strftime("%Y-%m-%d")
        ss_dir = self.base / "screenshots" / today / task_id
        ss_dir.mkdir(parents=True, exist_ok=True)
        
        ss_file = ss_dir / f"{index:03d}.png"
        with open(ss_file, 'wb') as f:
            f.write(data)
        
        logger.debug(f"스크린샷 저장: {ss_file}")
        return str(ss_file)
    
    # ==================== Laixi Raw ====================
    
    def append_laixi_raw(self, message: Dict[str, Any]):
        """Laixi 메시지 원본 저장 (디버깅용)"""
        today = datetime.now().strftime("%Y-%m-%d")
        raw_dir = self.base / "laixi_raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        
        raw_file = raw_dir / f"ws_messages_{today}.jsonl"
        with open(raw_file, 'a', encoding='utf-8') as f:
            line = json.dumps({
                "ts": datetime.now(timezone.utc).isoformat(),
                "msg": message
            }, ensure_ascii=False)
            f.write(line + "\n")
    
    # ==================== Cleanup ====================
    
    async def cleanup_expired(self):
        """만료된 파일 삭제 (매시간 실행)"""
        now = datetime.now()
        deleted_count = 0
        
        for subdir, max_age in RETENTION_POLICY.items():
            dir_path = self.base / subdir
            if not dir_path.exists():
                continue
            
            cutoff = now - max_age
            
            for item in dir_path.iterdir():
                try:
                    # 파일/폴더 수정 시간 확인
                    mtime = datetime.fromtimestamp(item.stat().st_mtime)
                    
                    if mtime < cutoff:
                        if item.is_dir():
                            shutil.rmtree(item)
                        else:
                            item.unlink()
                        deleted_count += 1
                        logger.debug(f"삭제: {item}")
                except Exception as e:
                    logger.warning(f"삭제 실패: {item} - {e}")
        
        if deleted_count > 0:
            logger.info(f"Cleanup: {deleted_count}개 파일/폴더 삭제")
        
        return deleted_count
    
    async def start_cleanup_scheduler(self, interval_hours: int = 1):
        """Cleanup 스케줄러 시작"""
        while True:
            await asyncio.sleep(interval_hours * 3600)
            try:
                await self.cleanup_expired()
            except Exception as e:
                logger.error(f"Cleanup 에러: {e}")


# ============================================================
# Global Instance
# ============================================================

storage = StorageManager()


# ============================================================
# Essential Data Truncation
# ============================================================

def truncate_essential(raw_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Essential Data만 추출 (Supabase 대역폭 절약)
    - video_title: 50자
    - channel_name: 30자
    - error_message: 200자
    """
    return {
        "video_title": str(raw_result.get("title", ""))[:50] or None,
        "channel_name": str(raw_result.get("channel", ""))[:30] or None,
        "error_message": str(raw_result.get("error", ""))[:200] or None
    }


