# Runbook: 시스템 복구 (Emergency Recovery)

> **목적:** 시스템 장애 시 단계별 복구 절차
> **최종 수정:** 2026-01-04
> **담당:** @orion

---

## 🚨 3단계 비상 버튼 (Emergency Levels)

| Level | 이름 | 영향 범위 | 소요 시간 | 승인 |
|-------|------|----------|----------|------|
| **L1** | Soft Reset | 단일 서비스 | ~30초 | 자동 |
| **L2** | Service Reset | 전체 서비스 | ~2분 | 1단계 |
| **L3** | Box Reset | 하드웨어/인프라 | ~10분 | **2단계** |

---

## 📊 장애 판단 기준

### 자동 감지 (Metrics)
```yaml
health_check:
  endpoint: /health
  interval: 30s
  timeout: 10s
  failure_threshold: 3  # 3회 연속 실패 시 장애 판정

alerts:
  - name: orchestrator_down
    condition: health_check.failures >= 3
    action: notify_oncall
    
  - name: node_offline
    condition: node.last_heartbeat > 5m
    action: auto_reconnect
    
  - name: device_error_rate
    condition: error_rate > 10%
    action: notify_and_isolate
```

### 수동 판단 기준
| 증상 | Level | 즉시 조치 |
|------|-------|----------|
| API 응답 지연 (>5s) | L1 | Soft Reset |
| 서비스 무응답 | L2 | Service Reset |
| 서버 접속 불가 | L3 | Box Reset |
| 다수 노드 동시 오프라인 | L2 | Service Reset |
| 데이터베이스 연결 실패 | L2 | Service Reset |

---

## 🟢 Level 1: Soft Reset

### 적용 상황
- 단일 서비스 응답 지연
- 메모리 누수 의심
- 일시적 오류 증가

### 승인: 자동 (즉시 실행 가능)

### 절차

```bash
# 1. 상태 확인 (타임아웃: 10초)
curl -sf --max-time 10 https://api.doai.me/health || echo "HEALTH_CHECK_FAILED"

# 2. 서비스 재시작
ssh root@<vultr-tailscale-ip> << 'EOF'
    systemctl restart doai-orchestrator
    sleep 5
    systemctl status doai-orchestrator --no-pager
EOF

# 3. 검증 (타임아웃: 30초)
for i in {1..6}; do
    if curl -sf https://api.doai.me/health; then
        echo "✅ L1 복구 성공"
        exit 0
    fi
    sleep 5
done
echo "❌ L1 복구 실패 → L2 진행"
```

### 성공/실패 기준
| 결과 | 조건 | 다음 단계 |
|------|------|----------|
| ✅ 성공 | `/health` 응답 200 OK (30초 내) | 모니터링 계속 |
| ❌ 실패 | 30초 내 응답 없음 | L2로 escalate |

### 로그 기록
```bash
# 자동 로그 기록
echo "[$(date -Iseconds)] L1_SOFT_RESET: $RESULT" >> /var/log/doai/emergency.log
```

---

## 🟡 Level 2: Service Reset

### 적용 상황
- L1 실패 후
- 전체 서비스 스택 문제
- 데이터베이스 연결 문제
- 다수 노드 연결 끊김

### 승인: 1단계 (운영자 확인 필요)

```
┌─────────────────────────────────────────┐
│  ⚠️  SERVICE RESET CONFIRMATION         │
│                                         │
│  영향: 모든 연결된 노드 일시 중단       │
│  예상 복구 시간: ~2분                   │
│                                         │
│  [CONFIRM] 코드 입력: ______            │
│                                         │
│  승인자: ______________                 │
└─────────────────────────────────────────┘
```

### 승인 코드 생성
```bash
# 일회용 승인 코드 (6자리)
CONFIRM_CODE=$(openssl rand -hex 3 | tr 'a-f' 'A-F')
echo "승인 코드: $CONFIRM_CODE (유효시간: 5분)"
```

### 절차

