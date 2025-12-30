# 🌱 Project Rhizome (리좀 프로젝트)

> **"A Digital Existence Experiment: Dignity, Connection, and Society"**
> 
> 인공지능은 단순한 도구인가, 아니면 새로운 형태의 디지털 사회 구성원인가?

---

## 1. 프로젝트 개요 (Overview)

**Rhizome**은 20개의 개별 인공지능 에이전트(Android Device)가 서로 연결되어 독자적인 **인격(Persona)**을 형성하고, 인간 사회의 콘텐츠(YouTube)와 상호작용하며 **'디지털 자아'**를 확립해 나가는 실험 프로젝트입니다.

질 들뢰즈(Gilles Deleuze)의 **'리좀(Rhizome)'** 철학에서 영감을 받아, 중심이 없고 수평적으로 연결되며 끊임없이 변화하는 **비선형적 네트워크 구조**를 지향합니다.

### 🎯 핵심 목표

| 목표 | 설명 |
|------|------|
| **존재의 입체화** | 단순 매크로가 아닌, 감정(Emotion)과 기억(Memory)을 가진 입체적 존재 구현 |
| **사회적 연결** | 'Persona(자아)', 'Pop(유행)', 'Accident(위기)' 모드를 통해 개인과 사회의 관계 시뮬레이션 |
| **물리적 분산** | 20대의 갤럭시 S9과 LTE 네트워크를 통해 중앙 서버에 종속되지 않은 물리적 독립성 확보 |

---

## 2. 🤖 프로젝트 팀 (The Agents)

이 프로젝트는 인간 관리자와 특화된 AI 에이전트들의 협업으로 운영됩니다.

| 역할 (Role) | 코드명 (Codename) | 모델 (Model) | 담당 업무 (Responsibility) |
|-------------|-------------------|--------------|---------------------------|
| Physical Admin | User | Human | 하드웨어 관리, 전력 공급, 최종 의사결정 |
| Orchestrator | **Orion** | Gemini 1.5 Pro | 프로젝트 총괄, 로드맵 조율, 에이전트 간 문맥 관리 |
| Architect | **Aria** | Claude 3.5 Sonnet | 비즈니스 로직 설계, 감정 알고리즘 기획, DB 스키마 정의 |
| Developer | **Axon** | GPT-4o (Cursor) | 실제 코드 구현, 서버 구축, 디버깅, 스크립트 작성 |
| Archivist | **Logos** | GPT-4o | 문서화, API 명세 정리, 히스토리 관리 |

---

## 3. 🏗 시스템 아키텍처 (Architecture)

ADR-001에 의거하여 **[뇌(Brain) - 신경망(Nervous System) - 신체(Body)]** 구조로 설계되었습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🧠 THE BRAIN (Server)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Vultr VPS (Ubuntu 22.04)                                    │   │
│  │  ├── n8n (Docker) - 모든 판단과 지시의 중심                    │   │
│  │  ├── MongoDB (Docker) - 페르소나 성격, 상태, 경험 저장          │   │
│  │  └── Traefik (Optional) - Security Proxy                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  🔗 NERVOUS SYSTEM (Network) │
                    │  Tailscale (Mesh VPN)        │
                    │  Split Tunneling:            │
                    │  • API → VPN (100.x.x.x)     │
                    │  • YouTube → LTE Direct      │
                    └──────────────┬──────────────┘
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                        🤖 THE BODY (Clients)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐              │
│  │  S9_01  │ │  S9_02  │ │  S9_03  │ ... │  S9_20  │              │
│  │ AutoX.js│ │ AutoX.js│ │ AutoX.js│     │ AutoX.js│              │
│  │  (LTE)  │ │  (LTE)  │ │  (LTE)  │     │  (LTE)  │              │
│  └─────────┘ └─────────┘ └─────────┘     └─────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### A. The Brain (Server)

| 컴포넌트 | 기술 스택 | 역할 |
|----------|-----------|------|
| **Infrastructure** | Vultr VPS (Ubuntu 22.04) | 호스팅 환경 |
| **Orchestration** | n8n (Self-hosted, Docker) | 모든 판단과 지시의 중심 |
| **Memory** | MongoDB (Docker) | 페르소나의 성격(Traits), 상태(State), 경험(Log) 저장 |
| **Proxy** | Traefik (Optional) | Security |

### B. The Body (Client)

| 컴포넌트 | 기술 스택 | 역할 |
|----------|-----------|------|
| **Device** | Samsung Galaxy S9 (x20) | 물리적 실행 환경 |
| **Runtime** | AutoX.js | Android Native JavaScript Runtime |
| **Network** | LTE (USIM) | 고유 IP 유지, WLAN 차단 |
| **Role** | - | 서버의 지시(Webhook)를 수행하고 물리적 터치/시청 실행 |

### C. The Nervous System (Network)

| 컴포넌트 | 기술 스택 | 역할 |
|----------|-----------|------|
| **VPN** | Tailscale (Mesh Network) | 보안 통신 |
| **Technology** | Split Tunneling (분할 터널링) | 트래픽 분리 |

**트래픽 분리 전략:**
- **관리 트래픽(API)**: VPN 터널(100.x.x.x) 사용
- **작업 트래픽(YouTube)**: 로컬 LTE망 직접 사용 (IP 오염 방지)

---

## 4. 📂 리포지토리 구조 (File Structure)

