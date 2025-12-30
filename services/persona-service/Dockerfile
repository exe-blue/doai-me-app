# ============================================
# Persona Service - Docker Image
# ADR-005 v2: The Void of Irrelevance
# ============================================
#
# 빌드: docker build -t persona-service -f services/persona-service/Dockerfile .
# (프로젝트 루트에서 실행)
# ============================================

FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 복사 및 설치
COPY services/persona-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY services/persona-service/*.py .

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

# 환경 변수
ENV PYTHONUNBUFFERED=1
ENV PERSONA_DB_PATH=/app/data/personas.db

# 포트 노출
EXPOSE 8006

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

# 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006"]
