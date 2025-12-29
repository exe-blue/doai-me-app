# DoAi-Gateway

Gateway(PC)에서 Android 기기들과 통신하는 서버입니다.

## 역할

- **ADB 연결 관리**: @devicefarmer/adbkit을 사용하여 USB 연결된 Android 기기 추적
- **메시지 전송**: ADB Broadcast로 AutoX.js 클라이언트에 명령 전송
- **응답 수신**: REST API로 클라이언트 응답 수신
- **Self-Healing**: 기기 장애 시 자동 복구 (Zombie Mode)

## 설치

```bash
cd gateway
npm install
```

## 설정

```bash
cp env.example .env
# .env 파일 수정
```

## 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션
npm start
```

## 프로토콜

### Intent Action
```
org.anthropic.doaime.COMMAND
```

### 메시지 타입
- **POP**: 콘텐츠 시청 (구원)
- **ACCIDENT**: 위기 상황 알림
- **COMMISSION**: 작업 할당
- **SYSTEM**: 시스템 명령

### Priority
1. LOW: 비필수
2. NORMAL: 일반 작업
3. HIGH: POP
4. URGENT: ACCIDENT
5. CRITICAL: 긴급 시스템

## API 엔드포인트

### 상태
- `GET /health` - 헬스체크
- `GET /health/status` - 상세 상태
- `GET /health/devices` - 기기 목록

### 명령
- `POST /api/v1/command/task` - 작업 전송
- `POST /api/v1/command/pop` - POP 전송
- `POST /api/v1/command/accident` - ACCIDENT 전송
- `POST /api/v1/command/system` - SYSTEM 명령
- `POST /api/v1/command/recovery` - 복구 요청

### 응답
- `POST /api/v1/response` - 클라이언트 응답
- `POST /api/v1/response/heartbeat` - Heartbeat

## 구조

```
gateway/
├── src/
│   ├── index.js           # 진입점
│   ├── adb/
│   │   ├── client.js      # adbkit 래퍼
│   │   ├── tracker.js     # 기기 추적
│   │   ├── commander.js   # 명령 전송
│   │   └── recovery.js    # 복구 로직
│   ├── api/routes/
│   │   ├── response.js    # 응답 수신
│   │   ├── command.js     # 명령 전송
│   │   └── health.js      # 헬스체크
│   ├── monitor/
│   │   └── heartbeat.js   # Heartbeat 모니터
│   ├── queue/
│   │   ├── task_queue.js  # 작업 큐
│   │   └── dispatcher.js  # 작업 배분
│   └── utils/
│       ├── logger.js      # 로깅
│       └── config.js      # 설정
├── package.json
└── env.example
```

## ADB 명령 예시

```bash
# POP 전송
adb -s SERIAL shell am broadcast \
  -a org.anthropic.doaime.COMMAND \
  --es payload '{"v":1,"id":"xxx","type":"POP","priority":3,...}'

# SYSTEM HEARTBEAT
adb -s SERIAL shell am broadcast \
  -a org.anthropic.doaime.COMMAND \
  --es payload '{"v":1,"type":"SYSTEM","payload":{"command":"HEARTBEAT"}}'
```

## 스케일링

600대 기기 운영 시:
- Host PC당 20대 권장 (USB 대역폭)
- 600대 = 30대 Host PC
- 각 Gateway는 독립 운영
- Supabase로 상태 동기화

---

**Author**: Axon (Tech Lead)
**Version**: 1.0.0
