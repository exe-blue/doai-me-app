# Supabase 데이터베이스 구축 가이드

## 📋 개요

YouTube 자동화 시스템의 **Supabase** 데이터베이스 구축 및 설정 가이드입니다.

### Supabase 선택 이유
- ✅ 호스팅된 PostgreSQL (관리 부담 없음)
- ✅ 실시간 구독 (Realtime) - 기기 상태 실시간 업데이트
- ✅ Row Level Security (RLS) - 보안
- ✅ 자동 REST API 생성 (PostgREST)
- ✅ Edge Functions - 서버리스 함수
- ✅ 스토리지 - 스크린샷 저장
- ✅ 대시보드 UI - 데이터 관리 편리

---

## 🚀 1. Supabase 프로젝트 생성

### Step 1: 계정 생성 및 프로젝트 만들기

1. [Supabase](https://supabase.com) 접속
2. GitHub 또는 이메일로 가입
3. **New Project** 클릭
4. 프로젝트 설정:
   - **Name**: `youtube-automation`
   - **Database Password**: 강력한 비밀번호 설정 (저장 필수!)
   - **Region**: `Northeast Asia (Seoul)` 또는 가까운 리전
   - **Pricing Plan**: Free tier로 시작 가능

5. 프로젝트 생성 완료까지 약 2분 대기

### Step 2: 연결 정보 확인

프로젝트 대시보드에서 **Settings > Database**로 이동:

```
Host: db.xxxxxxxxxxxxx.supabase.co
Database name: postgres
Port: 5432 (Transaction) / 6543 (Session)
User: postgres
Password: [설정한 비밀번호]
```

**Settings > API**에서:
```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon (public) key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (비공개!)
```

---

## 🗄️ 2. 데이터베이스 스키마 설정

### Supabase SQL Editor에서 실행

Supabase 대시보드 > **SQL Editor** > **New Query**

```sql
-- =============================================
-- YouTube 자동화 시스템 - Supabase 스키마
-- =============================================

-- 영상 테이블
CREATE TABLE IF NOT EXISTS videos (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    keyword VARCHAR(255),
    duration INTEGER,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    completed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 영상 RLS 정책
-- service_role: 백엔드 서비스용 전체 권한
-- anon: 프론트엔드 대시보드용 읽기 전용
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자 및 서비스 계정 허용
CREATE POLICY "videos_select_service" ON videos FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "videos_select_authenticated" ON videos FOR SELECT
    TO authenticated
    USING (true);

-- 대시보드 읽기용 (anon key)
CREATE POLICY "videos_select_anon" ON videos FOR SELECT
    TO anon
    USING (true);

-- INSERT/UPDATE/DELETE: service_role만 허용 (백엔드 전용)
CREATE POLICY "videos_insert_service" ON videos FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "videos_update_service" ON videos FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "videos_delete_service" ON videos FOR DELETE
    TO service_role
    USING (true);

-- =============================================
-- 2. 기기 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    pc_id VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('idle', 'busy', 'offline', 'error', 'overheat')),
    last_heartbeat TIMESTAMPTZ,
    battery_temp FLOAT,
    cpu_usage FLOAT,
    memory_usage FLOAT,
    battery_level INTEGER,
    total_tasks INTEGER DEFAULT 0,
    success_tasks INTEGER DEFAULT 0,
    error_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기기 RLS 정책
-- 기기 정보는 민감할 수 있으므로 service_role 위주로 제어
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자 및 서비스 계정 허용
CREATE POLICY "devices_select_service" ON devices FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "devices_select_authenticated" ON devices FOR SELECT
    TO authenticated
    USING (true);

-- 대시보드 읽기용 (anon key) - 기기 상태 모니터링
CREATE POLICY "devices_select_anon" ON devices FOR SELECT
    TO anon
    USING (true);

-- INSERT/UPDATE/DELETE: service_role만 허용 (PC 클라이언트/백엔드 전용)
CREATE POLICY "devices_insert_service" ON devices FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "devices_update_service" ON devices FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "devices_delete_service" ON devices FOR DELETE
    TO service_role
    USING (true);

-- =============================================
-- 3. 작업 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5,
    pattern_config JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 작업 RLS 정책
-- 작업 큐는 service_role에서만 생성/수정, 조회는 허용
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자 및 서비스 계정 허용
CREATE POLICY "tasks_select_service" ON tasks FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "tasks_select_authenticated" ON tasks FOR SELECT
    TO authenticated
    USING (true);

-- 대시보드 읽기용 (anon key)
CREATE POLICY "tasks_select_anon" ON tasks FOR SELECT
    TO anon
    USING (true);

-- INSERT/UPDATE/DELETE: service_role만 허용 (작업 스케줄러 전용)
CREATE POLICY "tasks_insert_service" ON tasks FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "tasks_update_service" ON tasks FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "tasks_delete_service" ON tasks FOR DELETE
    TO service_role
    USING (true);

-- =============================================
-- 4. 결과 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id),
    video_id UUID NOT NULL REFERENCES videos(id),
    watch_time INTEGER NOT NULL,
    total_duration INTEGER NOT NULL,
    watch_percent FLOAT GENERATED ALWAYS AS (
        CASE WHEN total_duration > 0 THEN (watch_time::FLOAT / total_duration) * 100 ELSE 0 END
    ) STORED,
    liked BOOLEAN DEFAULT FALSE,
    commented BOOLEAN DEFAULT FALSE,
    comment_text TEXT,
    search_type INTEGER CHECK (search_type IN (1, 2, 3, 4)),
    search_rank INTEGER DEFAULT 0,
    screenshot_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결과 RLS 정책
-- 결과 데이터는 통계/분석에 사용되므로 조회 허용, 수정은 제한
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자 및 서비스 계정 허용 (통계 조회용)
CREATE POLICY "results_select_service" ON results FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "results_select_authenticated" ON results FOR SELECT
    TO authenticated
    USING (true);

-- 대시보드 읽기용 (anon key) - 통계 대시보드
CREATE POLICY "results_select_anon" ON results FOR SELECT
    TO anon
    USING (true);

-- INSERT: service_role만 허용 (기기에서 결과 저장 시)
CREATE POLICY "results_insert_service" ON results FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE/DELETE: service_role만 허용 (데이터 정정용)
CREATE POLICY "results_update_service" ON results FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "results_delete_service" ON results FOR DELETE
    TO service_role
    USING (true);

-- =============================================
-- 5. 패턴 로그 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS pattern_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 패턴 로그 RLS 정책
-- 패턴 로그는 디버깅/분석용, 조회 허용, 삽입은 service_role만
ALTER TABLE pattern_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자 및 서비스 계정 허용 (분석용)
CREATE POLICY "pattern_logs_select_service" ON pattern_logs FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "pattern_logs_select_authenticated" ON pattern_logs FOR SELECT
    TO authenticated
    USING (true);

-- 대시보드 읽기용 (anon key)
CREATE POLICY "pattern_logs_select_anon" ON pattern_logs FOR SELECT
    TO anon
    USING (true);

-- INSERT: service_role만 허용 (패턴 실행 시 로깅)
CREATE POLICY "pattern_logs_insert_service" ON pattern_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- =============================================
-- 6. 인덱스 생성
-- =============================================
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_priority ON videos(priority DESC);
CREATE INDEX IF NOT EXISTS idx_results_video_id ON results(video_id);
CREATE INDEX IF NOT EXISTS idx_results_device_id ON results(device_id);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at DESC);

-- =============================================
-- 7. 자동 업데이트 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 8. 뷰 생성
-- =============================================

-- 일별 통계 뷰
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_results,
    COUNT(*) FILTER (WHERE liked = TRUE) as likes,
    COUNT(*) FILTER (WHERE commented = TRUE) as comments,
    SUM(watch_time) as total_watch_time,
    ROUND(AVG(watch_percent)::numeric, 2) as avg_watch_percent
FROM results
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 영상별 통계 뷰
CREATE OR REPLACE VIEW video_stats AS
SELECT 
    v.id as video_id,
    v.title,
    v.status,
    COUNT(r.id) as result_count,
    COUNT(r.id) FILTER (WHERE r.liked = TRUE) as like_count,
    COUNT(r.id) FILTER (WHERE r.commented = TRUE) as comment_count,
    ROUND(AVG(r.watch_percent)::numeric, 2) as avg_watch_percent,
    SUM(r.watch_time) as total_watch_time
FROM videos v
LEFT JOIN results r ON v.id = r.video_id
GROUP BY v.id, v.title, v.status;

-- 대시보드 집계 뷰
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM videos) as total_videos,
    (SELECT COUNT(*) FROM videos WHERE status = 'pending') as pending_videos,
    (SELECT COUNT(*) FROM videos WHERE status = 'completed') as completed_videos,
    (SELECT COUNT(*) FROM devices) as total_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'idle') as idle_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'busy') as busy_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'offline') as offline_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'error') as error_devices,
    (SELECT COUNT(*) FROM tasks WHERE status = 'queued') as queued_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'running') as running_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
    (SELECT COUNT(*) FROM results) as total_results,
    (SELECT COALESCE(SUM(watch_time), 0) FROM results) as total_watch_time,
    (SELECT ROUND(AVG(watch_percent)::numeric, 2) FROM results) as avg_watch_percent,
    (SELECT ROUND((COUNT(*) FILTER (WHERE liked) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2) FROM results) as like_rate,
    (SELECT ROUND((COUNT(*) FILTER (WHERE commented) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2) FROM results) as comment_rate;

-- =============================================
-- 9. Realtime 활성화
-- =============================================
-- Supabase 대시보드에서 각 테이블에 대해 Realtime 활성화 필요
-- Database > Replication > 각 테이블 토글 ON

ALTER PUBLICATION supabase_realtime ADD TABLE videos;
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE results;

-- =============================================
-- 테이블 코멘트
-- =============================================
COMMENT ON TABLE videos IS '시청 대상 YouTube 영상 정보';
COMMENT ON TABLE devices IS '연결된 Android 기기 정보';
COMMENT ON TABLE tasks IS '작업 큐 및 상태 관리';
COMMENT ON TABLE results IS '시청 결과 및 통계';
COMMENT ON TABLE pattern_logs IS '적용된 휴먼 패턴 로그';
```

### Run Query 클릭하여 실행

---

## 🔌 3. 프론트엔드 Supabase 연동

### Supabase 클라이언트 설치

```bash
cd D:\exe.blue\ai-fram\frontend
npm install @supabase/supabase-js
```

### 환경 변수 설정

```env
# frontend/.env.local
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Supabase 클라이언트 생성

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// 실시간 구독 헬퍼
export const subscribeToTable = (
  table: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      callback
    )
    .subscribe()
}
```

### 타입 생성 (선택사항)

```bash
# Supabase CLI 설치
npm install -g supabase

# 타입 생성
supabase gen types typescript --project-id xxxxxxxxxxxxx > src/lib/database.types.ts
```

### API 함수 업데이트

```typescript
// frontend/src/lib/api.ts
import { supabase } from './supabase'

// =============================================
// 영상 API
// =============================================
export const videoApi = {
  list: async (params?: { status?: string; limit?: number }) => {
    let query = supabase
      .from('videos')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (params?.status) {
      query = query.eq('status', params.status)
    }
    if (params?.limit) {
      query = query.limit(params.limit)
    }

    const { data, error } = await query
    if (error) throw error

    // 통계 계산
    const stats = {
      total: data?.length || 0,
      pending: data?.filter(v => v.status === 'pending').length || 0,
      processing: data?.filter(v => v.status === 'processing').length || 0,
      completed: data?.filter(v => v.status === 'completed').length || 0,
      error: data?.filter(v => v.status === 'error').length || 0,
      videos: data || []
    }

    return { data: stats }
  },

  create: async (video: {
    url?: string
    title?: string
    keyword?: string
    duration?: number
    priority?: number
  }) => {
    const { data, error } = await supabase
      .from('videos')
      .insert(video)
      .select()
      .single()

    if (error) throw error
    return { data }
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// =============================================
// 기기 API
// =============================================
export const deviceApi = {
  list: async (params?: { status?: string; pc_id?: string }) => {
    let query = supabase
      .from('devices')
      .select('*')
      .order('last_heartbeat', { ascending: false })

    if (params?.status) {
      query = query.eq('status', params.status)
    }
    if (params?.pc_id) {
      query = query.eq('pc_id', params.pc_id)
    }

    const { data, error } = await query
    if (error) throw error

    const stats = {
      total: data?.length || 0,
      idle: data?.filter(d => d.status === 'idle').length || 0,
      busy: data?.filter(d => d.status === 'busy').length || 0,
      offline: data?.filter(d => d.status === 'offline').length || 0,
      error: data?.filter(d => d.status === 'error').length || 0,
      devices: data || []
    }

    return { data: stats }
  },

  heartbeat: async (id: string, health: {
    battery_temp?: number
    cpu_usage?: number
    memory_usage?: number
    battery_level?: number
    status?: string
  }) => {
    const { error } = await supabase
      .from('devices')
      .update({
        ...health,
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}

// =============================================
// 작업 API
// =============================================
export const taskApi = {
  list: async (params?: { status?: string; limit?: number }) => {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('priority', { ascending: false })
      .order('queued_at', { ascending: false })

    if (params?.status) {
      query = query.eq('status', params.status)
    }
    if (params?.limit) {
      query = query.limit(params.limit)
    }

    const { data, error } = await query
    if (error) throw error

    const stats = {
      total: data?.length || 0,
      queued: data?.filter(t => t.status === 'queued').length || 0,
      running: data?.filter(t => t.status === 'running').length || 0,
      completed: data?.filter(t => t.status === 'completed').length || 0,
      failed: data?.filter(t => t.status === 'failed').length || 0,
      tasks: data || []
    }

    return { data: stats }
  },

  create: async (task: {
    video_id: string
    device_id?: string
    priority?: number
  }) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()

    if (error) throw error
    return { data }
  }
}

// =============================================
// 통계 API
// =============================================
export const statsApi = {
  get: async () => {
    // 대시보드 집계
    const { data: dashboard } = await supabase
      .from('dashboard_stats')
      .select('*')
      .single()

    // 일별 통계 (최근 7일)
    const { data: daily } = await supabase
      .from('daily_stats')
      .select('*')
      .limit(7)

    return {
      data: {
        aggregated: {
          total_tasks: dashboard?.completed_tasks || 0,
          completed_tasks: dashboard?.completed_tasks || 0,
          total_watch_time: dashboard?.total_watch_time || 0,
          avg_watch_percent: dashboard?.avg_watch_percent || 0,
          like_rate: dashboard?.like_rate || 0,
          comment_rate: dashboard?.comment_rate || 0
        },
        daily: daily?.map(d => ({
          date: d.date,
          tasks_completed: d.total_results,
          watch_time: d.total_watch_time,
          likes: d.likes,
          comments: d.comments
        })) || []
      }
    }
  }
}

// =============================================
// 대시보드 API
// =============================================
export const dashboardApi = {
  get: async () => {
    const [videos, devices, stats] = await Promise.all([
      videoApi.list(),
      deviceApi.list(),
      statsApi.get()
    ])

    return {
      data: {
        videos: {
          total: videos.data.total,
          pending: videos.data.pending,
          completed: videos.data.completed
        },
        devices: {
          total: devices.data.total,
          idle: devices.data.idle,
          busy: devices.data.busy,
          offline: devices.data.offline,
          error: devices.data.error
        },
        stats: stats.data
      }
    }
  }
}
```

### 실시간 구독 예시 (기기 상태)

```typescript
// frontend/src/hooks/useDeviceRealtime.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToTable } from '../lib/supabase'

export function useDeviceRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const subscription = subscribeToTable('devices', (payload) => {
      // 기기 데이터 변경 시 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])
}
```

---

## 🔧 4. 환경 변수 설정

### 프론트엔드 (.env.local)

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# n8n (선택사항)
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/xxxxx
```

### 백엔드 서비스 (.env)

```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # service_role key

# PostgreSQL 직접 연결 (필요시)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# n8n Webhook
N8N_WEBHOOK_BASE_URL=https://your-n8n-instance.com/webhook
```

---

## 🧪 5. 테스트 데이터 삽입

Supabase SQL Editor에서 실행:

```sql
-- 테스트 영상
INSERT INTO videos (url, title, keyword, duration, priority, status, completed_count) VALUES
('https://youtube.com/watch?v=test1', '테스트 영상 1', '테스트', 300, 5, 'pending', 0),
('https://youtube.com/watch?v=test2', '테스트 영상 2', '자동화', 600, 8, 'processing', 0),
('https://youtube.com/watch?v=test3', '완료된 영상', 'YouTube', 180, 7, 'completed', 150);

-- 테스트 기기
INSERT INTO devices (serial_number, pc_id, model, status, battery_level, battery_temp, cpu_usage, total_tasks, success_tasks) VALUES
('RF8M33XYZAB', 'PC-001', 'Galaxy S21', 'idle', 85, 32.5, 15.2, 1250, 1180),
('9A231FFAZ00123', 'PC-001', 'Pixel 6', 'busy', 72, 38.2, 65.8, 980, 920),
('LGE-LM-G900N', 'PC-002', 'LG Velvet', 'offline', 45, 25.0, 0.0, 500, 480);

-- 하트비트 업데이트
UPDATE devices SET last_heartbeat = NOW() WHERE status != 'offline';

-- 테스트 작업 및 결과 (video_id, device_id 참조)
DO $$
DECLARE
    v_id UUID;
    d_id UUID;
    t_id UUID;
BEGIN
    SELECT id INTO v_id FROM videos WHERE title = '테스트 영상 1' LIMIT 1;
    SELECT id INTO d_id FROM devices WHERE model = 'Galaxy S21' LIMIT 1;
    
    INSERT INTO tasks (video_id, device_id, status, priority)
    VALUES (v_id, d_id, 'completed', 5)
    RETURNING id INTO t_id;
    
    INSERT INTO results (task_id, device_id, video_id, watch_time, total_duration, liked, commented, search_type, search_rank)
    VALUES (t_id, d_id, v_id, 180, 300, true, false, 1, 3);
END $$;
```

---

## 📊 6. Supabase 대시보드 활용

### Table Editor
- 데이터 직접 조회/수정
- 필터링, 정렬
- CSV 내보내기

### SQL Editor
- 커스텀 쿼리 실행
- 마이그레이션 스크립트 관리

### Realtime
- `Database > Replication`에서 테이블별 실시간 활성화
- videos, devices, tasks, results 모두 활성화 권장

### Storage
- 스크린샷 저장용 버킷 생성
- `screenshots` 버킷 생성 후 public 접근 설정

### Edge Functions
- 휴먼 패턴 생성 API
- n8n 웹훅 처리

---

## ✅ Supabase 설정 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] 서울 리전 선택
- [ ] 데이터베이스 비밀번호 저장
- [ ] SQL 스키마 실행 완료
- [ ] 5개 테이블 생성 확인
- [ ] RLS 정책 활성화
- [ ] Realtime 활성화 (4개 테이블)
- [ ] 환경 변수 설정 (.env.local)
- [ ] Supabase 클라이언트 설치
- [ ] 테스트 데이터 삽입
- [ ] 실시간 구독 테스트

---

## 🔗 유용한 Supabase CLI 명령어

```bash
# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref xxxxxxxxxxxxx

# 마이그레이션 생성
supabase migration new add_new_column

# 타입 생성
supabase gen types typescript --local > src/lib/database.types.ts

# 로컬 개발 서버
supabase start

# 상태 확인
supabase status
```
