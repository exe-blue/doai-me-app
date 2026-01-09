#!/bin/bash
# ============================================
# DoAi.Me Gateway - Device Initialization Script
# ============================================
# 역할: 폰보드 환경(배터리 없음)에서 Android 기기 초기화
# 대상: 20대 Galaxy S9
# 
# Orion 지시 (2024-12-30):
# - dumpsys deviceidle disable (Doze 모드 강제 삭제)
# - settings put global stay_on_while_plugged_in 3 (화면 항상 켜짐)
# - input keyevent 82 (잠금 해제 시도)
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 아이콘
ICON_OK="✅"
ICON_FAIL="❌"
ICON_WARN="⚠️"
ICON_INFO="ℹ️"
ICON_DEVICE="📱"
ICON_INIT="🔧"

# 로깅 함수
log_info() { echo -e "${BLUE}${ICON_INFO} [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${ICON_OK} [OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}${ICON_WARN} [WARN]${NC} $1"; }
log_error() { echo -e "${RED}${ICON_FAIL} [ERROR]${NC} $1"; }
log_device() { echo -e "${CYAN}${ICON_DEVICE} [DEVICE]${NC} $1"; }

# ============================================
# 단일 기기 초기화 함수 (Orion 핵심 지시)
# ============================================
init_single_device() {
    local DEVICE_ID=$1
    local SUCCESS=0
    local TOTAL=5

    echo ""
    log_device "기기 초기화: $DEVICE_ID"
    echo "────────────────────────────────────────"

    # 1. Doze 모드 강제 비활성화
    # 왜? 폰보드는 배터리가 없으므로 Doze 불필요, 오히려 작업 방해
    if adb -s "$DEVICE_ID" shell dumpsys deviceidle disable 2>/dev/null; then
        log_success "Doze 모드 비활성화"
        ((SUCCESS++))
    else
        log_warn "Doze 모드 비활성화 실패 (무시)"
        ((SUCCESS++))  # 일부 기기는 지원 안 함
    fi

    # 2. 화면 항상 켜짐 (충전 중)
    # 3 = USB + AC + Wireless 충전 시 모두 켜짐
    if adb -s "$DEVICE_ID" shell settings put global stay_on_while_plugged_in 3 2>/dev/null; then
        log_success "화면 항상 켜짐 설정"
        ((SUCCESS++))
    else
        log_error "화면 항상 켜짐 설정 실패"
    fi

    # 3. 잠금 해제 시도
    # KEYCODE_MENU (82)로 화면 깨우기 + 잠금 해제
    if adb -s "$DEVICE_ID" shell input keyevent 82 2>/dev/null; then
        log_success "잠금 해제 시도 (KEYCODE_MENU)"
        ((SUCCESS++))
    else
        log_warn "잠금 해제 시도 실패"
    fi

    # 4. 화면 밝기 최소화 (전력 효율)
    if adb -s "$DEVICE_ID" shell settings put system screen_brightness 10 2>/dev/null; then
        log_success "화면 밝기 최소화 (10/255)"
        ((SUCCESS++))
    else
        log_warn "화면 밝기 설정 실패"
    fi

    # 5. WiFi 절전 모드 비활성화
    # 2 = Never sleep
    if adb -s "$DEVICE_ID" shell settings put global wifi_sleep_policy 2 2>/dev/null; then
        log_success "WiFi 절전 모드 비활성화"
        ((SUCCESS++))
    else
        log_warn "WiFi 절전 모드 설정 실패"
    fi

    # 결과 출력
    echo "────────────────────────────────────────"
    if [ $SUCCESS -eq $TOTAL ]; then
        log_success "완료: $SUCCESS/$TOTAL 명령 성공"
    else
        log_warn "완료: $SUCCESS/$TOTAL 명령 성공"
    fi

    return 0
}

# ============================================
# 추가 최적화 함수 (선택적)
# ============================================
optimize_device() {
    local DEVICE_ID=$1

    log_info "추가 최적화: $DEVICE_ID"

    # AutoX.js 백그라운드 실행 허용
    adb -s "$DEVICE_ID" shell appops set org.autojs.autoxjs.v6 RUN_IN_BACKGROUND allow 2>/dev/null || true

    # 배터리 최적화 예외
    adb -s "$DEVICE_ID" shell dumpsys deviceidle whitelist +org.autojs.autoxjs.v6 2>/dev/null || true

    # 화면 꺼짐 시간 30분
    adb -s "$DEVICE_ID" shell settings put system screen_off_timeout 1800000 2>/dev/null || true

    # 애니메이션 스케일 끄기 (성능)
    adb -s "$DEVICE_ID" shell settings put global window_animation_scale 0 2>/dev/null || true
    adb -s "$DEVICE_ID" shell settings put global transition_animation_scale 0 2>/dev/null || true
    adb -s "$DEVICE_ID" shell settings put global animator_duration_scale 0 2>/dev/null || true

    log_success "추가 최적화 완료"
}

