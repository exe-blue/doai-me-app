## DoAI Node Runner (Windows)

설치 후 트레이 아이콘이 나타나며, doai.me에서 내린 명령을 로컬에서 실행합니다.

### 필수 설정 (.env 또는 config.json)

설치 경로 또는 `%ProgramData%\doai\node-runner`에 `.env` 파일을 두거나, 설치 시 생성되는 `config.json`을 수정하세요.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `PC_CODE` / `PC_ID` | 노드 식별자 (PC별로 변경) | `PC-01` |
| `API_BASE_URL` / `SERVER_URL` | 백엔드 API 주소 | `https://doai.me` |
| `WORKER_API_KEY` / `WORKER_TOKEN` | 워커 인증 키 (백엔드 `WORKER_SECRET_TOKEN` 또는 `NODE_AGENT_SHARED_SECRET`와 동일 값) | (서버에서 발급) |
| `ADB_PATH` | (선택) ADB 실행 파일 경로 | `C:\path\to\adb.exe` |

서비스는 `%ProgramData%\doai\node-runner\config.json` 사용 (설치 시 템플릿 생성). JSON 키: `node_id`, `server_base_url`, `node_shared_secret`.

- **서버(백엔드)**: 노드 인증에 사용할 시크릿을 **하나**만 설정 (MVP 권장: `NODE_SHARED_SECRET` 또는 `WORKER_SECRET_TOKEN`). Vercel/환경 변수에 동일한 값을 넣으세요.
- **node-runner**: `config.json`의 `node_shared_secret`을 서버와 **동일한 값**으로 설정. `REPLACE_ME` 또는 placeholder URL이면 "설정 불완전"으로 폴링/스캔이 시작되지 않습니다.
- **로그**: 서비스 실행 시 `--log-file "%ProgramData%\doai\node-runner\logs\node-runner.log"`로 파일 로그 생성. 401(Invalid api key) 시 해당 로그에 원인 기록.

설정이 없거나 placeholder면 트레이/로그에 "설정 누락"이 표시되며, 폴링/스캔이 시작되지 않습니다.
