#!/usr/bin/env python3
"""n8n 문제 확인 및 수정"""

import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "158.247.210.152"
USERNAME = "root"
PASSWORD = "Vq=96}7RaXagziR$"

def execute_command(ssh, command, timeout=120):
    print(f"\n[CMD] {command[:100]}...")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    output = stdout.read().decode('utf-8', errors='ignore')
    error = stderr.read().decode('utf-8', errors='ignore')
    if output:
        print(output)
    if error:
        print(f"[STDERR] {error}")
    return stdout.channel.recv_exit_status(), output, error

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
        print("[OK] SSH Connected\n")
        
        # n8n 로그 확인
        print("=" * 50)
        print("[CHECK] n8n Container Logs")
        print("=" * 50)
        execute_command(ssh, "docker logs doai-n8n --tail 50 2>&1")
        
        # 데이터 디렉토리 권한 수정
        print("\n" + "=" * 50)
        print("[FIX] Fixing n8n data directory permissions")
        print("=" * 50)
        execute_command(ssh, "mkdir -p /opt/doai-me/data/n8n")
        execute_command(ssh, "chown -R 1000:1000 /opt/doai-me/data/n8n")
        execute_command(ssh, "chmod -R 755 /opt/doai-me/data/n8n")
        
        # n8n 재시작
        print("\n" + "=" * 50)
        print("[RESTART] Restarting n8n")
        print("=" * 50)
        execute_command(ssh, "cd /opt/doai-me/n8n && docker compose down && docker compose up -d")
        
        import time
        time.sleep(10)
        
        # 상태 확인
        print("\n" + "=" * 50)
        print("[CHECK] Final Status")
        print("=" * 50)
        execute_command(ssh, "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")
        
        print("\n" + "=" * 50)
        print("[CHECK] n8n logs after restart")
        print("=" * 50)
        execute_command(ssh, "docker logs doai-n8n --tail 20 2>&1")
        
    finally:
        ssh.close()
        print("\n[INFO] Done")

if __name__ == "__main__":
    main()



