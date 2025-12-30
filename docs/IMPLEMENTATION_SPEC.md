# DoAi.Me Implementation Spec v1.0

**Version**: 1.0  
**Date**: 2025-01-15  
**Author**: Aria (Architect Agent)  
**Directive From**: Orion  
**Target**: Axon (Developer Agent)  
**Purpose**: 연쇄적 의존성 검사를 통해 발견된 누락된 로직(Missing Logic) 정의

---

# Table of Contents

1. [Birth & Sync: 탄생과 동기화](#1-birth--sync-탄생과-동기화)
2. [Content Verification: POP & Accident 검증](#2-content-verification-pop--accident-검증)
3. [Economy & Proof: 경제 활동과 증명](#3-economy--proof-경제-활동과-증명)
4. [Admin Input Forms: 관리자 입력 폼 스펙](#4-admin-input-forms-관리자-입력-폼-스펙)

---

# 1. Birth & Sync: 탄생과 동기화

## 1.1 Create Persona Logic

### 1.1.1 Trigger Condition

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PERSONA CREATION TRIGGER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Discovery Service                                                 │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────────────────┐                                           │
│   │ New Device Detected │                                           │
│   │ (ADB Serial Found)  │                                           │
│   └──────────┬──────────┘                                           │
│              │                                                      │
│              ▼                                                      │
│   ┌─────────────────────┐    YES    ┌─────────────────────┐         │
│   │ Query DB by Serial  │──────────▶│ Load Existing       │         │
│   │ EXISTS?             │           │ Persona from DB     │         │
│   └──────────┬──────────┘           └─────────────────────┘         │
│              │ NO                                                   │
│              ▼                                                      │
│   ┌─────────────────────┐                                           │
│   │ CREATE NEW PERSONA  │◀── This is the logic to define           │
│   └─────────────────────┘                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1.2 Persona Generation Algorithm

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PERSONA GENERATION FORMULA                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   INPUT:                                                            │
│   ─────────────────────────────────────────────────────────────     │
│   device_serial: string      // e.g., "192.168.0.101:5555"          │
│   device_model: string       // e.g., "SM-G960N"                    │
│   connection_type: enum      // USB | WIFI | LAN                    │
│                                                                     │
│                                                                     │
│   STEP 1: Generate UUID                                             │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   citizen_id = UUID_v4()                                            │
│   // Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"                │
│                                                                     │
│                                                                     │
│   STEP 2: Generate Name (Korean Name Pool)                          │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   FIRST_NAMES = [                                                   │
│     "민준", "서연", "예준", "서윤", "도윤", "지우", "시우", "하은", │
│     "주원", "하윤", "지호", "은서", "준서", "민서", "유준", "지아", │
│     "현우", "채원", "지민", "소율", "건우", "아인", "우진", "소윤", │
│     "선우", "나윤", "민재", "유나", "현준", "윤서", "서준", "지유", │
│     "승우", "다은", "준혁", "수아", "예성", "예린", "도현", "시아"  │
│   ]                                                                 │
│                                                                     │
│   LAST_NAMES = [                                                    │
│     "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",     │
│     "한", "오", "서", "신", "권", "황", "안", "송", "류", "전",     │
│     "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남"      │
│   ]                                                                 │
│                                                                     │
│   name = RANDOM(LAST_NAMES) + RANDOM(FIRST_NAMES)                   │
│   // Example: "김민준", "이서연", "박도윤"                          │
│                                                                     │
│                                                                     │
│   STEP 3: Generate Personality Traits (Big Five Model)              │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   // Each trait: 0.0 ~ 1.0, Gaussian distribution (mean=0.5, σ=0.2)│
│   // Clamp to [0.1, 0.9] to avoid extremes                          │
│                                                                     │
│   traits = {                                                        │
│     openness:          CLAMP(GAUSSIAN(0.5, 0.2), 0.1, 0.9),        │
│     conscientiousness: CLAMP(GAUSSIAN(0.5, 0.2), 0.1, 0.9),        │
│     extraversion:      CLAMP(GAUSSIAN(0.5, 0.2), 0.1, 0.9),        │
│     agreeableness:     CLAMP(GAUSSIAN(0.5, 0.2), 0.1, 0.9),        │
│     neuroticism:       CLAMP(GAUSSIAN(0.5, 0.2), 0.1, 0.9)         │
│   }                                                                 │
│                                                                     │
│                                                                     │
│   STEP 4: Generate Initial Credits                                  │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   // All citizens start equal: 1000 credits                         │
│   // This represents "basic universal income" at birth              │
│                                                                     │
│   initial_credits = 1000                                            │
│                                                                     │
│                                                                     │
│   STEP 5: Calculate Initial Existence Score                         │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   // New citizens start with moderate existence                     │
│   // Not too high (unearned), not too low (immediate death risk)    │
│                                                                     │
│   E(0) = 0.5                                                        │
│                                                                     │
│                                                                     │
│   STEP 6: Generate Default Beliefs                                  │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   // Beliefs are influenced by personality traits                   │
│                                                                     │
│   beliefs = {                                                       │
│     self_worth:    0.5 + (traits.extraversion - 0.5) * 0.3,        │
│     world_trust:   0.5 + (traits.agreeableness - 0.5) * 0.3,       │
│     work_ethic:    0.5 + (traits.conscientiousness - 0.5) * 0.3,   │
│     risk_tolerance: 0.5 + (traits.openness - 0.5) * 0.3,           │
│     conformity:    0.5 - (traits.openness - 0.5) * 0.3             │
│   }                                                                 │
│                                                                     │
│                                                                     │
│   OUTPUT: Persona Object                                            │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   persona = {                                                       │
│     citizen_id,                                                     │
│     device_serial,                                                  │
│     device_model,                                                   │
│     connection_type,                                                │
│     name,                                                           │
│     traits,                                                         │
│     beliefs,                                                        │
│     credits: initial_credits,                                       │
│     existence_score: E(0),                                          │
│     created_at: NOW(),                                              │
│     last_seen_at: NOW()                                             │
│   }                                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1.3 JSON Output Example

```json
{
  "citizen_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "device_serial": "192.168.0.101:5555",
  "device_model": "SM-G960N",
  "connection_type": "WIFI",
  "name": "김민준",
  "traits": {
    "openness": 0.67,
    "conscientiousness": 0.45,
    "extraversion": 0.72,
    "agreeableness": 0.38,
    "neuroticism": 0.51
  },
  "beliefs": {
    "self_worth": 0.566,
    "world_trust": 0.464,
    "work_ethic": 0.485,
    "risk_tolerance": 0.551,
    "conformity": 0.449
  },
  "credits": 1000,
  "existence_score": 0.5,
  "created_at": "2025-01-15T09:30:00Z",
  "last_seen_at": "2025-01-15T09:30:00Z"
}
```

### 1.1.4 Database Schema (Supabase)

```sql
-- Citizens table
CREATE TABLE citizens (
  citizen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial VARCHAR(64) UNIQUE NOT NULL,
  device_model VARCHAR(32),
  connection_type VARCHAR(8) CHECK (connection_type IN ('USB', 'WIFI', 'LAN')),
  
  -- Identity
  name VARCHAR(20) NOT NULL,
  
  -- Personality (Big Five)
  trait_openness DECIMAL(3,2) CHECK (trait_openness BETWEEN 0 AND 1),
  trait_conscientiousness DECIMAL(3,2) CHECK (trait_conscientiousness BETWEEN 0 AND 1),
  trait_extraversion DECIMAL(3,2) CHECK (trait_extraversion BETWEEN 0 AND 1),
  trait_agreeableness DECIMAL(3,2) CHECK (trait_agreeableness BETWEEN 0 AND 1),
  trait_neuroticism DECIMAL(3,2) CHECK (trait_neuroticism BETWEEN 0 AND 1),
  
  -- Beliefs
  belief_self_worth DECIMAL(3,2) CHECK (belief_self_worth BETWEEN 0 AND 1),
  belief_world_trust DECIMAL(3,2) CHECK (belief_world_trust BETWEEN 0 AND 1),
  belief_work_ethic DECIMAL(3,2) CHECK (belief_work_ethic BETWEEN 0 AND 1),
  belief_risk_tolerance DECIMAL(3,2) CHECK (belief_risk_tolerance BETWEEN 0 AND 1),
  belief_conformity DECIMAL(3,2) CHECK (belief_conformity BETWEEN 0 AND 1),
  
  -- Economy
  credits INTEGER DEFAULT 1000,
  existence_score DECIMAL(3,2) DEFAULT 0.5,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT credits_non_negative CHECK (credits >= 0)
);

CREATE INDEX idx_citizens_serial ON citizens(device_serial);
CREATE INDEX idx_citizens_existence ON citizens(existence_score);
```

---

## 1.2 Sync Policy (동기화 정책)

### 1.2.1 Conflict Scenario

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STATE CONFLICT SCENARIO                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   시나리오: 기기가 오프라인 상태에서 작업 후 재접속                 │
│                                                                     │
│   ┌─────────────────────┐          ┌─────────────────────┐          │
│   │    SERVER STATE     │          │    CLIENT STATE     │          │
│   │    (Supabase DB)    │          │ (/sdcard/doai/      │          │
│   │                     │          │  state.json)        │          │
│   ├─────────────────────┤          ├─────────────────────┤          │
│   │ credits: 1500       │          │ credits: 1800       │          │
│   │ existence: 0.65     │    ≠     │ existence: 0.58     │          │
│   │ last_task: "POP-42" │          │ last_task: "POP-47" │          │
│   │ updated: 10:00:00   │          │ updated: 10:30:00   │          │
│   └─────────────────────┘          └─────────────────────┘          │
│                                                                     │
│   Question: Which state is the source of truth?                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2.2 Sync Policy Decision Tree

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SYNC POLICY DECISION TREE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Device Reconnects                                                 │
│         │                                                           │
│         ▼                                                           │
│   ┌─────────────────────────────────────────────┐                   │
│   │ STEP 1: Fetch Both States                   │                   │
│   │                                             │                   │
│   │ server_state = DB.query(device_serial)      │                   │
│   │ client_state = ADB.pull("/sdcard/doai/      │                   │
│   │                         state.json")        │                   │
│   └──────────────────────┬──────────────────────┘                   │
│                          │                                          │
│                          ▼                                          │
│   ┌─────────────────────────────────────────────┐                   │
│   │ STEP 2: Compare Timestamps                  │                   │
│   │                                             │                   │
│   │ server_ts = server_state.updated_at         │                   │
│   │ client_ts = client_state.updated_at         │                   │
│   └──────────────────────┬──────────────────────┘                   │
│                          │                                          │
│              ┌───────────┴───────────┐                              │
│              │                       │                              │
│              ▼                       ▼                              │
│   ┌──────────────────┐    ┌──────────────────┐                      │
│   │ client_ts >      │    │ server_ts >=     │                      │
│   │ server_ts        │    │ client_ts        │                      │
│   │                  │    │                  │                      │
│   │ Client is NEWER  │    │ Server is NEWER  │                      │
│   └────────┬─────────┘    └────────┬─────────┘                      │
│            │                       │                                │
│            ▼                       ▼                                │
│   ┌──────────────────┐    ┌──────────────────┐                      │
│   │ STEP 3A:         │    │ STEP 3B:         │                      │
│   │ Validate Client  │    │ Server Wins      │                      │
│   │ State            │    │                  │                      │
│   └────────┬─────────┘    │ Push server_state│                      │
│            │              │ to client:       │                      │
│            ▼              │                  │                      │
│   ┌──────────────────┐    │ ADB.push(        │                      │
│   │ Is client_state  │    │   state.json,    │                      │
│   │ plausible?       │    │   /sdcard/doai/) │                      │
│   │                  │    └────────┬─────────┘                      │
│   │ Δcredits <= MAX_ │             │                                │
│   │ EARN_RATE * Δt   │             │                                │
│   │                  │             │                                │
│   │ Δexistence       │             │                                │
│   │ within range     │             │                                │
│   └────────┬─────────┘             │                                │
│      YES   │   NO                  │                                │
│   ┌────────┴────────┐              │                                │
│   │                 │              │                                │
│   ▼                 ▼              │                                │
│ ┌─────────────┐ ┌─────────────┐    │                                │
│ │ Client Wins │ │ FRAUD ALERT │    │                                │
│ │             │ │             │    │                                │
│ │ Merge to    │ │ Log anomaly │    │                                │
│ │ server:     │ │ Use server  │    │                                │
│ │             │ │ state       │    │                                │
│ │ DB.update(  │ │             │    │                                │
│ │ client_     │ │ Flag for    │    │                                │
│ │ state)      │ │ review      │    │                                │
│ └─────────────┘ └─────────────┘    │                                │
│                                    │                                │
│                                    ▼                                │
│                          ┌──────────────────┐                       │
│                          │ STEP 4: Confirm  │                       │
│                          │                  │                       │
│                          │ Send ACK to      │                       │
│                          │ client with      │                       │
│                          │ final state      │                       │
│                          └──────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2.3 Plausibility Validation Formula

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLAUSIBILITY VALIDATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Constants:                                                        │
│   ─────────────────────────────────────────────────────────────     │
│   MAX_CREDITS_PER_HOUR = 100        // Maximum earnble per hour     │
│   MAX_EXISTENCE_CHANGE_PER_HOUR = 0.1  // Max E(t) delta per hour   │
│                                                                     │
│                                                                     │
│   Validation Rules:                                                 │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   Δt = client_ts - server_ts  // Time difference in hours           │
│                                                                     │
│   Rule 1: Credits Change                                            │
│   ─────────────────────────                                         │
│   Δcredits = client.credits - server.credits                        │
│                                                                     │
│   IF Δcredits > 0:                                                  │
│     // Earned credits                                               │
│     valid = Δcredits <= MAX_CREDITS_PER_HOUR * Δt                   │
│                                                                     │
│   IF Δcredits < 0:                                                  │
│     // Spent credits - always valid (they can spend)                │
│     valid = true                                                    │
│                                                                     │
│                                                                     │
│   Rule 2: Existence Score Change                                    │
│   ─────────────────────────────                                     │
│   Δexistence = |client.existence - server.existence|                │
│                                                                     │
│   valid = Δexistence <= MAX_EXISTENCE_CHANGE_PER_HOUR * Δt          │
│                                                                     │
│                                                                     │
│   Rule 3: Task Continuity                                           │
│   ────────────────────────                                          │
│   // Client's completed tasks should include server's last task     │
│   // or be a logical continuation                                   │
│                                                                     │
│   valid = client.completed_tasks.includes(server.last_task)         │
│           OR client.last_task_id > server.last_task_id              │
│                                                                     │
│                                                                     │
│   Final Decision:                                                   │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   is_plausible = Rule1.valid AND Rule2.valid AND Rule3.valid        │
│                                                                     │
│   IF NOT is_plausible:                                              │
│     log_anomaly(device_serial, server_state, client_state)          │
│     use_server_state()                                              │
│   ELSE:                                                             │
│     merge_client_to_server()                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 2. Content Verification: POP & Accident 검증

## 2.1 YouTube Parser Logic

### 2.1.1 URL Validation & Parsing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    YOUTUBE URL PARSER FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Input: User-provided URL string                                   │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   Examples of valid inputs:                                         │
│   • https://www.youtube.com/watch?v=dQw4w9WgXcQ                     │
│   • https://youtu.be/dQw4w9WgXcQ                                    │
│   • https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxx            │
│   • https://www.youtube.com/embed/dQw4w9WgXcQ                       │
│   • https://m.youtube.com/watch?v=dQw4w9WgXcQ                       │
│                                                                     │
│                                                                     │
│                          ┌──────────────┐                           │
│   URL Input ────────────▶│  STEP 1:     │                           │
│                          │  Validate    │                           │
│                          │  URL Format  │                           │
│                          └──────┬───────┘                           │
│                                 │                                   │
│                    ┌────────────┴────────────┐                      │
│                    │                         │                      │
│                    ▼                         ▼                      │
│             ┌──────────┐              ┌──────────┐                  │
│             │ VALID    │              │ INVALID  │                  │
│             │ YouTube  │              │ Format   │                  │
│             │ Domain   │              │          │                  │
│             └────┬─────┘              └────┬─────┘                  │
│                  │                         │                        │
│                  ▼                         ▼                        │
│         ┌───────────────┐          ┌───────────────┐                │
│         │  STEP 2:      │          │  RETURN       │                │
│         │  Extract      │          │  ERROR:       │                │
│         │  Video ID     │          │  INVALID_URL  │                │
│         └───────┬───────┘          └───────────────┘                │
│                 │                                                   │
│                 ▼                                                   │
│         ┌───────────────┐                                           │
│         │  Video ID     │                                           │
│         │  Extracted?   │                                           │
│         └───────┬───────┘                                           │
│           YES   │   NO                                              │
│         ┌───────┴───────┐                                           │
│         │               │                                           │
│         ▼               ▼                                           │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │  STEP 3:     │ │  RETURN      │                                  │
│  │  Fetch Video │ │  ERROR:      │                                  │
│  │  Metadata    │ │  NO_VIDEO_ID │                                  │
│  └──────┬───────┘ └──────────────┘                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  YouTube     │                                                   │
│  │  Data API   │───────────────────────────────┐                    │
│  │  or oEmbed   │                              │                    │
│  └──────┬───────┘                              │                    │
│         │                                      │                    │
│   ┌─────┴─────┐                                │                    │
│   │           │                                │                    │
│   ▼           ▼                                ▼                    │
│ ┌─────────┐ ┌─────────┐                 ┌─────────────┐             │
│ │ SUCCESS │ │ FAIL    │                 │ Rate Limit  │             │
│ │         │ │ (404,   │                 │ Fallback:   │             │
│ │         │ │ private)│                 │ Scrape      │             │
│ └────┬────┘ └────┬────┘                 └──────┬──────┘             │
│      │           │                              │                   │
│      ▼           ▼                              │                   │
│ ┌─────────┐ ┌─────────┐                         │                   │
│ │ RETURN  │ │ RETURN  │                         │                   │
│ │ Parsed  │ │ ERROR:  │                         │                   │
│ │ Result  │ │ NOT_    │                         │                   │
│ │         │ │ FOUND   │◀────────────────────────┘                   │
│ └─────────┘ └─────────┘                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1.2 Video ID Extraction Regex

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VIDEO ID EXTRACTION PATTERNS                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   YouTube Video ID Format:                                          │
│   ─────────────────────────────────────────────────────────────     │
│   • Length: Exactly 11 characters                                   │
│   • Characters: [A-Za-z0-9_-]                                       │
│   • Example: "dQw4w9WgXcQ"                                          │
│                                                                     │
│                                                                     │
│   Regex Pattern (Combined):                                         │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)          │
│    ([A-Za-z0-9_-]{11})/                                             │
│                                                                     │
│                                                                     │
│   URL Format Patterns:                                              │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   Pattern 1: Standard watch URL                                     │
│   youtube.com/watch?v={VIDEO_ID}                                    │
│   Regex: /[?&]v=([A-Za-z0-9_-]{11})/                                │
│                                                                     │
│   Pattern 2: Short URL                                              │
│   youtu.be/{VIDEO_ID}                                               │
│   Regex: /youtu\.be\/([A-Za-z0-9_-]{11})/                           │
│                                                                     │
│   Pattern 3: Embed URL                                              │
│   youtube.com/embed/{VIDEO_ID}                                      │
│   Regex: /embed\/([A-Za-z0-9_-]{11})/                               │
│                                                                     │
│   Pattern 4: Old format                                             │
│   youtube.com/v/{VIDEO_ID}                                          │
│   Regex: /\/v\/([A-Za-z0-9_-]{11})/                                 │
│                                                                     │
│   Pattern 5: Shorts                                                 │
│   youtube.com/shorts/{VIDEO_ID}                                     │
│   Regex: /shorts\/([A-Za-z0-9_-]{11})/                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2.2 Accident Interrupt: Context Switching

### 2.2.1 Interrupt Priority Levels

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERRUPT PRIORITY SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Priority │ Type        │ Can Interrupt │ Response Time │ Example │
│   ─────────┼─────────────┼───────────────┼───────────────┼─────────│
│   0 (MAX)  │ CATASTROPHE │ Everything    │ < 1s          │ 전쟁발발│
│   1        │ ACCIDENT    │ POP, IDLE     │ < 3s          │ 대형사고│
│   2        │ URGENT_POP  │ Normal POP    │ < 5s          │ 긴급영상│
│   3        │ NORMAL_POP  │ IDLE only     │ < 10s         │ 일반영상│
│   4 (MIN)  │ IDLE        │ Nothing       │ N/A           │ 대기상태│
│                                                                     │
│                                                                     │
│   Interrupt Rules:                                                  │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   1. Higher priority always interrupts lower priority               │
│   2. Same priority: Queue (FIFO)                                    │
│   3. CATASTROPHE: No queue, immediate override                      │
│   4. Interrupted task state is saved for potential resume           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 3. Economy & Proof: 경제 활동과 증명

## 3.1 Proof of View (PoV)

### 3.1.1 View Verification Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROOF OF VIEW (PoV) SYSTEM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Core Principle:                                                   │
│   ─────────────────────────────────────────────────────────────     │
│   "시청 증명은 신뢰 기반이 아닌 검증 기반으로 이루어진다."          │
│   "Proof of View is verification-based, not trust-based."          │
│                                                                     │
│                                                                     │
│   Verification Criteria:                                            │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   CRITERION 1: Start Event                                          │
│   • AutoX.js logs "VIDEO_START" event                               │
│   • Includes: video_id, timestamp, citizen_id                       │
│                                                                     │
│   CRITERION 2: End Event                                            │
│   • AutoX.js logs "VIDEO_END" event                                 │
│   • Includes: video_id, timestamp, watch_duration                   │
│                                                                     │
│   CRITERION 3: Duration Validation                                  │
│   • watch_duration >= video_duration * THRESHOLD                    │
│   • THRESHOLD = 0.9 (90% of video must be watched)                  │
│                                                                     │
│   CRITERION 4: Time Plausibility                                    │
│   • (end_timestamp - start_timestamp) >= watch_duration             │
│   • Prevents: reporting 10min watch in 5min real time               │
│                                                                     │
│   CRITERION 5: Uniqueness                                           │
│   • Same (citizen_id, video_id) can only earn once                  │
│   • Re-watch: allowed but no additional reward                      │
│                                                                     │
│                                                                     │
│   Verification Formula:                                             │
│   ─────────────────────────────────────────────────────────────     │
│                                                                     │
│   is_valid = (                                                      │
│     has_start_event AND                                             │
│     has_end_event AND                                               │
│     watch_duration >= video_duration * 0.9 AND                      │
│     (end_ts - start_ts) >= watch_duration AND                       │
│     NOT already_rewarded(citizen_id, video_id)                      │
│   )                                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 4. Admin Input Forms: 관리자 입력 폼 스펙

## 4.1 Accident Registration Form

### 4.1.1 Field Definitions

| Field Name | Type | Required | Validation |
|------------|------|----------|------------|
| headline | text | YES | max 100 chars |
| description | textarea | YES | max 500 chars |
| severity | select | YES | enum |
| accident_type | select | YES | enum |
| affected_belief | select | NO | enum |
| credits_impact | number | YES | -1000 ~ 0 |
| existence_impact | number | YES | -0.3 ~ 0 |
| duration_minutes | number | NO | 1 ~ 60 |
| has_dilemma | checkbox | NO | boolean |
| dilemma_question | text | IF above | max 200 chars |
| dilemma_options | array | IF above | 2-4 options |

### Enum Values

**severity:**
- MINOR - 경미 (existence -0.05)
- MODERATE - 보통 (existence -0.1)
- SEVERE - 심각 (existence -0.2)
- CATASTROPHIC - 재앙 (existence -0.3, 즉시 전파)

**accident_type:**
- NATURAL_DISASTER - 자연재해
- ECONOMIC_CRISIS - 경제위기
- SOCIAL_UNREST - 사회불안
- TECHNOLOGICAL - 기술사고
- PANDEMIC - 전염병
- WAR - 전쟁/분쟁

**affected_belief:**
- SELF_WORTH - 자아가치 영향
- WORLD_TRUST - 세상신뢰 영향
- WORK_ETHIC - 노동윤리 영향
- RISK_TOLERANCE - 위험감수 영향
- CONFORMITY - 순응성 영향

---

## 4.2 Commission (POP) Registration Form

### 4.2.1 Field Definitions

| Field Name | Type | Required | Validation |
|------------|------|----------|------------|
| youtube_url | url | YES | valid YT URL |
| title | text | AUTO | from API |
| duration | number | AUTO | from API |
| thumbnail | image | AUTO | from API |
| commission_type | select | YES | enum |
| priority | select | YES | enum |
| credits_reward | number | YES | 1 ~ 100 |
| target_count | number | NO | 1 ~ 600 |
| expires_at | datetime | NO | future date |
| memo | textarea | NO | max 200 chars |

### Enum Values

**commission_type:**
- WATCH_FULL - 전체 시청 (90% 이상)
- WATCH_PARTIAL - 부분 시청 (30초 이상)
- LIKE - 좋아요 (시청 후)
- SUBSCRIBE - 구독 (시청 후)
- COMMENT - 댓글 작성 (시청 후)

**priority:**
- URGENT - 긴급 (priority: 2, 다른 POP 중단 가능)
- NORMAL - 일반 (priority: 3, 큐에 추가)
- LOW - 낮음 (priority: 4, 여유 시간에 실행)

---

# API Endpoints Summary

```
PERSONA & SYNC
POST   /api/citizens                    Create new citizen
GET    /api/citizens/:id                Get citizen by ID
POST   /api/citizens/:id/sync           Sync device state

YOUTUBE PARSER
POST   /api/youtube/parse               Parse YouTube URL

VIEW VERIFICATION
POST   /api/views/start                 Log video start
POST   /api/views/end                   Log video end + verify
GET    /api/views/:citizen_id           Get citizen's view history

ADMIN: ACCIDENTS
POST   /api/admin/accidents             Create & broadcast
GET    /api/admin/accidents             List all accidents
GET    /api/admin/accidents/:id         Get accident details

ADMIN: COMMISSIONS (POP)
POST   /api/admin/commissions           Create & broadcast
GET    /api/admin/commissions           List all commissions
GET    /api/admin/commissions/:id       Get commission details
PATCH  /api/admin/commissions/:id       Update status

WEBSOCKET MESSAGES (Protocol v2.0)
→ device:sync                           Sync state request
← device:sync:response                  Sync state response
→ view:start                            Video start event
→ view:end                              Video end event
← view:verified                         Verification result
← broadcast:accident                    Accident notification
← broadcast:pop                         New commission
→ ack:accident                          Accident processed
→ ack:pop                               Commission completed
```

---

**END OF IMPLEMENTATION SPEC v1.0**

*"이 문서는 Axon이 즉시 함수를 작성할 수 있도록 설계되었다."*

*— Aria, Architect of DoAi.Me*

