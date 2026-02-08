# 배포 도메인

이 프로젝트의 **공식 배포 도메인**은 아래와 같다.

| 도메인 | 용도 |
|--------|------|
| **doai.me** | Production 루트 (apex) |
| **\*.doai.me** | 서브도메인 전부 (예: www.doai.me, api.doai.me 등) |
| **doai-me-app-git-main-exe-blue.vercel.app** | Vercel 자동 배포 (main) |
| **doai-me-5hpzkjvzu-exe-blue.vercel.app** | Vercel 자동 배포 (프로젝트) |

## Vercel에서 설정

도메인은 Vercel Dashboard에서만 등록한다 (레포 설정 파일로는 지정 불가).

1. **Vercel** → 프로젝트 선택 → **Settings** → **Domains**
2. 다음을 추가:
   - **doai.me**
   - **\*.doai.me** (와일드카드 서브도메인)
3. Vercel이 안내하는 **DNS 레코드**를 도메인 등록처(가비아, Cloudflare 등)에 반영:
   - doai.me → Vercel이 안내한 A 또는 CNAME
   - \*.doai.me → Vercel이 안내한 CNAME

DNS 전파 후 **https://doai.me** 및 **https://\<subdomain\>.doai.me** 가 이 프로젝트의 배포로 연결된다.

## Deploy Gate

배포 확인 시 기준 URL: **https://doai.me**  
체크 경로: `/`, `/health`, `/api/health`, `/dashboard`
