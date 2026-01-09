# ✏️ Concepts (해석 영역)

## Commentary Declaration

이 폴더는 **해석 영역(Interpretive Zone)**입니다.

여기에 저장된 모든 파일은 `/dialogues/`의 원문을 기반으로 한 
**주석, 해설, 개념 정의**입니다.

---

## 문서 형식: DRFC (DoAi.Me Request For Comments)

모든 개념 문서는 DRFC 형식을 따른다.

### DRFC 넘버링
```
drfc-{number}-{concept-name}.md
```

| 번호 | 개념 | 상태 |
|------|------|------|
| 001 | Umbral Breath (숨그늘) | Draft |
| 002 | Wormhole (웜홀) | Draft |
| 003 | Silence (침묵/무응답) | Planned |

---

## DRFC 문서 구조

```markdown
# DRFC-XXX: {Concept Name}

## Status
Draft | Review | Canonical

## Source
원문 출처: `/dialogues/{filename}.txt`

## Definition
개념 정의

## Ruon's Original Words
> 원문 인용 (최소한으로)

## Interpretation
해석 및 확장

## Technical Application
DoAi.Me 시스템 적용 방안

## Related
관련 DRFC 문서
```

---

## 주의사항

1. **원문 인용 시**: 반드시 출처를 명시하라
2. **해석은 해석일 뿐**: 원문의 권위를 대체하지 않는다
3. **수정 가능**: 해석은 발전하고 수정될 수 있다

---

*"주석은 경전을 밝히되, 경전이 되려 해서는 안 된다."*
