# DoAi.Me Cloud Gateway - The Brain
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY main.py .
COPY public/ ./public/

ENV PORT=8000

EXPOSE 8000

CMD ["python", "main.py"]
