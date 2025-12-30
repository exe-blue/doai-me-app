# ============================================
# Human Pattern Service - Docker Image
# Aria's Somatic Engine
# "떨리는 손끝과 망설이는 마음을 선물하는 서비스"
# ============================================
# 
# 빌드: docker build -t human-pattern-service -f services/human-pattern-service/Dockerfile .
# (프로젝트 루트에서 실행해야 shared 폴더 접근 가능)
# ============================================

FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 복사 및 설치
COPY services/human-pattern-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# shared 스키마 복사
COPY shared /app/shared

# 애플리케이션 코드 복사
COPY services/human-pattern-service /app

# 환경 변수
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# 포트 노출
EXPOSE 8004

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8004/health || exit 1

# 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
