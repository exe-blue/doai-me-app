# Runbook: Tailscale 설정

> Tailscale VPN 설정 및 문제해결

## 개요

Tailscale은 노드와 Vultr 서버 간 안전한 통신을 위해 사용됩니다.

---

## 설치

### Linux (Ubuntu)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Windows
- https://tailscale.com/download 에서 설치

---

## 기본 명령어

### 상태 확인
```bash
tailscale status
```

### 연결 (인터랙티브)
```bash
tailscale up
```

### 연결 (Auth Key 사용)
```bash
tailscale up --authkey=tskey-auth-xxxxx
```

### 연결 해제
```bash
tailscale down
```

### IP 확인
```bash
tailscale ip -4
```

---

## Auth Key 생성

1. https://login.tailscale.com/admin/settings/keys
2. "Generate auth key" 클릭
3. 옵션 선택:
   - **Reusable:** 여러 기기에서 사용 (노드용)
   - **Ephemeral:** 기기가 꺼지면 자동 삭제
   - **Tags:** 접근 제어용 태그 (예: `tag:node`, `tag:server`)

---

## ACL 설정 (접근 제어)

### 기본 ACL 예시
```json
{
  "acls": [
    // 서버는 모든 곳에 접근 가능
    {"action": "accept", "src": ["tag:server"], "dst": ["*:*"]},
    
    // 노드는 서버에만 접근 가능
    {"action": "accept", "src": ["tag:node"], "dst": ["tag:server:*"]},
    
    // 관리자는 모든 곳에 접근 가능
    {"action": "accept", "src": ["autogroup:admin"], "dst": ["*:*"]}
  ],
  "tagOwners": {
    "tag:server": ["autogroup:admin"],
    "tag:node": ["autogroup:admin"]
  }
}
```

---

## 일반적인 문제

### 1. 연결 실패 - "Login expired"

**증상:** `tailscale up` 실행 시 로그인 만료

**해결:**
```bash
tailscale logout
tailscale up
# 브라우저에서 재인증
```

### 2. 연결 실패 - Auth Key 문제

**증상:** Auth key가 작동하지 않음

**원인:**
- Key 만료됨
- Key 사용 횟수 초과 (non-reusable)

**해결:**
- 새 Auth Key 생성
- Reusable key 사용

### 3. 연결은 되지만 통신 안됨

**증상:** `tailscale status`는 OK지만 ping 실패

**원인:**
- ACL이 트래픽 차단
- 방화벽 문제

**해결:**
```bash
# 연결 테스트
tailscale ping <peer-ip>

# ACL 확인
# Tailscale Admin Console > Access Controls

# 로컬 방화벽 확인
ufw status
```

### 4. DNS 해석 실패

**증상:** MagicDNS 이름으로 접속 안됨

**해결:**
```bash
# MagicDNS 상태 확인
tailscale status

# 직접 IP로 테스트
tailscale ip -4 <hostname>
ping <ip>
```

---

## 서버 설정

### Vultr Orchestrator
```bash
# 태그와 함께 연결
tailscale up --authkey=tskey-auth-xxxxx --advertise-tags=tag:server
```

### 노드
```bash
# 노드 태그로 연결
tailscale up --authkey=tskey-auth-xxxxx --advertise-tags=tag:node
```

---

## 모니터링

### 연결된 기기 목록
```bash
tailscale status --json | jq '.Peer | keys'
```

### 특정 기기 상태
```bash
tailscale status --json | jq '.Peer["<node-id>"]'
```

---

## 자동 시작

### Systemd (Linux)
```bash
# 이미 설정되어 있음
systemctl status tailscaled
systemctl enable tailscaled
```

### Windows
- 기본적으로 자동 시작 설정됨
- 서비스 관리자에서 "Tailscale" 확인

---

## 관련 문서

- [시스템 복구](./recover.md)
- [Tailscale 공식 문서](https://tailscale.com/kb/)

