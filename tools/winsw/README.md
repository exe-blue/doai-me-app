# WinSW — Node Runner Windows Service

- **node-runner-service.xml** — WinSW 서비스 설정 (DoaiNodeRunner, 자동 시작, 재시작 정책).
- **node-runner-setup.iss** — Inno Setup 스크립트. PS1 의존 없음. 설치 시 ProgramData·config(onlyifdoesntexist), winsw install/start; 제거 시 winsw stop/uninstall. 빌드: `iscc /DMyAppVersion=0.1.0 node-runner-setup.iss`.
- **install.ps1** — zip 수동 설치용: 디렉토리 생성, config 템플릿, 서비스 등록.
- **update.ps1** — GitHub Releases에서 최신 zip 다운로드 → sha256 검증 → exe 교체 → 서비스 재시작.

**winsw.exe** 는 리포에 포함하지 않음. GitHub Actions [release-node-runner.yml](../../.github/workflows/release-node-runner.yml)에서 릴리즈 시 다운로드해 zip/setup에 포함함. 로컬 수동 패키징 시 [WinSW Releases](https://github.com/winsw/winsw/releases)에서 `WinSW-x64.exe`를 받아 `tools/winsw/winsw.exe`에 두면 됨.

전체 절차: [docs/guide/node-runner-windows-packaging.md](../../docs/guide/node-runner-windows-packaging.md)
