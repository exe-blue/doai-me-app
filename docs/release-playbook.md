# Release Playbook (태그 기반, 혼선 제로)

팀 규칙용, 혼선 최소 버전.

---

## 원칙

- 릴리즈 빌드는 **오직 태그(vX.Y.Z) 푸시로만** 생성한다.
- main 브랜치 push/merge는 릴리즈를 만들지 않는다. (CI/테스트만)
- 릴리즈 산출물은 **GitHub Releases에 업로드된 파일**을 “정식 배포본”으로 간주한다.

## 사전 조건

- GitHub Actions 워크플로가 `on: push: tags: ["v*"]` 트리거를 가진다.
- Release 업로드 권한을 위해 워크플로에 `permissions: contents: write`가 설정돼 있어야 한다.
- 릴리즈 빌드에서 SonarQube/SonarCloud가 파이프라인을 실패로 만들지 않도록 **분리하거나 완화**되어야 한다.
- Windows EXE 빌드가 성공하도록 pkg 타겟 등 **필수 설정이 확정**돼 있어야 한다.

## 릴리즈 절차 (5-step)

1. main이 **그린 CI 상태**인지 확인한다. (빨간 CI면 릴리즈 금지)
2. 릴리즈할 커밋이 main에 포함되어 있는지 확인한다.
3. 로컬에서 **태그를 생성**한다. (예: v0.1.0)
4. **태그를 원격으로 푸시**한다. → GitHub Actions가 자동으로 빌드/업로드를 수행한다.
5. **GitHub Releases**에서 아래 파일이 올라왔는지 확인한다.
   - 예: `doai-node-runner-0.1.0-win-x64.exe` (또는 프로젝트에서 정한 표준 파일명)

## 태그 생성/푸시 명령 (macOS)

```bash
git checkout main
git pull

git tag v0.1.0
git push origin v0.1.0
```

## 핫픽스 규칙

- 수정이 필요하면 코드를 main에 반영한 뒤 **버전만 올려서** 다시 태그를 푸시한다.
- 예: v0.1.0 → v0.1.1

## 실패 시 확인 순서 (최단)

1. **GitHub Actions**에서 해당 태그 빌드가 실행됐는지 확인
   - 실행 자체가 없으면: tags 트리거 설정 문제
2. 실행은 됐는데 실패면, 실패 Job이 **Sonar / build-windows / release-upload** 중 어디인지 확인
   - Sonar에서 막히면: 릴리즈 워크플로 분리/완화 필요
   - build-windows에서 막히면: EXE 생성 단계(타겟/입력/출력 경로) 점검
   - upload에서 막히면: `contents: write` 및 업로드 step 점검

## 산출물 기준

- **“릴리즈 완료”**는 Releases에 EXE(또는 설치 파일)가 **존재할 때만** 성립한다.
- ZIP/스크립트/로컬 빌드는 참고용이며, **운영 배포본은 Releases asset을 기준**으로 한다.