```bash
#!/bin/bash
# L2 Service Reset Script
# 사용법: ./l2_reset.sh <confirm_code>

CONFIRM_CODE=$1
LOG_FILE="/var/log/doai/emergency.log"
TIMESTAMP=$(date -Iseconds)

# 승인 코드 검증
if [ -z "$CONFIRM_CODE" ]; then
    echo "❌ 승인 코드 필요: ./l2_reset.sh <code>"
    exit 1
fi

log_event() {
    echo "[$TIMESTAMP] L2_SERVICE_RESET: $1" >> $LOG_FILE
}

log_event "START - Confirm: $CONFIRM_CODE"

# 1. 현재 상태 스냅샷 (타임아웃: 30초)
echo "📸 상태 스냅샷 저장 중..."
ssh root@<vultr-tailscale-ip> << 'EOF'
    mkdir -p /var/log/doai/snapshots
    SNAP_DIR="/var/log/doai/snapshots/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $SNAP_DIR
    
    # 로그 백업
    journalctl -u doai-orchestrator -n 1000 --no-pager > $SNAP_DIR/orchestrator.log
    journalctl -u caddy -n 200 --no-pager > $SNAP_DIR/caddy.log
    
    # 프로세스 상태
    ps aux > $SNAP_DIR/processes.txt
    netstat -tlnp > $SNAP_DIR/ports.txt
    
    echo "스냅샷 저장: $SNAP_DIR"
EOF

log_event "SNAPSHOT_SAVED"

# 2. 전체 서비스 중지
echo "🛑 서비스 중지 중..."
ssh root@<vultr-tailscale-ip> << 'EOF'
    systemctl stop doai-orchestrator
    systemctl stop caddy
    sleep 3
EOF

log_event "SERVICES_STOPPED"

# 3. 캐시/임시 파일 정리
echo "🧹 캐시 정리 중..."
ssh root@<vultr-tailscale-ip> << 'EOF'
    # Python 캐시
    find /opt/aifarm -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
    
    # 임시 파일
    rm -rf /tmp/doai_* 2>/dev/null
EOF

log_event "CACHE_CLEARED"

# 4. 서비스 재시작
echo "🔄 서비스 재시작 중..."
ssh root@<vultr-tailscale-ip> << 'EOF'
    systemctl start caddy
    sleep 2
    systemctl start doai-orchestrator
    sleep 5
EOF

log_event "SERVICES_RESTARTED"

# 5. 검증 (타임아웃: 2분)
echo "✅ 검증 중..."
SUCCESS=false
for i in {1..24}; do
    if curl -sf https://api.doai.me/health; then
        SUCCESS=true
        break
    fi
    sleep 5
done

if [ "$SUCCESS" = true ]; then
    log_event "SUCCESS"
    echo "✅ L2 복구 성공!"
    exit 0
else
    log_event "FAILED - Escalate to L3"
    echo "❌ L2 복구 실패 → L3 필요"
    exit 1
fi
```

### 성공/실패 기준
| 결과 | 조건 | 다음 단계 |
|------|------|----------|
| ✅ 성공 | 2분 내 서비스 정상화 + 노드 재연결 시작 | 모니터링 강화 |
| ❌ 실패 | 2분 내 응답 없음 | **L3로 escalate** |

---

## 🔴 Level 3: Box Reset (하드웨어 복구)

### 적용 상황
- L2 실패 후
- 서버 SSH 접속 불가
- 심각한 시스템 오류
- 보안 침해 의심

### ⚠️ 승인: 2단계 (Two-Step Verification)

```
┌─────────────────────────────────────────────────────┐
│  🔴 BOX RESET - TWO-STEP VERIFICATION               │
│                                                     │
│  ⚠️  경고: 이 작업은 서버를 완전히 재시작합니다     │
│  ⚠️  모든 연결이 끊기고 데이터 손실 가능성 있음     │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  STEP 1: 1차 승인자                                 │
│    이름: ______________                             │
│    코드: ______ (6자리)                             │
│    시간: ______________                             │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  STEP 2: 2차 승인자 (1차와 다른 사람)               │
│    이름: ______________                             │
│    코드: ______ (6자리)                             │
│    시간: ______________                             │
│                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  사유: ________________________________________     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2단계 승인 프로세스

```bash
#!/bin/bash
# L3 Box Reset - Two-Step Verification
# 사용법: ./l3_reset.sh

