#!/bin/bash
#
# DoAi.Me Node Recovery Script
# Strategos Security Design v1
#
# 사용법:
#   sudo /opt/doai/bin/recover.sh <mode>
#
# Modes:
#   soft      - ADB 재시작 + 에이전트 재시작 (Step 1)
#   restart   - 전체 서비스 재시작 + USB 스택 리프레시 (Step 2)
#   box_reset - 박스 전원 제어 요청 (Step 3, Orchestrator에서 실행)
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Invalid mode
#   3 - ADB server restart failed
#   4 - Service restart failed
#   5 - USB stack refresh failed
#

set -e

# === 설정 ===
DOAI_HOME="${DOAI_HOME:-/opt/doai}"
LOG_FILE="${DOAI_HOME}/logs/recover.log"
AGENT_SERVICE="doai-node"  # systemd 서비스 이름 또는 docker compose 서비스명
DOCKER_COMPOSE_FILE="${DOAI_HOME}/docker-compose.yml"

# 로깅 함수
log() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_error() {
    log "ERROR: $1"
}

log_info() {
    log "INFO: $1"
}

# === Soft Recovery (Step 1) ===
soft_recovery() {
    log_info "Starting SOFT recovery..."
    
    # 1. ADB 서버 재시작
    log_info "Restarting ADB server..."
    adb kill-server || true
    sleep 2
    adb start-server
    
    if ! adb devices &>/dev/null; then
        log_error "ADB server failed to start"
        return 3
    fi
    
    # ADB 디바이스 목록 확인
    local device_count=$(adb devices | grep -c "device$" || echo "0")
    log_info "ADB server restarted. Devices: $device_count"
    
    # 2. 에이전트 재시작
    log_info "Restarting agent service..."
    
    # systemd 사용 시
    if systemctl is-active --quiet "$AGENT_SERVICE" 2>/dev/null; then
        systemctl restart "$AGENT_SERVICE"
        log_info "Agent service restarted via systemd"
    # Docker Compose 사용 시
    elif [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$(dirname "$DOCKER_COMPOSE_FILE")"
        docker compose restart node-runner || docker-compose restart node-runner
        log_info "Agent service restarted via docker compose"
    # Python 직접 실행 시
    elif pgrep -f "noderunner.py" > /dev/null; then
        pkill -f "noderunner.py" || true
        sleep 2
        # 재시작은 supervisor/systemd에 맡김
        log_info "Agent process killed, expecting supervisor restart"
    else
        log_info "No running agent found, skip restart"
    fi
    
    log_info "SOFT recovery completed"
    return 0
}

# === Service Restart (Step 2) ===
restart_recovery() {
    log_info "Starting RESTART recovery..."
    
    # 1. 전체 서비스 중지
    log_info "Stopping all DoAi services..."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$(dirname "$DOCKER_COMPOSE_FILE")"
        docker compose down --timeout 30 || docker-compose down --timeout 30
        log_info "Docker services stopped"
    fi
    
    # systemd 서비스들 중지
    for svc in doai-node doai-gateway; do
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            systemctl stop "$svc"
            log_info "Stopped $svc"
        fi
    done
    
    # 2. USB 스택 리프레시 (Linux)
    log_info "Refreshing USB stack..."
    refresh_usb_stack
    
    # 3. ADB 재시작
    log_info "Restarting ADB server..."
    adb kill-server || true
    sleep 3
    adb start-server
    
    # 4. 전체 서비스 시작
    log_info "Starting all DoAi services..."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$(dirname "$DOCKER_COMPOSE_FILE")"
        docker compose up -d || docker-compose up -d
        log_info "Docker services started"
    fi
    
    for svc in doai-node doai-gateway; do
        if systemctl list-unit-files | grep -q "$svc"; then
            systemctl start "$svc"
            log_info "Started $svc"
        fi
    done
    
    # 5. 디바이스 인식 대기
    log_info "Waiting for devices to reconnect..."
    sleep 10
    
    local device_count=$(adb devices | grep -c "device$" || echo "0")
    log_info "RESTART recovery completed. Devices: $device_count"
    
    return 0
}

# === USB 스택 리프레시 ===
refresh_usb_stack() {
    # Linux USB 재바인딩
    if [ -d "/sys/bus/usb" ]; then
        log_info "Refreshing USB bus..."
        
        # udev 재로드
        if command -v udevadm &>/dev/null; then
            udevadm control --reload-rules
            udevadm trigger
            log_info "udev rules reloaded"
        fi
        
        # USB 호스트 컨트롤러 재스캔 (주의: 모든 USB 기기에 영향)
        # 필요 시 주석 해제
        # for host in /sys/bus/usb/devices/usb*; do
        #     if [ -e "$host/authorized" ]; then
        #         echo 0 > "$host/authorized"
        #         sleep 1
        #         echo 1 > "$host/authorized"
        #     fi
        # done
        
        return 0
    fi
    
    # Windows (WSL2가 아닌 경우)
    # USB 재스캔은 devcon 또는 pnputil 필요
    log_info "USB stack refresh not implemented for this OS"
    return 0
}

# === Box Reset (Step 3) ===
box_reset_recovery() {
    log_info "BOX_RESET requested - this should be executed by Orchestrator"
    
    # 이 스크립트에서 직접 박스 제어는 하지 않음
    # Orchestrator가 BoxClient를 통해 직접 제어
    # 여기서는 "박스 리셋 후 복구 준비" 작업만 수행
    
    # 1. 서비스 정리
    log_info "Preparing for box reset..."
    
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cd "$(dirname "$DOCKER_COMPOSE_FILE")"
        docker compose down --timeout 10 || true
    fi
    
    # 2. ADB 정리
    adb kill-server || true
    
    log_info "Node ready for box power cycle"
    log_info "Orchestrator will handle box TCP commands"
    
    return 0
}

# === 메인 ===
main() {
    local mode="${1:-soft}"
    
    # 로그 디렉토리 생성
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log_info "=========================================="
    log_info "Recovery script started: mode=$mode"
    log_info "=========================================="
    
    case "$mode" in
        soft)
            soft_recovery
            exit_code=$?
            ;;
        restart)
            restart_recovery
            exit_code=$?
            ;;
        box_reset|box)
            box_reset_recovery
            exit_code=$?
            ;;
        *)
            log_error "Invalid mode: $mode"
            echo "Usage: $0 <soft|restart|box_reset>"
            exit 2
            ;;
    esac
    
    log_info "Recovery completed with exit code: $exit_code"
    exit $exit_code
}

# 스크립트 실행
main "$@"

