# 🧠 Server_Vultr - The Brain

> Project Rhizome의 중앙 서버 (n8n + MongoDB)

## 📋 구성 요소

| 서비스 | 포트 | 역할 |
|--------|------|------|
| **n8n** | 5678 | 워크플로우 오케스트레이션 (Webhook) |
| **MongoDB** | 27017 | 페르소나 데이터 저장 |
| **Mongo Express** | 8081 | DB 웹 UI (개발용) |
| **Traefik** | 80/443/8080 | 리버스 프록시 (선택) |

## 🚀 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env
nano .env  # 비밀번호 변경 필수!
```

### 2. 서비스 시작

```bash
# 기본 실행 (n8n + MongoDB)
docker-compose up -d

# 개발 모드 (+ Mongo Express)
docker-compose --profile dev up -d

# 프록시 포함 (+ Traefik)
docker-compose --profile proxy up -d

# 전체 실행
docker-compose --profile dev --profile proxy up -d
```

### 3. 접속 확인

```bash
# n8n 웹 UI
http://[SERVER_IP]:5678

# MongoDB (Mongo Express - 개발 모드)
http://[SERVER_IP]:8081

# 헬스 체크
curl http://localhost:5678/healthz
```

## 📁 폴더 구조

```
Server_Vultr/
├── docker-compose.yml      # 메인 컨테이너 설정
├── .env.example            # 환경변수 템플릿
├── .env                    # 실제 환경변수 (Git 제외)
├── workflows/              # n8n 워크플로우 백업
│   └── .gitkeep
├── mongo_init/             # MongoDB 초기화 스크립트
│   └── 01_init_rhizome.js  # 컬렉션 & 인덱스 생성
└── README.md
```

## 🗄️ MongoDB 스키마

### Collections

| 컬렉션 | 용도 |
|--------|------|
| `personas` | 페르소나 정보 (성격, 상태, 선호도) |
| `experiences` | 경험 로그 (시청, 좋아요, 댓글 등) |
| `commands` | 서버→클라이언트 명령 큐 |
| `events` | Pop/Accident 이벤트 |
| `metrics` | 통계 데이터 |

### 주요 필드

```javascript
// Persona 예시
{
  device_id: "S9_01",
  name: "Echo",
  traits: {
    curiosity: 75,    // 호기심
    patience: 60,     // 인내심
    sociability: 45,  // 사교성
    creativity: 80,   // 창의성
    caution: 50       // 신중함
  },
  state: {
    mood: 0,          // -100 ~ +100
    energy: 100,      // 0 ~ 100
    focus: 70         // 0 ~ 100
  }
}
```

## 📡 Webhook 엔드포인트

n8n에서 생성할 Webhook URL:

| 용도 | 메서드 | 경로 |
|------|--------|------|
| 명령 요청 | GET | `/webhook/command?id={device_id}` |
| 보고 전송 | POST | `/webhook/report` |
| 상태 체크 | GET | `/webhook/status` |

## 🔒 보안 체크리스트

- [ ] `.env` 파일의 모든 비밀번호 변경
- [ ] N8N_ENCRYPTION_KEY를 32자 이상으로 설정
- [ ] 방화벽에서 필요한 포트만 개방 (5678, 27017)
- [ ] Tailscale VPN을 통해서만 접근 허용
- [ ] 프로덕션에서 Mongo Express 비활성화

## 🛠️ 유용한 명령어

```bash
# 로그 확인
docker-compose logs -f n8n
docker-compose logs -f mongo

# 서비스 재시작
docker-compose restart n8n

# MongoDB 쉘 접속
docker exec -it rhizome-memory-mongo mongosh -u rhizome_admin -p

# 볼륨 백업
docker run --rm -v rhizome-mongo-data:/data -v $(pwd):/backup alpine tar cvf /backup/mongo_backup.tar /data

# 완전 초기화 (주의!)
docker-compose down -v
```

## 📚 참고 문서

- [n8n Documentation](https://docs.n8n.io/)
- [MongoDB Manual](https://www.mongodb.com/docs/manual/)
- [Project Rhizome README](../docs/RHIZOME_README.md)

