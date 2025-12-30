# DoAi.Me Control Room: Appsmith 설정 가이드

**Version**: 1.0  
**Date**: 2025-01-15  
**Author**: Axon (Tech Lead)

---

## 1. 개요

Aria 명세서에 따라 UI를 Appsmith에 위임하고 Gateway는 순수 백엔드 역할만 수행합니다.

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Appsmith-Centric Control Room                      │
├─────────────────────────────────────────────────────────────────────┤
│   Appsmith (UI) ──REST API──▶ Gateway (Backend) ──ADB──▶ Devices   │
│        │                            │                              │
│        └───────Iframe───────▶ Stream Endpoint                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 서비스 시작

```bash
# Docker Compose로 전체 서비스 시작
docker-compose up -d

# 개별 서비스 확인
docker-compose ps
```

### 포트 구성

| 서비스 | 포트 | 용도 |
|--------|------|------|
| Gateway | 3100 | REST API + WebSocket Stream |
| Appsmith | 8080 | 대시보드 UI |
| n8n | 5678 | 워크플로우 자동화 |
| Backend API | 8000 | 복잡한 계산 |

---

## 3. Appsmith 초기 설정

### 3.1 접속

1. 브라우저에서 `http://localhost:8080` 접속
2. 초기 관리자 계정 생성 (또는 환경변수로 설정된 계정 사용)

### 3.2 Datasource 생성

**Gateway REST API Datasource:**

1. `Settings` → `Datasources` → `+ New Datasource`
2. `REST API` 선택
3. 설정:
   - **Name**: `DoAi Gateway`
   - **URL**: `http://doai-gateway:3100` (Docker 내부) 또는 `http://localhost:3100` (로컬)
   - **Authentication**: None

---

## 4. API 엔드포인트 요약

### Device API

```
GET  /api/devices              - 모든 기기 목록
GET  /api/devices/:id          - 단일 기기 상세
GET  /api/devices/:id/state    - 기기 state.json
```

### Control API

```
POST /api/control/:id/touch        - 터치 이벤트
POST /api/control/:id/key          - 키 입력
GET  /api/control/:id/screenshot   - 스크린샷
POST /api/control/:id/restart-autox - AutoX.js 재시작
```

### Dispatch API

```
POST /api/dispatch             - 메시지 전송
GET  /api/dispatch/templates   - 메시지 템플릿
```

### Files API

```
GET  /api/files/:id/list?path=...     - 디렉토리 목록
GET  /api/files/:id/read?path=...     - 파일 읽기
GET  /api/files/:id/download?path=... - 파일 다운로드
GET  /api/files/:id/tail?path=...     - 로그 tail
```

### Stream

```
GET  /stream/:device_id/view          - Iframe용 스트림 페이지
WS   /stream/:device_id/ws            - WebSocket 스트림
GET  /stream/scrcpy-client.js         - 디코더 스크립트
```

---

## 5. Appsmith Query 설정

### 5.1 GetDevices

```javascript
// API Query 설정
Name: GetDevices
Method: GET
URL: {{ env.GATEWAY_URL }}/api/devices
Run on Page Load: Yes
Auto Refresh: 30 seconds
```

### 5.2 GetSelectedDevice

```javascript
Name: GetSelectedDevice
Method: GET
URL: {{ env.GATEWAY_URL }}/api/devices/{{ Table_Devices.selectedRow.device_id }}
Trigger: Table_Devices.onRowSelected
```

### 5.3 SendDilemma

```javascript
Name: SendDilemma
Method: POST
URL: {{ env.GATEWAY_URL }}/api/dispatch
Body:
{
  "target": "{{ Table_Devices.selectedRow.device_id }}",
  "message": {
    "type": "DILEMMA_COMMISSION",
    "priority": 2,
    "payload": {{ JSON.parse(TextArea_Message.text) }}
  }
}
```

### 5.4 GetFiles

```javascript
Name: GetFiles
Method: GET
URL: {{ env.GATEWAY_URL }}/api/files/{{ selected_device }}/list
Params: path={{ current_path || '/sdcard/doai' }}
```

### 5.5 TailLogs

```javascript
Name: TailLogs
Method: GET  
URL: {{ env.GATEWAY_URL }}/api/files/{{ selected_device }}/tail
Params: path=/sdcard/doai/logs/{{ moment().format('YYYY-MM-DD') }}.log&lines=30
Auto Refresh: 5 seconds
```

---

## 6. 위젯 구성

### 6.1 Device List (Table Widget)

```javascript
// Table Data
{{ GetDevices.data.devices }}

// Columns
- name: {{ currentRow.ai_citizen?.name || 'Unknown' }}
- existence_state: {{ currentRow.ai_citizen?.existence_state }}
- E(t): {{ (currentRow.metrics?.existence_score * 100).toFixed(0) }}%
- status: {{ currentRow.connection.status }}
```

### 6.2 Device Stream (Iframe Widget)

```javascript
// Iframe URL
{{ env.GATEWAY_URL }}/stream/{{ Table_Devices.selectedRow.device_id }}/view?quality=medium&showStatus=true

// 또는 터치 가능 버전
{{ env.GATEWAY_URL }}/stream/{{ Table_Devices.selectedRow.device_id }}/view?quality=high&touchable=true
```

### 6.3 Control Buttons

```javascript
// Send DILEMMA Button onClick
{{ SendDilemma.run() }}

// Send ACCIDENT Button onClick  
{{ SendAccident.run() }}

// Restart AutoX.js Button onClick
{{ RestartAutoX.run() }}
```

### 6.4 Live Logs (Text Widget)

```javascript
// Text Content
{{ TailLogs.data.lines?.join('\n') || 'No logs' }}

// Style
Font: Monospace
Background: #1a1a1a
Color: #00ff00
```

---

## 7. 환경 변수

Appsmith에서 환경 변수 설정:

```javascript
// Settings → General → Environment Variables
GATEWAY_URL = http://doai-gateway:3100  // Docker 내부
// 또는
GATEWAY_URL = http://192.168.1.100:3100  // 로컬 IP
```

---

## 8. 문제 해결

### CORS 오류

Gateway의 CORS 설정이 Appsmith 도메인을 허용하는지 확인:

```javascript
// gateway/src/index.js
app.use(cors({
    origin: [
        'http://localhost:8080',
        'http://doai-appsmith',
        // Appsmith 도메인 추가
    ]
}));
```

### 스트림이 표시되지 않음

1. WebSocket 연결 확인: 브라우저 개발자 도구 → Network → WS
2. 기기 연결 상태 확인: `GET /api/devices`
3. Scrcpy 설치 확인 (호스트)

### API 응답 없음

1. Gateway 컨테이너 로그 확인: `docker logs doai-gateway`
2. 네트워크 연결 확인: `docker network inspect doai-net`

---

## 9. 보안 고려사항

1. **프로덕션 환경**에서는 Appsmith에 SSL 인증서 설정
2. **API 인증** 추가 권장 (JWT 또는 API Key)
3. **파일 접근 제한**: `/sdcard/doai/**` 경로만 허용됨

---

## 10. 참고 자료

- [Appsmith 공식 문서](https://docs.appsmith.com/)
- [Aria 명세서: Appsmith Integration Architecture](../ARCHITECTURE.md)
- [Gateway API 상세](./GATEWAY_API.md)

