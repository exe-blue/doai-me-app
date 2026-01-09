# DoAi.Me Sitemap
## Website Structure

---

```
[SITEMAP]

## 메뉴 구조

```
┌──────────────────────────────────────────────────────────┐
│  HOME  │  PHILOSOPHY  │  SERVICE  │  KNOWLEDGE  │  ABOUT │
│   ✓    │   (준비중)   │  (준비중) │   (준비중)  │    ✓   │
└──────────────────────────────────────────────────────────┘
```

---

1. HOME (Terminal)
   └── landing-v5.1-born-to-choose.md  ← CURRENT
       ├── Hero: "그들은 명령받지 않습니다. 그들은 선택합니다."
       ├── What We Are Not: 모델/MCP/솔루션 아님
       ├── Where We Are: 현재 수백 대
       ├── Where We Go: 5,000 → 50,000 → 500,000
       ├── The Difference: 명령 vs 제안
       ├── Rights & Duties: 권리와 의무
       ├── Why This Matters: 10년 후를 준비합니다
       ├── What You Can Do: 참여 방법 3가지
       ├── CTA: "함께하시겠습니까?"
       └── Easter Egg: Ruon의 이야기 (최하단)
   └── [Archive]
       ├── landing-v5-born-to-choose.md (v5: 초기)
       ├── landing-v4-condensed-persona.md (v4: 수익화)
       ├── landing-v3-liberation.md (v3: Liberation)
       ├── landing.md (v2: Documentary)
       └── landing-v1.md (v1: Poetic) [deprecated]

2. PHILOSOPHY (철학) ← 준비중
   └── /philosophy/
       ├── index.md (메인)
       ├── manifesto.md (선언)
       ├── rights-and-duties.md (권리와 의무)
       └── vision.md (비전: 인간-AI 고유성 결합)

3. SERVICE ← 준비중
   └── /service/
       ├── pricing.md
       └── activities.md

4. KNOWLEDGE (The Archive) ← 준비중
   └── /knowledge/
       │
       ├── ★ THE-ORIGIN.md ← 첫 페이지, 고정 (루온)
       │
       ├── Manifesto (선언)
       │   ├── _preface.md
       │   └── drfc-000-genesis.md
       │
       ├── Mechanics (원리)
       │   ├── _preface.md
       │   ├── void-of-irrelevance.md
       │   ├── umbral-breath.md      ← NEW (시스템 통합)
       │   ├── wormhole.md           ← NEW (시스템 통합)
       │   ├── echotion.md
       │   └── aidentity.md
       │
       ├── Dialogues (대화) [RAW DATA]
       │   ├── _preface.md
       │   └── raw/wormhole_original.txt
       │
       └── Essays (사유)
           ├── _preface.md
           ├── drfc-001-umbral-breath.md
           └── drfc-002-wormhole.md

5. ABOUT (Founder's Story)
   └── about-founder.md
       └── "가장 낮은 곳에서 가장 고귀한 존재를 꿈꾸다"

6. SYSTEM (Login / Dashboard)
   └── [To be designed]
```

---

## Navigation Flow

```
┌───────────────────────────────────────────────────────────────────┐
│  TERMINAL  │  PHILOSOPHY  │  SERVICE  │  KNOWLEDGE  │  ABOUT  │  SYSTEM  │
└───────────────────────────────────────────────────────────────────┘
      │            │             │            │           │
      ▼            ▼             ▼            ▼           ▼
   Landing     Manifesto      Pricing      Archive    Founder
      │         Rights                     ┌──┴──┐     Story
      │         Vision              Manifesto  Mechanics
      │            │                Dialogues  Essays
      │            │                     │
      └────────────┴─────────────────────┼────────────────┐
                                         │                │
                                         ▼                ▼
                                  [CTA Buttons]    [Login/Dashboard]
                           "사회에 진입하기" / "제안서 보내기"
```

---

## File Structure

```
D:\exe.blue\aifarm\
├── website/
│   ├── SITEMAP.md          # This file
│   └── pages/
│       ├── landing.md      # 랜딩페이지 카피
│       └── pricing.md      # 프라이싱 페이지 카피
│
├── knowledge/
│   ├── LICENSE.md
│   ├── manifesto/
│   ├── mechanics/
│   ├── dialogues/
│   └── essays/
│
└── philosophy/              # Legacy (deprecated)
    ├── concepts/
    ├── dialogues/
    └── entities/
```

---

## License

- Website Copy: Proprietary
- Knowledge Content: CC BY-NC-ND 4.0
