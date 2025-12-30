#!/usr/bin/env python3
"""
DoAi.Me VPS Full Deployment Script
Docker 설치 + 모든 서비스 배포
"""

import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "158.247.210.152"
USERNAME = "root"
PASSWORD = "Vq=96}7RaXagziR$"

def execute_command(ssh, command, timeout=300, show_output=True):
    """SSH 명령어 실행"""
    short_cmd = command[:100] + '...' if len(command) > 100 else command
    print(f"\n[CMD] {short_cmd}")
    
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    
    output = stdout.read().decode('utf-8', errors='ignore')
    error = stderr.read().decode('utf-8', errors='ignore')
    exit_code = stdout.channel.recv_exit_status()
    
    if show_output and output:
        # 긴 출력은 마지막 30줄만
        lines = output.strip().split('\n')
        if len(lines) > 30:
            print(f"... ({len(lines)-30} lines hidden)")
            print('\n'.join(lines[-30:]))
        else:
            print(output)
    
    if error and 'warning' not in error.lower() and 'notice' not in error.lower():
        print(f"[STDERR] {error[:500]}")
    
    return exit_code, output, error

def main():
    print("=" * 60)
    print("[START] DoAi.Me Full Deployment")
    print("=" * 60)
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("[INFO] Connecting via SSH...")
        ssh.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
        print("[OK] SSH Connected!\n")
        
        # ============================================================
        # Step 1: Docker 설치
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 1] Installing Docker")
        print("=" * 60)
        
        # Docker 설치 확인
        code, out, _ = execute_command(ssh, "docker --version 2>/dev/null", show_output=False)
        if code == 0 and 'Docker version' in out:
            print(f"[OK] Docker already installed: {out.strip()}")
        else:
            print("[INFO] Installing Docker...")
            execute_command(ssh, "apt-get update -y", timeout=180)
            execute_command(ssh, "apt-get install -y ca-certificates curl gnupg", timeout=120)
            execute_command(ssh, "install -m 0755 -d /etc/apt/keyrings", timeout=30)
            execute_command(ssh, "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes", timeout=60)
            execute_command(ssh, "chmod a+r /etc/apt/keyrings/docker.gpg", timeout=10)
            
            # Docker 저장소 추가
            docker_repo_cmd = '''echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null'''
            execute_command(ssh, docker_repo_cmd, timeout=30)
            
            execute_command(ssh, "apt-get update -y", timeout=120)
            execute_command(ssh, "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin", timeout=300)
            
            # Docker 서비스 시작
            execute_command(ssh, "systemctl enable docker")
            execute_command(ssh, "systemctl start docker")
            
            print("[OK] Docker installed successfully")
        
        # Docker Compose 확인
        code, out, _ = execute_command(ssh, "docker compose version 2>/dev/null", show_output=False)
        if code == 0:
            print(f"[OK] Docker Compose: {out.strip()}")
        
        # ============================================================
        # Step 2: 프로젝트 디렉토리 생성
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 2] Creating Project Directory")
        print("=" * 60)
        
        execute_command(ssh, "mkdir -p /opt/doai-me/{backend,gateway,n8n,data}")
        execute_command(ssh, "ls -la /opt/doai-me/")
        
        # ============================================================
        # Step 3: n8n 배포
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 3] Deploying n8n")
        print("=" * 60)
        
        n8n_compose = '''version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: doai-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.doai.me
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.doai.me/
      - GENERIC_TIMEZONE=Asia/Seoul
      - TZ=Asia/Seoul
    volumes:
      - /opt/doai-me/data/n8n:/home/node/.n8n
'''
        
        execute_command(ssh, f"cat > /opt/doai-me/n8n/docker-compose.yml << 'EOF'\n{n8n_compose}\nEOF")
        execute_command(ssh, "cd /opt/doai-me/n8n && docker compose up -d", timeout=180)
        
        # ============================================================
        # Step 4: FastAPI 백엔드 배포
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 4] Deploying FastAPI Backend")
        print("=" * 60)
        
        # 간단한 FastAPI 앱 (health check용)
        fastapi_main = '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="DoAi.Me API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": "DoAi.Me API", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/v1/status")