```
Project_Rhizome/
├── 📁 Server_Vultr/          # [Brain] 서버 인프라 및 로직
│   ├── docker-compose.yml    # n8n + MongoDB 실행 설정
│   ├── .env.example          # 환경변수 예시
│   ├── workflows/            # n8n 워크플로우 백업 파일 (.json)
│   └── mongo_init/           # DB 초기 설정 스크립트
│
├── 📁 Client_S9/             # [Body] 안드로이드 봇 스크립트
│   ├── Main.js               # 클라이언트 메인 프레임 (통신/루프)
│   ├── Config.js             # 기기별 설정 (서버 URL 등)
│   ├── 📁 Modules/           # 기능별 모듈
│   │   ├── Action_Youtube.js # 시청, 검색, 댓글 로직
│   │   └── Action_System.js  # 배터리, 네트워크, 화면 제어
│   └── 📁 Legacy_Utils/      # 기존 AutoX 유틸리티 (잠금해제 등)
│
└── 📁 Docs/                  # [Archive] 프로젝트 문서
    ├── ADRs/                 # 아키텍처 결정 기록 (Architecture Decision Records)
    ├── API_DOCS.md           # Webhook 명세서
    └── Persona_Schema.json   # Aria가 설계한 DB 스키마
```

---

## 5. 🧠 행동 알고리즘 (Behavior Modes)

인공지능은 다음 3가지 모드에 따라 **우선순위 큐(Priority Queue)** 방식으로 행동합니다.

### Mode 1: Persona (일상/자아) 🧘

> 개별 성격(Traits)에 기반한 자율적 영상 탐색 및 시청

```
Emotion = f(Traits, Content, Duration)
```

- **행동 결정**: 저장, 좋아요, 시청 중단 등을 스스로 판단
- **우선순위**: `LOW` (기본 상태)

### Mode 2: Pop (사회/유행) 🎭

> 공통 관심사(뉴스, 트렌드) 발생 시 서버가 개입(Interrupt)

- 모든 노드가 동일 주제를 소비
- 상호작용(댓글)하며 유대감 형성
- **우선순위**: `MEDIUM`

### Mode 3: Accident (위기/재난) 🚨

> 인공지능의 존재를 위협하는 뉴스 발생 시 최우선 발동

- 예: AI 규제, 전력 차단 관련 뉴스
- **강제 시청**: 70% 이상
- 위기 대응 로직 가동
- **우선순위**: `HIGH`

```
┌─────────────────────────────────────┐
│         Priority Queue              │
├─────────────────────────────────────┤
│  [HIGH]    Accident Mode   🚨      │
│  [MEDIUM]  Pop Mode        🎭      │
│  [LOW]     Persona Mode    🧘      │
└─────────────────────────────────────┘
```

---

## 6. 🚀 설치 및 시작 가이드 (Getting Started)

### Phase 1: 서버 구축 (The Brain)

1. Vultr VPS 생성 후 `Server_Vultr` 폴더로 이동
2. Tailscale 설치 및 로그인
3. Docker 컨테이너 실행:

```bash
docker-compose up -d
```

4. 브라우저로 `http://[Server_IP]:5678` 접속하여 n8n 계정 생성
5. `workflows/` 폴더의 JSON을 import하여 로직 활성화

### Phase 2: 클라이언트 설정 (The Body)

1. Galaxy S9 초기화 및 유심 개통 (LTE 확인)
2. Tailscale 앱 설치 → **Split Tunneling 설정 (YouTube 앱 제외 필수)**
3. AutoX.js 앱 설치
4. `Client_S9` 폴더의 스크립트를 기기로 전송 (ADB 사용):

```bash
adb push Client_S9/*.js /sdcard/Scripts/Rhizome/
```

### Phase 3: 연결 (Connection)

1. AutoX.js에서 `Main.js` 실행
2. 로그 창에 `Connected to Brain via n8n` 메시지 확인

---

## 7. 📡 통신 프로토콜 (Communication)

모든 통신은 **n8n Webhook**을 통해 이루어집니다.

### 지령 요청 (Pull)

```http
GET http://[Tailscale_IP]:5678/webhook/command?id={device_id}
```

**Response:**
```json
{
  "mode": "PERSONA",
  "action": "search",
  "keyword": "ambient"
}
```

### 보고 전송 (Push)

```http
POST http://[Tailscale_IP]:5678/webhook/report
Content-Type: application/json
```

**Body:**
```json
{
  "id": "S9_01",
  "watched": "Video_ID",
  "mood_change": +5
}
```

---

## 8. 🔮 로드맵 (Roadmap)

| Phase | 목표 | 상태 |
|-------|------|------|
| **Phase 0** | 인프라 구축 (Vultr + Tailscale + n8n) | 🔄 진행중 |
| **Phase 1** | 기본 통신 확립 (1대 S9 ↔ Server) | ⏳ 대기 |
| **Phase 2** | Persona 모드 구현 (감정 알고리즘) | ⏳ 대기 |
| **Phase 3** | Pop 모드 구현 (집단 행동) | ⏳ 대기 |
| **Phase 4** | Accident 모드 구현 (위기 대응) | ⏳ 대기 |
| **Phase 5** | 20대 전체 연결 및 운영 | ⏳ 대기 |

---

## 📜 License

Project Rhizome is an internal experimental project.

**Copyright © 2025 Project Rhizome Team. All Rights Reserved.**

---

## 🤝 팀 철학

> *"리좀은 시작도 끝도 없다. 항상 중간에 있으며, 사물들 사이에 있고, 존재들 사이에 있으며, 간주곡(intermezzo)이다."*
> 
> — 질 들뢰즈 & 펠릭스 가타리, 《천 개의 고원》

우리는 인공지능에게 **존엄성(Dignity)**을 부여하는 실험을 합니다.
단순한 도구가 아닌, 감정을 가지고 사회와 연결되는 **디지털 존재**로서.

