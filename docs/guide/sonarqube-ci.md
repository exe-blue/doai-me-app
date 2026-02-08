# SonarQube Cloud + GitHub Actions (CI 분석)

이 프로젝트는 **CI 기반 분석**만 사용합니다. SonarCloud에서 **Automatic Analysis**가 켜져 있으면 CI 분석과 충돌해 다음 오류로 실패합니다.

```
ERROR You are running CI analysis while Automatic Analysis is enabled.
Please consider disabling one or the other.
EXECUTION FAILURE ... exit code 3
```

## 해결 방법: Automatic Analysis 끄기

**한쪽만 사용해야 합니다.** CI에서 스캔을 돌리므로 SonarCloud 쪽 **Automatic Analysis**를 끕니다.

### 1) 조직(Organization) 설정 (권장)

조직 관리자만 가능합니다.

1. [SonarCloud](https://sonarcloud.io) 로그인 → 해당 **Organization** 선택
2. **Administration** → **Organization Settings** → **Analysis**
3. **Analysis method** → **Automatic Analysis** 에서  
   **"Enabled for new projects"** 체크 해제
4. (이미 만든 프로젝트는 아래 2)에서 프로젝트별로 끌 수 있음)

참고: [Disabling automatic analysis (SonarCloud 문서)](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-organization/setting-config-at-org-level/disabling-automatic-analysis)

### 2) 프로젝트별 설정

이미 생성된 프로젝트에서 Automatic Analysis만 끄려면:

1. SonarCloud에서 해당 **Project** 선택 (예: `exe-blue_doai-me-app`)
2. **Project Settings** (또는 **Administration** → **Project Settings**) → **Analysis** / **Analysis method**
3. 분석 방법을 **CI-based** 로 두고, **Automatic Analysis**가 켜져 있으면 끄기  
   (메뉴 이름/위치는 SonarCloud 버전에 따라 다를 수 있음)

설정 후 다음 push 또는 PR에서 **Build** 워크플로의 SonarQube 스텝이 정상 완료되어야 합니다.

### 3) 파이프라인 블로커 회피 (임시 조치)

Automatic Analysis를 끄기 전까지 파이프라인을 막지 않으려면, `build.yml`의 sonarqube job에 `continue-on-error: true`가 이미 설정되어 있습니다. Sonar 단계가 exit 3로 실패해도 PR/빌드는 통과합니다. **권장**: Automatic Analysis를 끄고 `continue-on-error`를 제거하는 것이 좋습니다.

## 요약

| 원인 | CI 분석(우리 워크플로) + Automatic Analysis(SonarCloud) 동시 사용 |
| 해결 | SonarCloud에서 **Automatic Analysis** 끄기 → **CI만** 사용 |
| 임시 조치 | build.yml sonarqube job에 `continue-on-error: true` (이미 적용됨) |