# ============================================
# 기기 상태 확인 함수
# ============================================
check_device_status() {
    local DEVICE_ID=$1

    echo ""
    echo "═══════════════════════════════════════════════"
    log_device "상태 확인: $DEVICE_ID"
    echo "═══════════════════════════════════════════════"

    echo ""
    echo "🔋 배터리:"
    adb -s "$DEVICE_ID" shell dumpsys battery 2>/dev/null | grep -E "level|status|plugged" | head -5 || echo "  정보 없음"

    echo ""
    echo "📺 화면 설정:"
    adb -s "$DEVICE_ID" shell settings get global stay_on_while_plugged_in 2>/dev/null | xargs -I {} echo "  stay_on_while_plugged_in: {}" || echo "  정보 없음"
    adb -s "$DEVICE_ID" shell settings get system screen_brightness 2>/dev/null | xargs -I {} echo "  screen_brightness: {}" || echo "  정보 없음"

    echo ""
    echo "💾 메모리:"
    adb -s "$DEVICE_ID" shell cat /proc/meminfo 2>/dev/null | grep -E "MemTotal|MemFree|MemAvailable" | head -3 || echo "  정보 없음"

    echo ""
    echo "📱 AutoX.js:"
    adb -s "$DEVICE_ID" shell "ps -A 2>/dev/null | grep -i autox" && echo "  ✅ 실행 중" || echo "  ❌ 미실행"

    echo ""
    echo "═══════════════════════════════════════════════"
}

# ============================================
# 연결된 모든 기기 목록
# ============================================
list_devices() {
    echo ""
    echo "═══════════════════════════════════════════════"
    log_info "연결된 기기 목록"
    echo "═══════════════════════════════════════════════"
    echo ""

    adb devices -l

    echo ""
    local COUNT=$(adb devices | grep -E "device$" | wc -l)
    log_info "총 ${COUNT}대 연결됨"
    echo ""
}

# ============================================
# 루프 실행 (모든 기기)
# ============================================
init_all_devices() {
    local DEVICES=$(adb devices | grep -E "device$" | awk '{print $1}')
    local COUNT=0
    local SUCCESS=0

    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║   ${ICON_INIT} DoAi.Me 기기 일괄 초기화           ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""

    for DEVICE_ID in $DEVICES; do
        COUNT=$((COUNT + 1))
        
        if init_single_device "$DEVICE_ID"; then
            SUCCESS=$((SUCCESS + 1))
        fi
    done

    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║   📊 초기화 결과                              ║"
    echo "╠═══════════════════════════════════════════════╣"
    echo "║   총 기기: $COUNT 대                           "
    echo "║   성공: $SUCCESS 대                            "
    echo "║   실패: $((COUNT - SUCCESS)) 대                "
    echo "╚═══════════════════════════════════════════════╝"
}

# ============================================
# 메인
# ============================================
main() {
    local COMMAND=${1:-"help"}

    case $COMMAND in
        init)
            # 모든 기기 초기화
            init_all_devices
            ;;

        init-one)
            # 특정 기기 초기화
            if [ -z "$2" ]; then
                log_error "기기 ID를 지정해주세요: ./init_devices.sh init-one <DEVICE_ID>"
                exit 1
            fi
            init_single_device "$2"
            ;;

        optimize)
            # 추가 최적화
            if [ -z "$2" ]; then
                # 모든 기기
                local DEVICES=$(adb devices | grep -E "device$" | awk '{print $1}')
                for DEVICE_ID in $DEVICES; do
                    optimize_device "$DEVICE_ID"
                done
            else
                optimize_device "$2"
            fi
            ;;

        status)
            # 상태 확인
            if [ -z "$2" ]; then
                local DEVICES=$(adb devices | grep -E "device$" | awk '{print $1}')
                for DEVICE_ID in $DEVICES; do
                    check_device_status "$DEVICE_ID"
                done
            else
                check_device_status "$2"
            fi
            ;;

        list)
            list_devices
            ;;

        loop)
            # 무한 루프로 초기화 (새 기기 연결 대비)
            log_info "루프 모드: 30초마다 새 기기 확인 및 초기화"
            while true; do
                init_all_devices
                log_info "30초 대기 중..."
                sleep 30
            done
            ;;

        help|*)
            echo ""
            echo "╔═══════════════════════════════════════════════╗"
            echo "║   🔧 DoAi.Me Gateway - Device Initialization  ║"
            echo "╚═══════════════════════════════════════════════╝"
            echo ""
            echo "사용법: ./init_devices.sh <command> [device_id]"
            echo ""
            echo "명령어:"
            echo "  init              모든 연결된 기기 초기화"
            echo "  init-one <id>     특정 기기만 초기화"
            echo "  optimize [id]     추가 최적화 (AutoX.js 권한 등)"
            echo "  status [id]       기기 상태 확인"
            echo "  list              연결된 기기 목록"
            echo "  loop              무한 루프 (새 기기 자동 초기화)"
            echo "  help              도움말"
            echo ""
            echo "예시:"
            echo "  ./init_devices.sh init"
            echo "  ./init_devices.sh init-one R3CN90XXXXX"
            echo "  ./init_devices.sh status"
            echo ""
            ;;
    esac
}

# 실행
main "$@"

