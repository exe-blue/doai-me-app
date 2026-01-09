#!/bin/bash
# Tailscale 설정 스크립트 (Vultr 서버용)
# 실행: ssh root@158.247.210.152 "bash -s" < setup_tailscale.sh

set -e

echo "=========================================="
echo "Tailscale 설치 및 설정"
echo "=========================================="

# 1. Tailscale 설치
echo "[1/3] Tailscale 설치..."
curl -fsSL https://tailscale.com/install.sh | sh

# 2. IP 포워딩 활성화 (idempotent)
echo "[2/3] IP 포워딩 활성화..."

# net.ipv4.ip_forward 설정
if grep -q '^net\.ipv4\.ip_forward' /etc/sysctl.conf; then
    sed -i 's/^net\.ipv4\.ip_forward.*/net.ipv4.ip_forward = 1/' /etc/sysctl.conf
    echo "  - net.ipv4.ip_forward: 기존 값 업데이트"
else
    echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.conf
    echo "  - net.ipv4.ip_forward: 새로 추가"
fi

# net.ipv6.conf.all.forwarding 설정
if grep -q '^net\.ipv6\.conf\.all\.forwarding' /etc/sysctl.conf; then
    sed -i 's/^net\.ipv6\.conf\.all\.forwarding.*/net.ipv6.conf.all.forwarding = 1/' /etc/sysctl.conf
    echo "  - net.ipv6.conf.all.forwarding: 기존 값 업데이트"
else
    echo 'net.ipv6.conf.all.forwarding = 1' >> /etc/sysctl.conf
    echo "  - net.ipv6.conf.all.forwarding: 새로 추가"
fi

sysctl -p

# 3. Tailscale 시작
echo "[3/3] Tailscale 시작..."
echo ""
echo "아래 명령어를 실행하여 Tailscale에 로그인하세요:"
echo ""
echo "  tailscale up --advertise-routes=10.0.0.0/8 --accept-routes"
echo ""
echo "브라우저에서 인증 URL을 열어 로그인하세요."
echo ""
echo "=========================================="
echo "설정 완료!"
echo "=========================================="