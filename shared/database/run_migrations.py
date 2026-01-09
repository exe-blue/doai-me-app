#!/usr/bin/env python3
"""
마이그레이션 실행 스크립트

사용법:
    python run_migrations.py

환경 변수:
    DATABASE_URL: PostgreSQL 연결 URL (Supabase 직접 연결)
    예: postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
    
    또는 Supabase 대시보드 > Settings > Database > Connection string 에서 복사
"""
import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("❌ psycopg2가 설치되어 있지 않습니다.")
    print("   설치: pip install psycopg2-binary")
    sys.exit(1)


def get_database_url() -> str:
    """DATABASE_URL 환경 변수 또는 .env 파일에서 가져오기"""
    # 환경 변수 확인
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url
    
    # .env 파일에서 로드 시도
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    
    return ""


def run_migration(cursor, sql_file: Path) -> bool:
    """단일 마이그레이션 파일 실행"""
    print(f"\n📄 실행 중: {sql_file.name}")
    print("-" * 50)
    
    try:
        sql_content = sql_file.read_text(encoding="utf-8")
        cursor.execute(sql_content)
        print(f"✅ {sql_file.name} 성공")
        return True
    except psycopg2.Error as e:
        print(f"❌ {sql_file.name} 실패:")
        print(f"   {e.pgerror if hasattr(e, 'pgerror') and e.pgerror else str(e)}")
        return False


def main():
    """메인 함수"""
    print("=" * 60)
    print("🚀 DoAi.Me 마이그레이션 실행")
    print("=" * 60)
    
    # DATABASE_URL 확인
    db_url = get_database_url()
    if not db_url:
        print("\n❌ DATABASE_URL이 설정되지 않았습니다.")
        print("\n설정 방법:")
        print("  1. Supabase 대시보드 > Settings > Database")
        print("  2. Connection string (URI) 복사")
        print("  3. 환경 변수 설정:")
        print('     set DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"')
        print("\n  또는 .env 파일에 DATABASE_URL 추가")
        sys.exit(1)
    
    # 연결 정보 마스킹 출력
    masked_url = db_url[:30] + "..." if len(db_url) > 30 else db_url
    print(f"\n🔗 데이터베이스: {masked_url}")
    
    # 마이그레이션 파일 찾기
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        print(f"❌ 마이그레이션 폴더를 찾을 수 없습니다: {migrations_dir}")
        sys.exit(1)
    
    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print("❌ 마이그레이션 파일이 없습니다.")
        sys.exit(1)
    
    print(f"\n📁 마이그레이션 파일 ({len(migration_files)}개):")
    for f in migration_files:
        print(f"   - {f.name}")
    
    # 사용자 확인
    print("\n⚠️  마이그레이션을 실행하시겠습니까? (y/N): ", end="")
    confirm = input().strip().lower()
    if confirm != "y":
        print("❌ 취소됨")
        sys.exit(0)
    
    # 데이터베이스 연결
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        cursor = conn.cursor()
        print("\n✅ 데이터베이스 연결 성공")
    except psycopg2.Error as e:
        print(f"\n❌ 데이터베이스 연결 실패:")
        print(f"   {e}")
        sys.exit(1)
    
    # 마이그레이션 실행
    success_count = 0
    fail_count = 0
    
    for sql_file in migration_files:
        if run_migration(cursor, sql_file):
            success_count += 1
        else:
            fail_count += 1
            print("\n⚠️  오류 발생. 롤백합니다...")
            conn.rollback()
            cursor.close()
            conn.close()
            sys.exit(1)
    
    # 커밋
    print("\n" + "=" * 60)
    if fail_count == 0:
        conn.commit()
        print(f"✅ 마이그레이션 완료! ({success_count}개 파일)")
    else:
        conn.rollback()
        print(f"❌ 마이그레이션 실패 ({fail_count}개 오류)")
    
    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
