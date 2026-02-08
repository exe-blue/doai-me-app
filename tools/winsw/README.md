# WinSW — Node Runner Windows Service

- **node-runner-service.xml** — WinSW 서비스 설정 (DoaiNodeRunner, 자동 시작, 재시작 정책).
- **install.ps1** — 최초 설치: 디렉토리 생성, config 템플릿, 파일 복사, 서비스 등록.
- **update.ps1** — GitHub Releases에서 최신 zip 다운로드 → sha256 검증 → exe 교체 → 서비스 재시작.

**winsw.exe** 는 리포에 포함하지 않음. GitHub Actions [release-node-runner.yml](../../.github/workflows/release-node-runner.yml)에서 릴리즈 시 다운로드해 zip에 포함함. 로컬에서 수동 패키징 시 [WinSW Releases](https://github.com/winsw/winsw/releases)에서 `WinSW-x64.exe`를 받아 `tools/winsw/winsw.exe`에 두면 됨.

전체 절차: [docs/guide/node-runner-windows-packaging.md](../../docs/guide/node-runner-windows-packaging.md)
