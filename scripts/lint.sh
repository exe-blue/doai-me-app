#!/bin/bash
# ============================================
# DoAi.Me - 린트 실행 스크립트
# ============================================
# 용도: 코드 스타일 검사 및 자동 수정
# 실행: ./scripts/lint.sh [옵션]
# 옵션:
#   --check    : 수정 없이 검사만 (CI용)
#   --fix      : 자동 수정 (기본값)
# ============================================

set -e

echo "=========================================="
echo "🔍 DoAi.Me 린트 실행"
echo "=========================================="

# 옵션 파싱
CHECK_ONLY=false

for arg in "$@"; do
    case $arg in
        --check)
            CHECK_ONLY=true
            shift
            ;;
        --fix)
            CHECK_ONLY=false
            shift
            ;;
    esac
done

if [ "$CHECK_ONLY" = true ]; then
    echo "📋 검사 모드 (수정 없음)..."
    echo ""
    echo "▶ ruff check..."
    ruff check .
    echo ""
    echo "▶ black check..."
    black --check .
else
    echo "🔧 자동 수정 모드..."
    echo ""
    echo "▶ ruff fix..."
    ruff check . --fix
    echo ""
    echo "▶ black format..."
    black .
fi

echo ""
echo "=========================================="
echo "✅ 린트 완료!"
echo "=========================================="
