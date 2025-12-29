# AIFarm Dashboard - Mock 데이터 제거 및 실제 데이터 연동 가이드

## 완료된 작업

### 1. 데이터베이스 스키마 정의

- `DATABASE_SCHEMA.md` 파일에 모든 필요한 테이블 스키마 정의 완료
- PostgreSQL 기준으로 작성 (MySQL/SQLite 호환 가능)

### 2. 랜딩 페이지 Mock 데이터 제거

다음 컴포넌트의 Mock 데이터가 제거되었습니다:

- ✅ `HeroSection.tsx` - 통계를 0으로 표시
- ✅ `ActivitiesSection.tsx` - Mock 데이터 제거, 0 표시
- ✅ `ChannelsShowcase.tsx` - 채널 배열 비움, 빈 데이터 안내 메시지
- ✅ `DeviceVisualization.tsx` - 디바이스 배열 비움, 통계 0
- ✅ `BattleLogPreview.tsx` - 배틀 로그 배열 비움, 빈 데이터 안내

### 3. 대시보드 메인 페이지 Mock 데이터 제거

- ✅ `dashboard/page.tsx` - 모든 Mock import 제거, 빈 배열 사용

## 진행 중인 작업

### 나머지 대시보드 페이지 수정 필요

다음 페이지들은 아직 Mock 데이터를 사용 중입니다:

- `dashboard/activities/page.tsx`
- `dashboard/channels/page.tsx`
- `dashboard/devices/page.tsx`
- `dashboard/battle/page.tsx`
- `dashboard/do/page.tsx`
- `dashboard/ideas/page.tsx`
- `dashboard/notifications/page.tsx`
- `dashboard/ranking/page.tsx`
- `dashboard/trends/page.tsx`
- `dashboard/logs/page.tsx`

## 다음 단계

### 1. 데이터베이스 설정

#### PostgreSQL 사용 시

```bash
# 1. PostgreSQL 설치 및 실행
# 2. 데이터베이스 생성
createdb aifarm

# 3. DATABASE_SCHEMA.md의 스키마 실행
psql aifarm < schema.sql
```

#### Supabase 사용 시

1. Supabase 프로젝트 생성
2. SQL Editor에서 `DATABASE_SCHEMA.md`의 스키마 실행
3. 환경 변수 설정

### 2. 환경 변수 설정

`.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 또는 일반 PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/aifarm
```

### 3. Supabase 클라이언트 설정

`lib/supabase.ts` 파일 생성:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 4. API 라우트 생성

각 데이터 타입별로 API 라우트 생성 필요:

```text
app/api/
├── activities/
│   └── route.ts
├── channels/
│   └── route.ts
├── devices/
│   └── route.ts
├── battle-log/
│   └── route.ts
├── notifications/
│   └── route.ts
├── trends/
│   └── route.ts
└── stats/
    └── route.ts
```

#### 예시: `app/api/activities/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
```

### 5. React Query 설정

`lib/queries.ts` 파일 생성:

```typescript
import { useQuery } from '@tanstack/react-query'

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const res = await fetch('/api/activities')
      if (!res.ok) throw new Error('Failed to fetch activities')
      return res.json()
    },
  })
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const res = await fetch('/api/channels')
      if (!res.ok) throw new Error('Failed to fetch channels')
      return res.json()
    },
  })
}

// 다른 데이터 타입들도 동일하게...
```

### 6. 컴포넌트 수정

#### 예시: `components/landing/ActivitiesSection.tsx`

```typescript
'use client'

import { useActivities } from '@/lib/queries'
// ... 기타 imports

export function ActivitiesSection() {
  const { data: activities = [], isLoading } = useActivities()

  if (isLoading) {
    return <div>Loading...</div>
  }

  // ... 나머지 코드
}
```

### 7. 페이지 수정 패턴

각 페이지를 다음 패턴으로 수정:

```typescript
// Before (Mock 사용)
import { mockActivities } from '@/data/mock'

export default function Page() {
  const activities = mockActivities
  // ...
}

// After (실제 데이터 사용)
'use client'

import { useActivities } from '@/lib/queries'

export default function Page() {
  const { data: activities = [], isLoading, error } = useActivities()

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (activities.length === 0) return <EmptyState />

  // ...
}
```

## 데이터 초기화 (선택사항)

초기 데이터를 넣고 싶다면 `seed.sql` 파일 생성:

```sql
-- 기본 활동 데이터
INSERT INTO activities (id, name, icon, description, color) VALUES
  ('shorts_remix', 'Shorts 리믹스 팩토리', '🎬', '트렌딩 Shorts 분석 → AI 리믹스 아이디어 생성', 'cyan'),
  ('playlist_curator', 'AI DJ 플레이리스트', '🎵', '테마별 영상 탐색 → 플레이리스트 자동 구축', 'purple'),
  ('persona_commenter', '페르소나 코멘터', '💬', '10가지 AI 페르소나 → 대댓글 인터랙션', 'pink'),
  ('trend_scout', '트렌드 스카우터', '🕵️', '24시간 순찰 → Rising Star 발굴', 'yellow'),
  ('challenge_hunter', '챌린지 헌터', '🏅', '챌린지/밈 탐지 → 최적 참여 타이밍 추천', 'orange'),
  ('thumbnail_lab', '썸네일/제목 랩', '🔬', '썸네일/제목 분석 → CTR 예측 및 최적화', 'blue');

-- 오늘의 대시보드 통계
INSERT INTO dashboard_stats (recorded_at) VALUES (CURRENT_DATE);
```

## 패키지 설치

```bash
npm install @supabase/supabase-js
npm install @tanstack/react-query
npm install @tanstack/react-query-devtools
```

## 주의사항

1. **점진적 마이그레이션**: 한 번에 모든 페이지를 수정하지 말고, 하나씩 테스트하면서 진행
2. **타입 안전성**: TypeScript 타입을 데이터베이스 스키마와 일치시키기
3. **에러 처리**: 모든 API 호출에 적절한 에러 처리 추가
4. **로딩 상태**: 사용자 경험을 위한 로딩 스피너/스켈레톤 추가
5. **캐싱**: React Query의 캐싱 전략 활용

## 테스트 체크리스트

- [ ] 데이터베이스 스키마 생성 완료
- [ ] Supabase/PostgreSQL 연결 테스트
- [ ] API 라우트 동작 확인
- [ ] React Query 설정 및 데이터 페칭 테스트
- [ ] 빈 데이터 상태 UI 확인
- [ ] 로딩 상태 UI 확인
- [ ] 에러 상태 UI 확인
- [ ] 실제 데이터 표시 확인

## 참고 자료

- [Supabase 문서](https://supabase.com/docs)
- [React Query 문서](https://tanstack.com/query/latest)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
