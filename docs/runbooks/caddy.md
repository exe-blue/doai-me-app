# Runbook: Caddy 설정

> Caddy 리버스 프록시 설정 및 문제해결

## 기본 설정

### Caddyfile 위치
```
/etc/caddy/Caddyfile
```

### 기본 구성
```caddyfile
api.doai.me {
    reverse_proxy localhost:8000
    
    log {
        output file /var/log/caddy/api.log
        format json
    }
}
```

---

## 명령어

### 상태 확인
```bash
systemctl status caddy
caddy validate --config /etc/caddy/Caddyfile
```

### 설정 리로드 (무중단)
```bash
systemctl reload caddy
```

### 재시작
```bash
systemctl restart caddy
```

### 로그 확인
```bash
journalctl -u caddy -f
tail -f /var/log/caddy/api.log
```

---

## 일반적인 문제

### 1. SSL 인증서 발급 실패

**증상:** HTTPS 접속 불가, 인증서 오류

**원인:** 
- DNS가 아직 전파되지 않음
- 방화벽이 80/443 포트 차단

**해결:**
```bash
# DNS 확인
dig api.doai.me

# 방화벽 확인
ufw status
ufw allow 80
ufw allow 443

# Caddy 재시작 (인증서 재발급 시도)
systemctl restart caddy
```

### 2. 502 Bad Gateway

**증상:** 502 오류 반환

**원인:** 백엔드(Orchestrator)가 응답하지 않음

**해결:**
```bash
# Orchestrator 상태 확인
systemctl status doai-orchestrator

# 포트 리슨 확인
ss -tlnp | grep 8000

# Orchestrator 재시작
systemctl restart doai-orchestrator
```

### 3. WebSocket 연결 실패

**증상:** 노드 연결이 끊김

**원인:** WebSocket 업그레이드 설정 누락

**해결:** Caddyfile에 WebSocket 지원 확인
```caddyfile
api.doai.me {
    reverse_proxy localhost:8000 {
        # WebSocket은 기본 지원됨
        # 추가 설정이 필요한 경우:
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## 설정 변경 절차

1. 백업
```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
```

2. 수정
```bash
vim /etc/caddy/Caddyfile
```

3. 검증
```bash
caddy validate --config /etc/caddy/Caddyfile
```

4. 적용
```bash
systemctl reload caddy
```

5. 확인
```bash
curl -I https://api.doai.me/health
```

---

## 관련 문서

- [시스템 복구](./recover.md)
- [Caddy 공식 문서](https://caddyserver.com/docs/)

