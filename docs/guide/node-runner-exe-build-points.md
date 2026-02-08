# Node Runner exe 빌드 — 정확한 수정 포인트

> 개발 에이전트용. `docs/guide/node-runner-windows-packaging.md`의 목표~완료 기준을 상위 스펙으로 준수한 뒤, 아래 3개 + 워크플로 치환만 적용하면 된다.

---

## 이걸 어떻게 실행해야 하나?

| 하고 싶은 것 | 실행 방법 |
|--------------|-----------|
| **지금(맥)에서 러너만 로컬 실행** | `cd node-agent` → `.env` 채우기 → `npm install` → `npm run build` → `node dist/index.js` (또는 `npm run dev`) |
| **exe 빌드/릴리즈 작업을 개발 에이전트에게 맡기기** | [node-runner-windows-packaging.md](node-runner-windows-packaging.md) 맨 아래 **「개발 에이전트 핸드오프 프롬프트 (복붙용)」** 블록 전체를 복사해 에이전트에게 붙여넣기. 이 문서(node-runner-exe-build-points.md)는 수정 포인트·워크플로 치환용. |
| **릴리즈 zip 만들기(태그 푸시)** | `git tag -a v0.1.1 -m "..."` → `git push origin v0.1.1`. GitHub Actions `release-node-runner`가 돌면서 exe → zip → Release에 첨부. (CJS 번들+--config 적용된 뒤부터 성공) |
| **노드 PC(윈도우)에서 실행** | 1) Releases에서 `node-runner-win-x64-v*.zip` 내려받기 2) 풀기 3) 관리자 PowerShell에서 `.\install.ps1` 4) `C:\ProgramData\doai\node-runner\config.json` 수정 5) `C:\Program Files\doai\node-runner\winsw.exe restart` (업데이트: `.\update.ps1 -RepoOwner exe-blue -RepoName doai-me-app`) |

---

## 1. 러너 엔트리 파일 경로

| 항목 | 값 |
|------|-----|
| **소스 엔트리** | `node-agent/src/index.ts` |
| **tsc 출력** | `node-agent/dist/index.js` (및 기타 .js) — **ESM** (NodeNext) |
| **pkg용 CJS 번들(신규)** | `node-agent/dist/node-runner.cjs` 또는 프로젝트 루트 `dist/node-runner.cjs` |

엔트리는 **한 곳**: `node-agent/src/index.ts`. 여기서 `--config` 파싱 및 config.json 로딩을 추가한다.

---

## 2. 현재 빌드 툴

| 항목 | 값 |
|------|-----|
| **현재** | `tsc` 만 사용 (`node-agent/package.json` → `"build": "tsc"`) |
| **출력** | ESM (`module: "NodeNext"`), 다중 파일 (`node-agent/dist/*.js`) |
| **필요** | **CJS 단일 파일**이 있어야 pkg가 안정 동작. 따라서 **tsup 또는 esbuild**로 번들 단계 추가 필요. |

권장 예:

- **tsup:** `node-agent/package.json`에 `"bundle": "tsup src/index.ts --format cjs --outDir dist --minify --no-splitting"` → 출력 예: `node-agent/dist/index.cjs`
- **esbuild:** `esbuild node-agent/src/index.ts --bundle --platform=node --format=cjs --outfile=node-agent/dist/node-runner.cjs`

그 후 **pkg 입력**은 이 단일 CJS 파일만 가리키면 된다.

---

## 3. GitHub Actions에서 pkg 입력이 가리키는 곳

| 항목 | 값 |
|------|-----|
| **현재** | `node-agent/dist/index.js` (ESM → pkg 비권장/실패 가능) |
| **변경 후** | CJS 번들 파일 하나. 예: `node-agent/dist/node-runner.cjs` 또는 `node-agent/dist/index.cjs` |

워크플로는 **먼저 CJS 번들 생성**, 그 다음 **pkg는 그 파일만** 입력으로 사용한다.

---

## 4. 워크플로 "Build node-runner.exe" 단계 — 이렇게 바꿔라

**파일:** `.github/workflows/release-node-runner.yml`

**기존:**  
`Build node-agent` → `Build node-runner.exe`에서 `node-agent/dist/index.js`를 pkg에 넘기는 블록 전체.

**교체:** 아래 블록으로 치환.

```yaml
      # 1) tsc 빌드 (기존)
      - name: Build node-agent
        working-directory: node-agent
        run: npm run build

      # 2) CJS 단일 번들 생성 (tsup 또는 esbuild — 프로젝트 선택에 맞게 하나만)
      - name: Bundle node-runner CJS
        shell: pwsh
        run: |
          cd node-agent
          npx tsup src/index.ts --format cjs --outDir dist --minify --no-splitting --outExtension '{"cjs":"cjs"}'
          if (-not (Test-Path dist/index.cjs)) { throw "dist/index.cjs not found" }
          # 또는 esbuild 사용 시:
          # npx esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=dist/node-runner.cjs

      # 3) pkg로 exe 생성 (입력 = CJS 번들 파일 하나)
      - name: Build node-runner.exe
        shell: pwsh
        run: |
          npm install -g pkg
          $cjs = "node-agent/dist/index.cjs"
          if (-not (Test-Path $cjs)) { $cjs = "node-agent/dist/node-runner.cjs" }
          if (-not (Test-Path $cjs)) { throw "CJS bundle not found. Expected index.cjs or node-runner.cjs in node-agent/dist" }
          New-Item -ItemType Directory -Force -Path dist | Out-Null
          pkg -t node20-win-x64 -o dist/node-runner.exe $cjs
          if (-not (Test-Path dist/node-runner.exe)) { throw "dist/node-runner.exe not found" }
```

- tsup 사용 시: `node-agent/package.json`에 `devDependencies`에 `tsup` 추가, 위처럼 `tsup src/index.ts ...` 실행.
- esbuild 사용 시: `npx esbuild ...`로 번들하고, `$cjs`를 `node-agent/dist/node-runner.cjs`로 맞추면 됨.

---

## 5. 체크리스트 (구현 순서)

1. **node-agent**에 `--config <path>` 지원 추가. config 스키마: server_base_url, node_id, node_shared_secret, adb_path, poll_interval_ms, max_jobs. adb는 PATH가 아니라 adb_path로 실행.
2. **node-agent**에 CJS 번들 스크립트 추가 (tsup 또는 esbuild). 출력: `node-agent/dist/*.cjs` 단일 파일.
3. **release-node-runner.yml**의 "Build node-agent" 다음에 "Bundle node-runner CJS" 단계 추가, "Build node-runner.exe"는 위처럼 CJS 파일만 pkg에 넘기도록 수정.
4. Release zip 구성·install.ps1·update.ps1·WinSW 설정은 이미 repo에 있으므로, 경로/이름만 위와 맞추면 됨.

---

## 참고

- 상위 스펙: [node-runner-windows-packaging.md](node-runner-windows-packaging.md)
- WinSW/스크립트: [tools/winsw/](../../tools/winsw/)