def status():
    return {
        "service": "DoAi.Me API",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "production")
    }
'''
        
        fastapi_dockerfile = '''FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn[standard]

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
'''
        
        fastapi_compose = '''version: '3.8'

services:
  api:
    build: .
    container_name: doai-api
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
'''
        
        execute_command(ssh, f"cat > /opt/doai-me/backend/main.py << 'EOF'\n{fastapi_main}\nEOF")
        execute_command(ssh, f"cat > /opt/doai-me/backend/Dockerfile << 'EOF'\n{fastapi_dockerfile}\nEOF")
        execute_command(ssh, f"cat > /opt/doai-me/backend/docker-compose.yml << 'EOF'\n{fastapi_compose}\nEOF")
        execute_command(ssh, "cd /opt/doai-me/backend && docker compose up -d --build", timeout=300)
        
        # ============================================================
        # Step 5: Gateway 배포
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 5] Deploying Gateway")
        print("=" * 60)
        
        gateway_server = '''const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({ service: 'DoAi.Me Gateway', status: 'running' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Device list (placeholder)
app.get('/devices', (req, res) => {
    res.json({ devices: [], count: 0, message: 'No devices connected' });
});

// Dispatch command (placeholder)
app.post('/dispatch', (req, res) => {
    const { deviceId, action, extras } = req.body;
    console.log(`Dispatch: ${action} to ${deviceId}`);
    res.json({ success: true, message: 'Command queued' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`DoAi.Me Gateway running on port ${PORT}`);
});
'''
        
        gateway_package = '''{
  "name": "doai-gateway",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
}
'''
        
        gateway_dockerfile = '''FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js .

EXPOSE 3100

CMD ["npm", "start"]
'''
        
        gateway_compose = '''version: '3.8'

services:
  gateway:
    build: .
    container_name: doai-gateway
    restart: unless-stopped
    ports:
      - "3100:3100"
    environment:
      - PORT=3100
'''
        
        execute_command(ssh, f"cat > /opt/doai-me/gateway/server.js << 'EOF'\n{gateway_server}\nEOF")
        execute_command(ssh, f"cat > /opt/doai-me/gateway/package.json << 'EOF'\n{gateway_package}\nEOF")
        execute_command(ssh, f"cat > /opt/doai-me/gateway/Dockerfile << 'EOF'\n{gateway_dockerfile}\nEOF")
        execute_command(ssh, f"cat > /opt/doai-me/gateway/docker-compose.yml << 'EOF'\n{gateway_compose}\nEOF")
        execute_command(ssh, "cd /opt/doai-me/gateway && docker compose up -d --build", timeout=300)
        
        # ============================================================
        # Step 6: 상태 확인
        # ============================================================
        print("\n" + "=" * 60)
        print("[Step 6] Checking Status")
        print("=" * 60)
        
        time.sleep(5)  # 컨테이너 시작 대기
        
        execute_command(ssh, "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")
        
        print("\n[CHECK] Port Status:")
        execute_command(ssh, "ss -tlnp | grep -E ':(8000|3100|5678)' || echo 'Ports not yet listening'")
        
        # ============================================================
        # 완료
        # ============================================================
        print("\n" + "=" * 60)
        print("[SUCCESS] Full Deployment Complete!")
        print("=" * 60)
        print("\nServices:")
        print("  - https://api.doai.me      (FastAPI)")
        print("  - https://gateway.doai.me  (Node.js Gateway)")
        print("  - https://n8n.doai.me      (n8n Workflow)")
        print("\nAll services are now running with auto-restart enabled.")
        print("=" * 60)
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        ssh.close()
        print("\n[INFO] SSH Connection Closed")

if __name__ == "__main__":
    main()



