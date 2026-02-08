# 키 회전 — 즉시 실행할 작업

> .env에 노출된 키를 회전했습니다. 아래 작업을 **즉시** 완료하세요.

---

## ✅ 완료됨

- **NODE_AGENT_SHARED_SECRET**: 새 값으로 교체됨  
  - `.env`, `.env.local`, `node-agent/.env` 반영 완료

---

## ⬜ 사용자가 직접 해야 할 작업

### 1. Vercel 환경변수 업데이트

1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. `NODE_AGENT_SHARED_SECRET` 값을 아래로 변경:

```
dfa363bd3a7aa1e9df22d0f80ae642a082e8351ac3f38d149c7b75029d9e2c32
```

3. 재배포 (또는 다음 배포 시 자동 반영)

---

### 2. Supabase Service Role Key 회전

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 `gzxadqjgjdfvlrwvhhjm`
2. Settings → API → **Reveal** service_role key
3. **Regenerate** service_role key (기존 키 즉시 무효화)
4. 새 키를 `.env`, `.env.local`, `node-agent/.env`의 `SUPABASE_SERVICE_ROLE_KEY`에 반영

---

### 3. YouTube API Key 회전

1. [Google Cloud Console](https://console.cloud.google.com/) → API & Services → Credentials
2. 기존 YouTube API 키 **삭제** 또는 **제한** 후 새 키 생성
3. 새 키를 `.env`, `.env.local`의 `YOUTUBE_API_KEY`에 반영

---

## PC-01~04 노드

각 노드 PC의 `node-agent/.env`에 **동일한** `NODE_AGENT_SHARED_SECRET`이 있어야 합니다:

```
NODE_AGENT_SHARED_SECRET=dfa363bd3a7aa1e9df22d0f80ae642a082e8351ac3f38d149c7b75029d9e2c32
```

현재 `node-agent/.env`는 이미 반영됨. 다른 PC에는 수동 복사 필요.
