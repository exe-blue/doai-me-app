#!/bin/bash
#
# DoAi.Me Tailscale Setup Script
# Strategos Security Design v1
#
# 사용법:
#   # Orchestrator (Vultr)
#   sudo ./setup_tailscale.sh --role orchestrator --auth-key tskey-xxx
#
#   # Node (로컬 미니PC)
#   sudo ./setup_tailscale.sh --role node --auth-key tskey-xxx
#
# Auth Key는 Tailscale Admin Console에서 발급:
# - Reusable: No (1회성)
# - Expiry: 1시간
# - Pre-authorized: Yes
# - Tags: tag:node 또는 tag:orchestrator
#

set -e

# === 파라미터 파싱 ===
ROLE=""
AUTH_KEY=""
HOSTNAME_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --role)
            ROLE="$2"
            shift 2
            ;;
        --auth-key)
            AUTH_KEY="$2"
            shift 2
            ;;
        --hostname)
            HOSTNAME_OVERRIDE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$ROLE" ] || [ -z "$AUTH_KEY" ]; then
    echo "Usage: $0 --role <orchestrator|node> --auth-key <tskey-xxx>"
    exit 1
fi

# === 설정 ===
LOG_FILE="/var/log/tailscale-setup.log"

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "$LOG_FILE"
}

# === Tailscale 설치 ===
install_tailscale() {
    log "Installing Tailscale..."
    
    # Debian/Ubuntu
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://tailscale.com/install.sh | sh
    # RHEL/CentOS/Fedora
    elif command -v dnf &>/dev/null; then
        curl -fsSL https://tailscale.com/install.sh | sh
    elif command -v yum &>/dev/null; then
        curl -fsSL https://tailscale.com/install.sh | sh
    else
        log "Unsupported package manager"
        exit 1
    fi
    
    log "Tailscale installed"
}

# === Tailscale 설정 ===
configure_tailscale() {
    log "Configuring Tailscale for role: $ROLE"
    
    # 호스트명 결정
    local hostname="${HOSTNAME_OVERRIDE:-$(hostname)}"
    
    case "$ROLE" in
        orchestrator)
            # Orchestrator 설정
            # - 모든 노드에 접근 가능
            # - SSH 활성화
            tailscale up \
                --authkey="$AUTH_KEY" \
                --hostname="doai-orchestrator-${hostname}" \
                --advertise-tags="tag:orchestrator,tag:logserver" \
                --ssh \
                --accept-routes
            ;;
        node)
            # Node 설정
            # - Orchestrator/Admin만 접근 가능
            # - SSH 활성화
            tailscale up \
                --authkey="$AUTH_KEY" \
                --hostname="doai-node-${hostname}" \
                --advertise-tags="tag:node" \
                --ssh \
                --accept-routes
            ;;
        *)
            log "Invalid role: $ROLE"
            exit 1
            ;;
    esac
    
    log "Tailscale configured with role: $ROLE"
}

# === 방화벽 설정 ===
configure_firewall() {
    log "Configuring firewall..."
    
    # UFW (Ubuntu)
    if command -v ufw &>/dev/null; then
        # Tailscale 인터페이스 허용
        ufw allow in on tailscale0
        
        # SSH는 Tailscale에서만 허용 (선택적)
        # ufw allow from 100.64.0.0/10 to any port 22
        
        log "UFW configured for Tailscale"
    fi
    
    # firewalld (CentOS/Fedora)
    if command -v firewall-cmd &>/dev/null; then
        firewall-cmd --zone=trusted --add-interface=tailscale0 --permanent
        firewall-cmd --reload
        log "firewalld configured for Tailscale"
    fi
}

# === doaiops 사용자 생성 ===
create_doaiops_user() {
    if [ "$ROLE" != "node" ]; then
        return
    fi
    
    log "Creating doaiops user..."
    
    if ! id -u doaiops &>/dev/null; then
        useradd -m -s /bin/bash doaiops
        
        # sudo 권한 (NOPASSWD)
        echo "doaiops ALL=(ALL) NOPASSWD: /opt/doai/bin/recover.sh" > /etc/sudoers.d/doaiops
        chmod 440 /etc/sudoers.d/doaiops
        
        log "doaiops user created with sudo access to recover.sh"
    else
        log "doaiops user already exists"
    fi
}

# === recover.sh 설치 ===
install_recover_script() {
    if [ "$ROLE" != "node" ]; then
        return
    fi
    
    log "Installing recover.sh..."
    
    mkdir -p /opt/doai/bin
    mkdir -p /opt/doai/logs
    
    # recover.sh 복사 (이 스크립트와 같은 디렉토리에 있다고 가정)
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    if [ -f "$SCRIPT_DIR/recover.sh" ]; then
        cp "$SCRIPT_DIR/recover.sh" /opt/doai/bin/
        chmod +x /opt/doai/bin/recover.sh
        log "recover.sh installed to /opt/doai/bin/"
    else
        log "WARNING: recover.sh not found in $SCRIPT_DIR"
    fi
}

# === 연결 확인 ===
verify_connection() {
    log "Verifying Tailscale connection..."
    
    # 상태 확인
    tailscale status
    
    # IP 확인
    local ts_ip=$(tailscale ip -4)
    log "Tailscale IP: $ts_ip"
    
    # Orchestrator 연결 테스트 (노드인 경우)
    if [ "$ROLE" == "node" ]; then
        log "To verify connection from orchestrator, run:"
        log "  ssh doaiops@$ts_ip 'echo ok'"
    fi
}

# === 메인 ===
main() {
    log "=========================================="
    log "Tailscale Setup - Role: $ROLE"
    log "=========================================="
    
    # Tailscale 설치 (이미 설치되어 있으면 스킵)
    if ! command -v tailscale &>/dev/null; then
        install_tailscale
    else
        log "Tailscale already installed"
    fi
    
    # Tailscale 설정
    configure_tailscale
    
    # 방화벽 설정
    configure_firewall
    
    # 노드 전용 설정
    if [ "$ROLE" == "node" ]; then
        create_doaiops_user
        install_recover_script
    fi
    
    # 연결 확인
    verify_connection
    
    log "=========================================="
    log "Tailscale setup completed successfully"
    log "=========================================="
}

main

