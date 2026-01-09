# 구조 마이그레이션 가이드

> 현재 레포 구조를 권장 구조로 정리하기 위한 가이드

## 현재 구조 → 권장 구조 매핑

| 현재 | 권장 | 상태 |
|------|------|------|
| `apps/dashboard/` | `apps/web/` | 리네이밍 필요 |
| `central-orchestrator/` | `apps/orchestrator/` | 이동 필요 |
| `node-runner/` | `apps/node-runner/` | ✅ 완료 |
| (분산) | `infra/` | ✅ 생성됨 |
| (분산) | `orion/` | ✅ 생성됨 |

## 마이그레이션 명령어

```bash
# 1. 브랜치 생성
git checkout -b ops/repo-cleanup

# 2. 폴더 이동 (Git 히스토리 유지)
git mv apps/dashboard apps/web
git mv central-orchestrator apps/orchestrator
git mv node-runner apps/node-runner

# 3. Import 경로 업데이트
# - Docker 설정의 경로 수정
# - systemd 서비스의 WorkingDirectory 수정
# - deploy 스크립트의 경로 수정

# 4. 테스트
# - 로컬에서 각 서비스 실행 확인
# - Docker Compose로 통합 테스트

# 5. 커밋 & PR
git add .
git commit -m "chore: restructure repo to standard layout

- Move apps/dashboard to apps/web
- Move central-orchestrator to apps/orchestrator
- Move node-runner to apps/node-runner
- Add infra/, orion/, docs/ standard structure"

git push origin ops/repo-cleanup
```

## 마이그레이션 체크리스트

### Pre-Migration
- [ ] 현재 코드가 main에서 정상 동작 확인
- [ ] 백업 (태그 또는 스냅샷)
- [ ] 팀에 작업 공지

### Migration
- [ ] 브랜치 생성
- [ ] 폴더 이동
- [ ] 경로 참조 업데이트
  - [ ] Dockerfile
  - [ ] docker-compose.yml
  - [ ] systemd 서비스 파일
  - [ ] 배포 스크립트
  - [ ] import 구문 (상대 경로)
- [ ] 로컬 테스트
- [ ] CI 통과

### Post-Migration
- [ ] PR 리뷰 & 머지
- [ ] Vultr 서버 배포 업데이트
- [ ] 노드 서비스 경로 업데이트
- [ ] 문서 업데이트 완료 확인
- [ ] 팀에 완료 공지

## 롤백 계획

```bash
# 머지 전: PR 닫기
git checkout main
git branch -D ops/repo-cleanup

# 머지 후: Revert PR 생성
git revert -m 1 <merge-commit-hash>
git push origin main
```

## 주의사항

1. **CI/CD 파이프라인**
   - `.github/workflows/` 파일의 경로 수정 필요
   - 캐시 경로도 확인

2. **환경변수**
   - `WorkingDirectory` 변경 시 systemd 재로드 필요
   ```bash
   systemctl daemon-reload
   systemctl restart doai-orchestrator
   ```

3. **Docker 볼륨**
   - 볼륨 마운트 경로 확인
   - 기존 데이터 유실 주의

## 완료 기준

- [ ] 모든 서비스가 새 경로에서 정상 동작
- [ ] CI/CD 파이프라인 통과
- [ ] 문서가 새 구조 반영
- [ ] 팀원들이 새 구조 인지

