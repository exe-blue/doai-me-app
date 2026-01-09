# n8n Workflows for DoAi.Me

## 개요
DoAi.Me 프로젝트의 자동화 워크플로우를 관리합니다.

## 워크플로우 목록

### 1. Persona Existence Tick (`persona_existence_tick.json`)

**목적:** 페르소나 존재 상태를 주기적으로 업데이트

**기능:**
- 매 시간마다 `POST /api/personas/tick` 호출
- ACTIVE → WAITING → FADING → VOID 상태 전이 처리
- VOID 진입 시 `void_entered_at` 자동 설정
- 동화 진행, 고유성/가시성 감쇠 계산

**설정:**
- 실행 주기: 1시간
- 대상 페르소나: 최대 600개
- 타임아웃: 60초

## 워크플로우 가져오기

### 방법 1: n8n UI에서 Import

1. n8n 대시보드 접속
2. 좌측 메뉴 → **Workflows**
3. 우상단 **Add Workflow** → **Import from File**
4. `workflows/persona_existence_tick.json` 선택
5. **Import** 클릭

### 방법 2: n8n CLI 사용

```bash
# n8n 컨테이너에 접속
docker exec -it n8n sh

# 워크플로우 import
n8n import:workflow --input=/home/node/workflows/persona_existence_tick.json
```

### 방법 3: API 사용

```bash
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your-api-key" \
  -d @workflows/persona_existence_tick.json
```

## 환경 변수

워크플로우에서 사용하는 환경 변수:

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PERSONA_SERVICE_URL` | `http://persona-service:8006` | Persona Service API URL |

n8n 환경 변수 설정:
```env
# .env
PERSONA_SERVICE_URL=http://persona-service:8006
```

## 워크플로우 활성화

Import 후 워크플로우를 활성화해야 자동 실행됩니다:

1. n8n 대시보드에서 워크플로우 열기
2. 우상단 토글 스위치를 **Active**로 변경
3. 또는 API로 활성화:
   ```bash
   curl -X PATCH http://localhost:5678/api/v1/workflows/{workflow-id} \
     -H "Content-Type: application/json" \
     -H "X-N8N-API-KEY: your-api-key" \
     -d '{"active": true}'
   ```

## 수동 테스트

워크플로우를 수동으로 실행하여 테스트:

```bash
# Tick 엔드포인트 직접 호출
curl -X POST http://localhost:8006/api/personas/tick?limit=10

# 예상 응답:
# {
#   "success": true,
#   "processed": 10,
#   "transitionCount": 2,
#   "transitions": [...]
# }
```

## 모니터링

n8n 대시보드에서 실행 이력을 확인할 수 있습니다:
- **Executions** 탭에서 성공/실패 상태 확인
- 각 실행의 상세 로그 및 출력 데이터 확인

## 트러블슈팅

### 연결 실패
- Persona Service가 실행 중인지 확인
- 네트워크 연결 (Docker network) 확인
- `PERSONA_SERVICE_URL` 환경 변수 확인

### 타임아웃
- 페르소나 수가 많은 경우 `limit` 파라미터 조정
- `options.timeout` 값 증가 (기본 60초)

## Docker Compose 설정

```yaml
# docker-compose.yml에 추가
services:
  n8n:
    volumes:
      - ./workflows:/home/node/workflows:ro
    environment:
      - PERSONA_SERVICE_URL=http://persona-service:8006
```

