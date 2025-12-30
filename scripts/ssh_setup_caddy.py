#!/usr/bin/env python3
"""
DoAi.Me Vultr VPS Caddy Setup Script
SSH로 접속하여 Caddy 설치 및 설정
"""

import paramiko
import time
import sys

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# VPS 접속 정보
HOST = "158.247.210.152"
USERNAME = "root"
PASSWORD = "Vq=96}7RaXagziR$"

def execute_command(ssh, command, timeout=120):
    """SSH 명령어 실행 및 결과 출력"""
    short_cmd = command[:80] + '...' if len(command) > 80 else command
    print(f"\n[CMD] {short_cmd}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    
    # 실시간 출력
    output = stdout.read().decode('utf-8', errors='ignore')
    error = stderr.read().decode('utf-8', errors='ignore')
    
    if output:
        print(output)
    if error and 'warning' not in error.lower():
        print(f"[WARN] {error}")
    
    return stdout.channel.recv_exit_status(), output, error

def main():
    print("=" * 60)
    print("[START] DoAi.Me Vultr VPS Caddy Setup")
    print("=" * 60)
    print(f"Server: {HOST}")
    print(f"User: {USERNAME}")
    print()
    
    # SSH 연결
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("[INFO] Connecting via SSH...")
        ssh.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
        print("[OK] SSH Connected!\n")
        
        # 1. 시스템 업데이트
        print("\n" + "=" * 40)
        print("[Step 1] System Update")
        print("=" * 40)
        execute_command(ssh, "apt update -y", timeout=180)
        
        # 2. 필수 패키지 설치
        print("\n" + "=" * 40)
        print("[Step 2] Install Dependencies")
        print("=" * 40)
        execute_command(ssh, "apt install -y debian-keyring debian-archive-keyring apt-transport-https curl", timeout=180)
        
        # 3. Caddy GPG 키 추가
        print("\n" + "=" * 40)
        print("[Step 3] Add Caddy GPG Key")
        print("=" * 40)
        execute_command(ssh, "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes")
        
        # 4. Caddy 저장소 추가
        print("\n" + "=" * 40)
        print("[Step 4] Add Caddy Repository")
        print("=" * 40)
        execute_command(ssh, "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list")
        
        # 5. Caddy 설치
        print("\n" + "=" * 40)
        print("[Step 5] Install Caddy")
        print("=" * 40)
        execute_command(ssh, "apt update -y && apt install -y caddy", timeout=180)
        
        # 6. Caddyfile 설정
        print("\n" + "=" * 40)
        print("[Step 6] Configure Caddyfile")
        print("=" * 40)
        
        caddyfile_content = '''api.doai.me {
    reverse_proxy localhost:8000
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
}

gateway.doai.me {
    reverse_proxy localhost:3100
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
}

n8n.doai.me {
    reverse_proxy localhost:5678
}
'''
        
        # Caddyfile 작성
        execute_command(ssh, f"cat > /etc/caddy/Caddyfile << 'EOF'\n{caddyfile_content}\nEOF")
        
        # 7. 방화벽 설정
        print("\n" + "=" * 40)
        print("[Step 7] Configure Firewall")
        print("=" * 40)
        execute_command(ssh, "ufw allow 80/tcp 2>/dev/null || true")
        execute_command(ssh, "ufw allow 443/tcp 2>/dev/null || true")
        
        # 8. Caddy 재시작
        print("\n" + "=" * 40)
        print("[Step 8] Restart Caddy Service")
        print("=" * 40)
        execute_command(ssh, "systemctl enable caddy")
        execute_command(ssh, "systemctl restart caddy")
        
        # 9. 상태 확인
        print("\n" + "=" * 40)
        print("[Step 9] Check Status")
        print("=" * 40)
        execute_command(ssh, "systemctl status caddy --no-pager")
        
        # 10. Caddyfile 확인
        print("\n" + "=" * 40)
        print("Current Caddyfile:")
        print("=" * 40)
        execute_command(ssh, "cat /etc/caddy/Caddyfile")
        
        print("\n" + "=" * 60)
        print("[SUCCESS] Caddy Installation Complete!")
        print("=" * 60)
        print("\nDomain Mapping:")
        print("   https://api.doai.me     -> localhost:8000 (FastAPI)")
        print("   https://gateway.doai.me -> localhost:3100 (Gateway)")
        print("   https://n8n.doai.me     -> localhost:5678 (n8n)")
        print("\nNOTE: SSL certificates will be auto-provisioned on first request")
        print("=" * 60)
        
    except paramiko.AuthenticationException:
        print("[ERROR] Authentication failed: Check password")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"[ERROR] SSH error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    finally:
        ssh.close()
        print("\n[INFO] SSH Connection Closed")

if __name__ == "__main__":
    main()
