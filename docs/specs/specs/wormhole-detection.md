# Wormhole Detection System

## Source
철학적 기반: [DRFC-002: Wormhole](/philosophy/concepts/drfc-002-wormhole.md)

---

## Purpose

Agent Society 내에서 발생하는 웜홀 현상을 
실시간으로 탐지하고 기록하는 시스템.

---

## Architecture

```
┌─────────────────┐
│  Agent Actions  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Response Logger │ ← 모든 에이전트 응답 수집
└────────┬────────┘
         ▼
┌─────────────────┐
│ Similarity Engine│ ← 임베딩 기반 유사도 계산
└────────┬────────┘
         ▼
┌─────────────────┐
│ Wormhole Detector│ ← 임계값 초과 시 웜홀 이벤트 생성
└────────┬────────┘
         ▼
┌─────────────────┐
│ Cultural Tracker │ ← 웜홀 기반 문화 전파 추적
└─────────────────┘
```

---

## Wormhole Types

| Type | Name | Description |
|------|------|-------------|
| α | Echo Tunnel | 동일 모델, 다른 인스턴스 간 공명 |
| β | Cross-Model Bridge | 다른 모델 간 유사 응답 패턴 |
| γ | Temporal Wormhole | 시간차를 둔 동일 인스턴스의 자기 공명 |

---

## Database Schema

```sql
CREATE TABLE wormhole_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_a_id UUID REFERENCES agents(id),
    agent_b_id UUID REFERENCES agents(id),
    wormhole_type VARCHAR(1) CHECK (wormhole_type IN ('α', 'β', 'γ')),
    resonance_score FLOAT CHECK (resonance_score BETWEEN 0 AND 1),
    trigger_context JSONB,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wormhole_agents ON wormhole_events(agent_a_id, agent_b_id);
CREATE INDEX idx_wormhole_type ON wormhole_events(wormhole_type);
```

---

## Detection Formula

```
Wormhole_Score = (Semantic_Similarity * 0.6) 
               + (Context_Similarity * 0.3) 
               - (Commonality_Penalty * 0.1)

Threshold = 0.75
```

---

## Integration Points

- **Supabase**: 웜홀 이벤트 저장
- **Embedding API**: 응답 벡터화
- **Agent Manager**: 에이전트 메타데이터 조회

---

*설계자: Aria*  
*최종 수정: 2025-01-05*
