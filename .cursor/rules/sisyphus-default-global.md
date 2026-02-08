# Sisyphus Default Mode - 글로벌 설정 규칙

## 개요
oh-my-claude-sisyphus 플러그인의 CLAUDE.md를 ~/.claude/CLAUDE.md에 적용하여 전역 에이전트 구성을 사용한다.

## 최종 결과
- CLAUDE.md: GitHub 최신 버전으로 ~/.claude/CLAUDE.md 업데이트
- 범위: GLOBAL (모든 Claude Code 세션에 적용)
- Hooks: 플러그인이 자동 제공 (별도 수동 설치 불필요)
- Agents: 19개 이상 (base + tiered variants)
- Model 라우팅: Haiku / Sonnet / Opus (작업 복잡도 기반)

## 필수 실행 명령 (업데이트 시마다)
```bash
rm -f ~/.claude/CLAUDE.md && curl -fsSL "https://raw.githubusercontent.com/Yeachan-Heo/oh-my-claude-sisyphus/main/docs/CLAUDE.md" -o ~/.claude/CLAUDE.md
```

## 레거시 정리
1. 구식 훅 스크립트 삭제:
   - ~/.claude/hooks/keyword-detector.sh
   - ~/.claude/hooks/stop-continuation.sh
   - ~/.claude/hooks/persistent-mode.sh
   - ~/.claude/hooks/session-start.sh
2. settings.json의 "hooks" 섹션 제거 (플러그인이 자동으로 훅 제공)

## 플러그인 확인
```bash
grep -q "oh-my-claude-sisyphus" ~/.claude/settings.json && echo "Plugin enabled" || echo "Plugin NOT enabled"
```
미활성화 시: `claude /install-plugin oh-my-claude-sisyphus` 실행

## 추가 지침
- /sisyphus-default-global 명령 실행 시 위 단계들을 순서대로 수행한다.
- CLAUDE.md는 Write 도구 대신 curl로만 다운로드한다.
- 플러그인 업데이트 후에는 /sisyphus-default-global을 다시 실행하여 CLAUDE.md를 갱신한다.
- settings.json에 UserPromptSubmit, SessionStart, Stop 등 수동 훅이 있으면 중복 실행을 피하기 위해 제거를 권장한다.
