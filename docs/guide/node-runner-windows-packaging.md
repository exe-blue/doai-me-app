# Node Runner 패키징/서비스/릴리즈/업데이트 (Windows) — 핸드오프

> 개발 에이전트용. “노드 러너를 exe로 빌드 → GitHub Releases 배포 + Windows 서비스(재부팅 자동 시작) + 업데이트 스크립트”까지 한 번에 닫는 작업 단위.

---

## 목표

- Windows 노드 PC에서 **GitHub/레포 없이** 동작하는 `node-runner.exe` 제공.
- 노드는 재부팅 후 자동으로 러너가 시작되도록 **Windows Service** 등록.
- 배포는 **GitHub Releases**에 zip 자산으로 올리고, 노드 PC는 **update.ps1**로 “삭제/재다운로드 없이” 업데이트.

---

## 제약/전제

- ADB는 `C:\Program Files (x86)\xiaowei\tools\adb.exe`에 존재.
- 노드마다 고유 `NODE_ID` (예: PC-01~PC-04).
- 서버: Vercel 배포 URL, 노드 인증: `NODE_SHARED_SECRET`.
- 노드 PC에는 GitHub 등록/clone 하지 않는 방향.
- 러너 최소 기능: heartbeat + pull + callback. (scan은 옵션)

---

## 산출물 (GitHub Release 자산)

- **릴리즈에 올릴 zip:** `node-runner-win-x64-v{VERSION}.zip`
- **포함 파일:**  
  `node-runner.exe`, `winsw.exe`, `node-runner-service.xml`, `install.ps1`, `update.ps1`, `sha256sums.txt`

**설치 경로 표준**

