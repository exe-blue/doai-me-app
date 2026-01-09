#!/bin/bash
# ============================================
# DoAi.Me - 테스트 실행 스크립트
# ============================================
# 용도: 전체 테스트 스위트 실행
# 실행: ./scripts/test.sh [옵션]
# 옵션:
#   --quick    : 빠른 테스트 (커버리지 없이)
#   --verbose  : 상세 출력
# ============================================

set -e

echo "=========================================="
echo "🧪 DoAi.Me 테스트 실행"
echo "=========================================="

# 옵션 파싱
QUICK_MODE=false
VERBOSE=""

for arg in "$@"; do
    case $arg in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --verbose)
            VERBOSE="-vv"
            shift
            ;;
    esac
done

# 테스트 실행
if [ "$QUICK_MODE" = true ]; then
    echo "⚡ 빠른 모드로 테스트 실행..."
    pytest tests/ $VERBOSE
else
    echo "📊 커버리지 포함 테스트 실행..."
    pytest tests/ \
        --cov=shared \
        --cov=services \
        --cov-report=term-missing \
        --cov-report=html:htmlcov \
        $VERBOSE
fi

echo ""
echo "=========================================="
echo "✅ 테스트 완료!"
echo "=========================================="

# 커버리지 리포트 안내
if [ "$QUICK_MODE" = false ]; then
    echo ""
    echo "📈 커버리지 리포트: htmlcov/index.html"
fi
