#!/bin/bash
# ============================================
# DoAi.Me - 개발 환경 초기 설정
# ============================================
# 용도: 새 개발자 온보딩 또는 환경 초기화
# 실행: ./scripts/setup.sh
# ============================================

set -e

echo "=========================================="
echo "🚀 DoAi.Me 개발 환경 설정 시작"
echo "=========================================="

# Python 버전 확인
echo "📌 Python 버전 확인..."
python --version || python3 --version

# 가상환경 생성 (없는 경우)
if [ ! -d ".venv" ]; then
    echo "📦 가상환경 생성 중..."
    python -m venv .venv || python3 -m venv .venv
fi

# 가상환경 활성화
echo "🔄 가상환경 활성화..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

# 의존성 설치
echo "📥 의존성 설치 중..."
pip install --upgrade pip
pip install -e ".[dev]"

# pre-commit 훅 설치
echo "🔧 pre-commit 훅 설치 중..."
pre-commit install

# 환경 변수 파일 확인
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        echo "📝 .env 파일 생성 중 (env.example 복사)..."
        cp env.example .env
        echo "⚠️  .env 파일을 열어 필요한 값을 설정하세요!"
    else
        echo "⚠️  env.example 파일이 없습니다. .env 파일을 수동으로 생성하세요."
    fi
fi

echo ""
echo "=========================================="
echo "✅ 개발 환경 설정 완료!"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "  1. source .venv/bin/activate (또는 .venv\\Scripts\\activate)"
echo "  2. .env 파일 설정 확인"
echo "  3. ./scripts/test.sh 실행하여 테스트 확인"
echo ""
