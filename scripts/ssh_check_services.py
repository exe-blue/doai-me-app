#!/usr/bin/env python3
"""
DoAi.Me VPS 서비스 상태 확인
"""

import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "158.247.210.152"
USERNAME = "root"
PASSWORD = "Vq=96}7RaXagziR$"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
        print("[OK] SSH Connected\n")
        
        print("=" * 50)
        print("[CHECK] Port Status on VPS")
        print("=" * 50)
        
        # 포트 상태 확인
        stdin, stdout, stderr = ssh.exec_command("ss -tlnp | grep -E ':(8000|3100|5678)'")
        output = stdout.read().decode()
        
        if output:
            print(output)
        else:
            print("[WARN] No services listening on ports 8000, 3100, 5678")
        
        print("\n" + "=" * 50)
        print("[CHECK] Docker Containers")
        print("=" * 50)
        
        stdin, stdout, stderr = ssh.exec_command("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'Docker not running or not installed'")
        print(stdout.read().decode())
        
        print("=" * 50)
        print("[CHECK] Caddy Status")
        print("=" * 50)
        
        stdin, stdout, stderr = ssh.exec_command("systemctl is-active caddy")
        status = stdout.read().decode().strip()
        print(f"Caddy: {status}")
        
    finally:
        ssh.close()

if __name__ == "__main__":
    main()



