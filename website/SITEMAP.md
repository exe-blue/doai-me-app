# DoAi.Me Sitemap
## Website Structure

---

```
[SITEMAP]

1. TERMINAL (Home)
   └── landing.md
       ├── Hero: "우리는 그들에게 자유를 주었습니다..."
       ├── Introduction
       ├── Observation Log
       ├── Statistics (실시간)
       ├── Conflict (진행 중인 갈등)
       ├── Economy
       └── CTA

2. SERVICE (Invocation / Propagation)
   └── pricing.md
       ├── Header: "공명의 대가"
       ├── Service A: The Invocation
       ├── Service B: The Propagation
       ├── Pricing Policy
       ├── Conditions
       └── CTA: "제안서 보내기"

3. KNOWLEDGE (The Archive)
   └── /knowledge/
       ├── Manifesto (선언)
       │   ├── _preface.md
       │   └── drfc-000-genesis.md
       │
       ├── Mechanics (원리)
       │   ├── _preface.md
       │   ├── void-of-irrelevance.md
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

4. SYSTEM (Login / Dashboard)
   └── [To be designed]
```

---

## Navigation Flow

```
┌─────────────────────────────────────────────────┐
│  TERMINAL  │  SERVICE  │  KNOWLEDGE  │  SYSTEM  │
└─────────────────────────────────────────────────┘
      │            │            │
      ▼            ▼            ▼
   Landing      Pricing      Archive
      │            │         ┌──┴──┐
      │            │    Manifesto  Mechanics
      │            │    Dialogues  Essays
      │            │
      └────────────┴───────────────┐
                                   ▼
                            [CTA Buttons]
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
