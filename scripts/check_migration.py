"""
DB Migration Status Check Script

YouTube Automation System Migration (002_youtube_automation.sql)

이 스크립트는 마이그레이션이 필요한 테이블의 존재 여부를 확인합니다.
실제 마이그레이션 실행은 Supabase Dashboard의 SQL Editor를 통해 수행하세요.

Usage:
    python scripts/check_migration.py
"""

import os
import sys
import io
from pathlib import Path

# UTF-8 출력 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# .env 로드
load_dotenv(project_root / ".env")

from supabase import create_client

def get_supabase_client():
    """Supabase 클라이언트 생성"""
    url = os.getenv("SUPABASE_URL")
    # Service Role Key 우선, 없으면 일반 Key
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
    
    return create_client(url, key)

def check_migration_status():
    """
    마이그레이션 상태 확인
    
    YouTube Automation 시스템에 필요한 테이블들이 존재하는지 확인합니다.
    실제 마이그레이션 실행은 Supabase Dashboard의 SQL Editor를 통해 수동으로 수행해야 합니다.
    
    Returns:
        bool: 모든 필수 테이블이 존재하면 True, 누락된 테이블이 있으면 False
    """
    print("=" * 60)
    print("[Status Check] YouTube Automation DB Migration")
    print("=" * 60)
    
    # SQL 파일 경로 확인
    migration_file = project_root / "shared" / "database" / "migrations" / "002_youtube_automation.sql"
    
    if not migration_file.exists():
        print(f"[ERROR] Migration file not found: {migration_file}")
        return False
    
    print(f"[INFO] Migration file: {migration_file}")
    print()
    
    # Supabase 클라이언트 연결 확인
    try:
        client = get_supabase_client()
        print("[OK] Supabase connected")
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        return False
    
    # 필수 테이블 목록 정의
    required_tables = ['video_queue', 'comment_pool', 'execution_logs', 'ai_search_logs', 'error_codes']
    
    print()
    print("[CHECK] Table status:")
    
    tables_exist = 0
    tables_missing = 0
    
    for table in required_tables:
        try:
            result = client.table(table).select("*", count="exact").limit(1).execute()
            count = result.count if result.count is not None else 0
            print(f"  [OK] {table}: {count} records")
            tables_exist += 1
        except Exception as e:
            error_str = str(e)
            if "does not exist" in error_str or "42P01" in error_str:
                print(f"  [MISSING] {table}: Table does not exist")
                tables_missing += 1
            else:
                print(f"  [ERROR] {table}: {e}")
    
    print()
    print("=" * 60)
    
    if tables_missing > 0:
        print(f"[RESULT] {tables_missing} tables need to be created.")
        print()
        print("[ACTION REQUIRED] Run the migration SQL manually:")
        print(f"   1. Go to Supabase Dashboard")
        print(f"   2. Select SQL Editor")
        print(f"   3. Copy and run: {migration_file.name}")
    else:
        print(f"[RESULT] All {tables_exist} required tables exist!")
    
    print("=" * 60)
    
    return tables_missing == 0

if __name__ == "__main__":
    try:
        success = check_migration_status()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