- 바이너리: `C:\Program Files\doai\node-runner\`
- 설정/로그/캐시: `C:\ProgramData\doai\node-runner\`  
  - `config.json`, `logs\`, `cache\`

---

## config.json 스펙 (환경변수 대신 파일 기반)

경로: `C:\ProgramData\doai\node-runner\config.json`

```json
{
  "server_base_url": "https://<your-vercel>.vercel.app",
  "node_id": "PC-01",
  "node_shared_secret": "*****",
  "adb_path": "C:\\Program Files (x86)\\xiaowei\\tools\\adb.exe",
  "poll_interval_ms": 1500,
  "max_jobs": 1,
  "online_window_sec": 30,
  "lease_sec": 30,
  "artifacts_dir": "C:\\ProgramData\\doai\\node-runner\\cache"
}
```

- 러너는 PATH가 아니라 **adb_path**를 직접 사용.
- 러너는 시작 시 **runner_version**을 heartbeat/callback에 포함.

---

## Windows Service (WinSW)

- 서비스명: **DoaiNodeRunner**
- 자동 시작(AutoStart), 크래시 시 재시작, stdout/stderr → `C:\ProgramData\doai\node-runner\logs\`
- **실행 커맨드:** `winsw.exe install | start | stop | restart | uninstall`

---

## install.ps1 요구사항

- 관리자 권한 가정.
- 디렉토리 생성 → config.json 없으면 템플릿 생성(기본값, node_id/secret/url은 사용자 수정) → zip 파일 배치 → 서비스 install + start.
- **config.json이 이미 있으면 절대 덮어쓰지 않음.**

---

## update.ps1 요구사항 (삭제/재다운로드 없이 업그레이드)

- GitHub Releases 최신 릴리즈 조회 → zip 다운로드 → sha256 검증(sha256sums.txt) → 서비스 stop → node-runner.exe 교체(config 유지) → 서비스 start.
- 실패 시 롤백: 교체 전 **node-runner.exe.bak** 백업.

---

## 러너 빌드 방식 (권장)

- Node 기반이면 **pkg** 또는 **nexe**로 node-runner.exe 생성.
- 실행 인자: `--config "C:\ProgramData\doai\node-runner\config.json"` 지원.
- 로그: 파일 + 콘솔 둘 다 (서비스 환경에서는 WinSW가 수집).

---

## GitHub Actions (릴리즈 자동화)

- 태그 **vX.Y.Z** 푸시 시: Windows x64 빌드 → node-runner.exe 생성 → zip 패키징(위 파일 포함) → sha256sums.txt 생성 → GitHub Release 생성 + zip 업로드.

---

## 서버 연동 최소 요구 (API)

- `POST /api/nodes/heartbeat` (X-Node-Auth)
- `POST /api/nodes/pull`
- `POST /api/nodes/callback` (event_id 멱등, lease_token 포함)

러너 전송 필드: node_id, runner_version, device_snapshot(가능 시), job lease_token, event_id.

---

## 완료 기준 (수용 테스트)

1. 노드 PC에 zip 풀고 install.ps1 실행 → 서비스 등록, 재부팅 후 자동 시작.
2. config.json만 수정(서버 URL/노드ID/secret) → 서버에 heartbeat 수신.
3. ADB는 xiaowei tools 경로로 `adb devices` 정상 실행.
4. update.ps1 실행 → 서비스 stop → 교체 → start, 버전 갱신.
5. GitHub Release에 버전별 zip 누적.

---

## 구현 팁

- 러너는 “자기 자신 교체” 하지 않음. **update.ps1**가 교체 담당.
- config/로그: ProgramData, 바이너리: Program Files 분리.
- NODE_SHARED_SECRET은 config에 두고, install 시 config 파일 ACL 강화(가능하면).

---

## Repo에 포함된 템플릿 파일

| 파일 | 경로 |
|------|------|
| WinSW 서비스 XML | [tools/winsw/node-runner-service.xml](../../tools/winsw/node-runner-service.xml) |
| install.ps1 | [tools/winsw/install.ps1](../../tools/winsw/install.ps1) |
| update.ps1 | [tools/winsw/update.ps1](../../tools/winsw/update.ps1) |
| GitHub Actions | [.github/workflows/release-node-runner.yml](../../.github/workflows/release-node-runner.yml) |

전제: 노드 러너는 **node-runner.exe**, 실행 인자 `--config "<path>"` 지원.

**WinSW 바이너리:** 라이선스 확인 후 repo에 포함하거나, Actions에서 다운로드해 zip에 포함.

**node-agent 참고:** 현재 `node-agent`는 ESM(`"type": "module"`)이라 **pkg**는 그대로 적용되지 않음. exe 빌드 전에 (1) `--config <path>`로 config.json 로딩 추가, (2) CJS 번들(esbuild 등) 생성 후 pkg 적용하거나, CJS 엔트리 래퍼를 두고 pkg 대상으로 사용할 것.

---

## 현장 설치 1분 체크

노드 PC (관리자 PowerShell):

1. zip 풀기
2. `.\install.ps1` 실행
3. `C:\ProgramData\doai\node-runner\config.json` 수정
4. 서비스 재시작: `C:\Program Files\doai\node-runner\winsw.exe restart`

**update.ps1 사용 예:**  
`.\update.ps1 -RepoOwner <owner> -RepoName <repo>` (최신 릴리즈 zip + sha256 검증 후 교체)

---

## 개발 에이전트 핸드오프 프롬프트 (복붙용)

아래를 그대로 개발 에이전트에게 주면 된다. **정확한 수정 포인트**(엔트리 경로·빌드 툴·Actions pkg 단계 치환)는 [node-runner-exe-build-points.md](node-runner-exe-build-points.md) 참고.

---

**목표**  
Windows 노드 PC에서 GitHub 없이 동작하는 node-runner.exe를 만들고, WinSW Windows Service로 등록해 재부팅 후 자동 실행. 배포/업데이트는 GitHub Releases 기반. 노드는 update.ps1로 삭제 없이 교체 업데이트 가능해야 함.  
참고: repo에 docs/guide/node-runner-windows-packaging.md가 있으면 "목표~완료 기준" 섹션을 본 작업의 상위 스펙으로 준수할 것.

**현재 전제**  
ADB 고정 경로: `C:\Program Files (x86)\xiaowei\tools\adb.exe`. 노드 PC는 레포 clone 안 함. config: `C:\ProgramData\doai\node-runner\config.json`. 배포: GitHub Releases zip.

**해야 할 작업 (우선순위)**  
1) node-runner에 **--config** 옵션 추가 (필수). 실행 예: `node-runner.exe --config "C:\ProgramData\doai\node-runner\config.json"`. config 스키마: server_base_url, node_id, node_shared_secret, adb_path(기본 xiaowei), poll_interval_ms, max_jobs. PATH 의존 없이 adb_path로 직접 실행. 로그: stdout/stderr(서비스는 WinSW 수집), 가능하면 파일 로그 옵션.  
2) **exe 빌드 가능**하게 엔트리/번들 정리 (필수). pkg/nexe가 먹도록 엔트리를 CJS 단일 파일(예: dist/node-runner.cjs)로. tsup/esbuild로 번들 후 pkg.  
3) **GitHub Actions** pkg 단계 경로 수정 (필수). pkg 입력 = CJS 번들 파일, 출력 = dist/node-runner.exe. v* 태그 시 exe → zip → sha256 → Release 업로드.  
4) Release zip 구성: node-runner.exe, winsw.exe, node-runner-service.xml, install.ps1, update.ps1, sha256sums.txt. 설치 경로: Program Files(바이너리), ProgramData(config/logs/cache).  
5) 서비스: DoaiNodeRunner, AutoStart+실패재시작, args에 --config 포함. install.ps1는 config 없으면 템플릿(덮어쓰기 금지), 서비스 install/start. update.ps1는 최신 릴리즈 → zip → sha256 → stop → exe 교체 → start, 실패 시 .bak 롤백.

**서버 연동**  
POST /api/nodes/heartbeat (runner_version 포함), POST /api/nodes/pull, POST /api/nodes/callback (event_id 멱등, lease_token 필수).

**완료 기준**  
(1) zip만 복사 후 install.ps1 → 서비스 등록·실행. (2) config에서 URL/node_id/secret만 수정 → heartbeat/pull 수신. (3) adb는 xiaowei 경로로 adb devices 정상. (4) update.ps1 -RepoOwner exe-blue -RepoName doai-me-app → stop/교체/start. (5) GitHub Releases에 버전별 zip, sha256 검증 통과.

**추가**  
자기 자신 업데이트는 러너가 하지 않고 update.ps1가 수행. config/로그는 ProgramData, 실행파일은 Program Files. node_id 예: PC-01~PC-04.