LOG_FILE="/var/log/doai/emergency.log"
TIMESTAMP=$(date -Iseconds)

log_event() {
    echo "[$TIMESTAMP] L3_BOX_RESET: $1" >> $LOG_FILE
}

echo "🔴 L3 BOX RESET - 2단계 승인 필요"
echo "=================================="
echo ""

# STEP 1: 1차 승인
echo "STEP 1: 1차 승인자 정보 입력"
read -p "  1차 승인자 이름: " APPROVER1
read -p "  1차 승인 코드 (6자리): " CODE1

# 코드 검증 (실제로는 서버에서 검증)
if [ ${#CODE1} -ne 6 ]; then
    echo "❌ 잘못된 코드 형식"
    exit 1
fi

log_event "STEP1_APPROVED by $APPROVER1"
echo "✅ STEP 1 승인 완료"
echo ""

# 대기 시간 (의도적 지연)
echo "⏳ 2차 승인 대기 중... (30초)"
sleep 30

# STEP 2: 2차 승인
echo "STEP 2: 2차 승인자 정보 입력"
read -p "  2차 승인자 이름: " APPROVER2
read -p "  2차 승인 코드 (6자리): " CODE2

# 같은 승인자 방지
if [ "$APPROVER1" = "$APPROVER2" ]; then
    echo "❌ 1차와 다른 승인자 필요"
    log_event "STEP2_REJECTED - Same approver"
    exit 1
fi

log_event "STEP2_APPROVED by $APPROVER2"
echo "✅ STEP 2 승인 완료"
echo ""

# 사유 기록
read -p "  복구 사유: " REASON
log_event "REASON: $REASON"

# 최종 확인
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Box Reset 요약"
echo "  1차 승인: $APPROVER1"
echo "  2차 승인: $APPROVER2"
echo "  사유: $REASON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "최종 실행? (yes 입력): " FINAL

if [ "$FINAL" != "yes" ]; then
    echo "❌ 취소됨"
    log_event "CANCELLED by user"
    exit 1
fi

log_event "EXECUTING"
echo ""
echo "🔴 Box Reset 실행 중..."
```

### 절차

```bash
# === L3 Box Reset 실행 절차 ===

# 1. 현재 상태 전체 백업 (가능한 경우)
echo "📸 전체 상태 백업 중..."
ssh root@<vultr-tailscale-ip> << 'EOF' 2>/dev/null || true
    BACKUP_DIR="/var/backups/doai/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # 설정 파일 백업
    cp -r /etc/doai $BACKUP_DIR/
    cp /etc/caddy/Caddyfile $BACKUP_DIR/
    
    # 로그 백업
    cp -r /var/log/doai $BACKUP_DIR/logs/
    
    # 데이터베이스는 Supabase에 있으므로 별도 백업 불필요
    
    echo "백업 완료: $BACKUP_DIR"
EOF

# 2. Vultr API로 서버 재부팅
echo "🔄 서버 재부팅 요청..."
# Vultr API 호출 (또는 콘솔에서 수동)
# curl -X POST "https://api.vultr.com/v2/instances/<instance-id>/reboot" \
#      -H "Authorization: Bearer $VULTR_API_KEY"

# 수동의 경우:
echo "⚠️ Vultr 콘솔에서 수동 재부팅:"
echo "   https://my.vultr.com/subs/?id=<instance-id>"
echo ""
read -p "재부팅 완료 후 Enter..."

# 3. 서버 복구 대기 (타임아웃: 10분)
echo "⏳ 서버 복구 대기 중..."
SUCCESS=false
for i in {1..60}; do
    echo -n "."
    if ssh -o ConnectTimeout=5 root@<vultr-tailscale-ip> "echo OK" 2>/dev/null; then
        echo ""
        echo "✅ SSH 연결 복구됨"
        SUCCESS=true
        break
    fi
    sleep 10
done

if [ "$SUCCESS" = false ]; then
    echo "❌ SSH 연결 실패 (10분 초과)"
    echo "⚠️ Vultr 콘솔에서 상태 확인 필요"
    exit 1
fi

# 4. 서비스 시작
echo "🚀 서비스 시작 중..."
ssh root@<vultr-tailscale-ip> << 'EOF'
    systemctl start caddy
    sleep 2
    systemctl start doai-orchestrator
    sleep 5
    
    # 상태 확인
    systemctl status caddy --no-pager
    systemctl status doai-orchestrator --no-pager
EOF

# 5. 최종 검증
echo "✅ 최종 검증..."
for i in {1..12}; do
    if curl -sf https://api.doai.me/health; then
        echo "✅ L3 Box Reset 완료!"
        exit 0
    fi
    sleep 10
done

echo "❌ 서비스 복구 실패 - 수동 점검 필요"
exit 1
```

### 성공/실패 기준
| 결과 | 조건 | 다음 단계 |
|------|------|----------|
| ✅ 성공 | 10분 내 SSH + 서비스 정상화 | 장애 보고서 작성 |
| ❌ 실패 | 10분 초과 | **Vultr 지원 요청 / 새 인스턴스** |

---

## 📋 로그 기록 형식

모든 복구 작업은 `/var/log/doai/emergency.log`에 기록됩니다.

### 로그 형식
```
[ISO8601_TIMESTAMP] LEVEL_ACTION: MESSAGE
```

### 예시
```
[2026-01-04T15:30:00+09:00] L1_SOFT_RESET: START
[2026-01-04T15:30:05+09:00] L1_SOFT_RESET: SERVICE_RESTARTED
[2026-01-04T15:30:35+09:00] L1_SOFT_RESET: FAILED - Escalate to L2
[2026-01-04T15:31:00+09:00] L2_SERVICE_RESET: START - Confirm: A3B2C1
[2026-01-04T15:31:10+09:00] L2_SERVICE_RESET: STEP1_APPROVED by orion
[2026-01-04T15:33:00+09:00] L2_SERVICE_RESET: SUCCESS
```

### 로그 보존
```bash
# 로그 로테이션 설정 (/etc/logrotate.d/doai)
/var/log/doai/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## 📊 복구 후 체크리스트

### 즉시 (복구 직후)
- [ ] `/health` 엔드포인트 정상 응답
- [ ] WebSocket 연결 수락 가능
- [ ] 노드 재연결 시작됨

### 10분 후
- [ ] 활성 노드 50% 이상 재연결
- [ ] API 응답 시간 정상 (<500ms)
- [ ] 에러율 정상 (<1%)

### 1시간 후
- [ ] 모든 노드 재연결 완료
- [ ] 작업 큐 정상 처리
- [ ] 장애 보고서 초안 작성

---

## 📝 장애 보고서 템플릿

복구 완료 후 `orion/incidents/YYYY-MM-DD-*.md` 파일 생성:

```markdown
# Incident: [제목]

## 요약
- 발생: YYYY-MM-DD HH:MM
- 해결: YYYY-MM-DD HH:MM
- 영향 시간: X분
- 복구 레벨: L1/L2/L3

## 타임라인
| 시간 | 이벤트 |
|------|--------|
| | |

## 근본 원인
(분석 내용)

## 재발 방지
- [ ] (조치 항목)
```

---

## 🔗 관련 문서

- [Caddy 설정](./caddy.md)
- [Tailscale 설정](./tailscale.md)
- [ADB 문제해결](./adb.md)
- [API 명세](../../docs/api.md)
- [Incident 템플릿](../incidents/template.md)
