-- YouTube Automation System v2
-- Supports Idle Mode (persona-based random watching) and Queue Mode (targeted video watching)

-- ============================================
-- 1. persona_youtube_history
-- Idle mode activity logging per persona
-- ============================================
CREATE TABLE IF NOT EXISTS persona_youtube_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID,  -- References personas(id) if exists
  device_serial TEXT NOT NULL,
  node_id UUID,

  -- Search info
  search_keyword VARCHAR(200) NOT NULL,
  keyword_source VARCHAR(30) DEFAULT 'ai_generated',  -- ai_generated, trait_based, fallback

  -- Video info
  video_title VARCHAR(500),
  video_channel VARCHAR(255),
  video_url VARCHAR(500),
  video_thumbnail VARCHAR(500),

  -- Watch metrics
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0,
  scroll_count INTEGER DEFAULT 0,

  -- Engagement
  liked BOOLEAN DEFAULT false,
  commented BOOLEAN DEFAULT false,
  comment_content TEXT,

  -- Human simulation config used
  human_simulation_config JSONB DEFAULT '{}',

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for persona_youtube_history
CREATE INDEX IF NOT EXISTS idx_persona_youtube_history_persona
  ON persona_youtube_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_youtube_history_device
  ON persona_youtube_history(device_serial);
CREATE INDEX IF NOT EXISTS idx_persona_youtube_history_created
  ON persona_youtube_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persona_youtube_history_keyword
  ON persona_youtube_history(search_keyword);

-- ============================================
-- 2. video_assignments
-- Queue mode: device-to-video assignment and results
-- ============================================
CREATE TABLE IF NOT EXISTS video_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID,  -- References videos(id)
  device_serial TEXT NOT NULL,
  node_id UUID,
  persona_id UUID,

  -- Assignment info
  priority INTEGER DEFAULT 5,  -- 1-10, higher = more urgent
  scheduled_at TIMESTAMPTZ,    -- NULL = immediate

  -- Execution status
  status VARCHAR(30) DEFAULT 'pending',  -- pending, in_progress, completed, failed, cancelled

  -- Watch results
  watch_duration_seconds INTEGER,
  target_duration_seconds INTEGER,  -- How long should watch

  -- Random actions performed during watch
  random_actions JSONB DEFAULT '[]',  -- [{type: "back_double", timestamp_sec: 45}, ...]

  -- Engagement results
  liked BOOLEAN DEFAULT false,
  commented BOOLEAN DEFAULT false,
  comment_content TEXT,

  -- Ad handling
  ad_skipped BOOLEAN DEFAULT false,
  ad_skip_time_seconds INTEGER,

  -- Human simulation config used
  human_simulation_config JSONB DEFAULT '{}',

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for video_assignments
CREATE INDEX IF NOT EXISTS idx_video_assignments_video
  ON video_assignments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_assignments_device
  ON video_assignments(device_serial);
CREATE INDEX IF NOT EXISTS idx_video_assignments_status
  ON video_assignments(status);
CREATE INDEX IF NOT EXISTS idx_video_assignments_scheduled
  ON video_assignments(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_assignments_pending
  ON video_assignments(priority DESC, assigned_at ASC) WHERE status = 'pending';

-- ============================================
-- 3. device_heartbeats
-- Device connection status monitoring
-- ============================================
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial TEXT NOT NULL,
  node_id UUID,

  -- Status info
  status VARCHAR(20) NOT NULL,  -- connected, disconnected, busy, idle, error
  battery_level INTEGER,        -- 0-100

  -- Current activity
  current_mode VARCHAR(20),     -- idle, queue, stopped, unknown
  current_task_id UUID,
  current_video_id UUID,

  -- Connection metrics
  latency_ms INTEGER,
  connection_quality VARCHAR(20),  -- excellent, good, fair, poor

  -- Timestamps
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for device_heartbeats
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_serial
  ON device_heartbeats(device_serial);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_last_seen
  ON device_heartbeats(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_status
  ON device_heartbeats(status);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_node
  ON device_heartbeats(node_id);

-- ============================================
-- 4. Add columns to videos table if needed
-- ============================================
DO $$
BEGIN
  -- Add total_likes_count if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'total_likes_count'
  ) THEN
    ALTER TABLE videos ADD COLUMN total_likes_count INTEGER DEFAULT 0;
  END IF;

  -- Add total_comments_count if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'total_comments_count'
  ) THEN
    ALTER TABLE videos ADD COLUMN total_comments_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 5. automation_queue
-- Central queue for automation tasks (combines idle & queue mode)
-- ============================================
CREATE TABLE IF NOT EXISTS automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task type
  task_type VARCHAR(30) NOT NULL,  -- idle_watch, queue_watch, scheduled_watch

  -- Target
  target_device_serial TEXT,  -- NULL = all available devices
  target_node_id UUID,

  -- Video info (for queue/scheduled mode)
  video_id UUID,
  video_url VARCHAR(500),
  video_title VARCHAR(500),
  search_keyword VARCHAR(200),  -- For idle mode or title search

  -- Configuration
  priority INTEGER DEFAULT 5,
  watch_min_seconds INTEGER,
  watch_max_seconds INTEGER,
  like_probability REAL DEFAULT 0.10,
  comment_probability REAL DEFAULT 0.05,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,  -- NULL = immediate
  expires_at TIMESTAMPTZ,    -- Task expires if not started by this time

  -- Status
  status VARCHAR(30) DEFAULT 'pending',  -- pending, assigned, in_progress, completed, failed, cancelled, expired
  assigned_device_serial TEXT,

  -- Results
  result JSONB,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Source tracking
  created_by VARCHAR(50) DEFAULT 'system',  -- system, api, scheduler, subscription
  source_subscription_id UUID  -- If from youtube_subscriptions auto-register
);

-- Indexes for automation_queue
CREATE INDEX IF NOT EXISTS idx_automation_queue_status
  ON automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_automation_queue_type
  ON automation_queue(task_type);
CREATE INDEX IF NOT EXISTS idx_automation_queue_scheduled
  ON automation_queue(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_queue_pending
  ON automation_queue(priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_automation_queue_device
  ON automation_queue(target_device_serial) WHERE target_device_serial IS NOT NULL;

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to get next automation task for a device
CREATE OR REPLACE FUNCTION get_next_automation_task(
  p_device_serial TEXT,
  p_node_id UUID DEFAULT NULL
)
RETURNS TABLE (
  task_id UUID,
  task_type VARCHAR(30),
  video_url VARCHAR(500),
  video_title VARCHAR(500),
  search_keyword VARCHAR(200),
  watch_min_seconds INTEGER,
  watch_max_seconds INTEGER,
  like_probability REAL,
  comment_probability REAL,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH next_task AS (
    SELECT aq.id
    FROM automation_queue aq
    WHERE aq.status = 'pending'
      AND (aq.scheduled_at IS NULL OR aq.scheduled_at <= NOW())
      AND (aq.expires_at IS NULL OR aq.expires_at > NOW())
      AND (
        aq.target_device_serial IS NULL
        OR aq.target_device_serial = p_device_serial
      )
      AND (
        aq.target_node_id IS NULL
        OR aq.target_node_id = p_node_id
      )
    ORDER BY aq.priority DESC, aq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE automation_queue aq
  SET
    status = 'assigned',
    assigned_device_serial = p_device_serial,
    assigned_at = NOW()
  FROM next_task
  WHERE aq.id = next_task.id
  RETURNING
    aq.id,
    aq.task_type,
    aq.video_url,
    aq.video_title,
    aq.search_keyword,
    aq.watch_min_seconds,
    aq.watch_max_seconds,
    aq.like_probability,
    aq.comment_probability,
    aq.priority;
END;
$$ LANGUAGE plpgsql;

-- Function to complete automation task
CREATE OR REPLACE FUNCTION complete_automation_task(
  p_task_id UUID,
  p_result JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR(30);
BEGIN
  IF p_error_message IS NOT NULL THEN
    v_status := 'failed';
  ELSE
    v_status := 'completed';
  END IF;

  UPDATE automation_queue
  SET
    status = v_status,
    result = p_result,
    error_message = p_error_message,
    completed_at = NOW()
  WHERE id = p_task_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to log heartbeat
CREATE OR REPLACE FUNCTION log_device_heartbeat(
  p_device_serial TEXT,
  p_node_id UUID,
  p_status VARCHAR(20),
  p_battery_level INTEGER DEFAULT NULL,
  p_current_mode VARCHAR(20) DEFAULT NULL,
  p_current_task_id UUID DEFAULT NULL,
  p_latency_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_heartbeat_id UUID;
BEGIN
  INSERT INTO device_heartbeats (
    device_serial,
    node_id,
    status,
    battery_level,
    current_mode,
    current_task_id,
    latency_ms,
    metadata
  ) VALUES (
    p_device_serial,
    p_node_id,
    p_status,
    p_battery_level,
    p_current_mode,
    p_current_task_id,
    p_latency_ms,
    p_metadata
  )
  RETURNING id INTO v_heartbeat_id;

  -- Also update devices table last_seen_at if it exists
  UPDATE devices
  SET
    last_seen_at = NOW(),
    status = p_status,
    battery_level = COALESCE(p_battery_level, battery_level)
  WHERE serial = p_device_serial;

  RETURN v_heartbeat_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log idle watch history
CREATE OR REPLACE FUNCTION log_idle_watch(
  p_device_serial TEXT,
  p_persona_id UUID,
  p_search_keyword VARCHAR(200),
  p_keyword_source VARCHAR(30),
  p_video_title VARCHAR(500),
  p_video_channel VARCHAR(255),
  p_video_url VARCHAR(500),
  p_watch_duration_seconds INTEGER,
  p_scroll_count INTEGER DEFAULT 0,
  p_liked BOOLEAN DEFAULT false,
  p_commented BOOLEAN DEFAULT false,
  p_comment_content TEXT DEFAULT NULL,
  p_human_simulation_config JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO persona_youtube_history (
    persona_id,
    device_serial,
    search_keyword,
    keyword_source,
    video_title,
    video_channel,
    video_url,
    watch_duration_seconds,
    scroll_count,
    liked,
    commented,
    comment_content,
    human_simulation_config,
    completed_at
  ) VALUES (
    p_persona_id,
    p_device_serial,
    p_search_keyword,
    p_keyword_source,
    p_video_title,
    p_video_channel,
    p_video_url,
    p_watch_duration_seconds,
    p_scroll_count,
    p_liked,
    p_commented,
    p_comment_content,
    p_human_simulation_config,
    NOW()
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update video engagement counts
CREATE OR REPLACE FUNCTION update_video_engagement_counts(
  p_video_id UUID,
  p_liked BOOLEAN DEFAULT false,
  p_commented BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
BEGIN
  UPDATE videos
  SET
    execution_count = execution_count + 1,
    success_count = success_count + 1,
    total_likes_count = total_likes_count + CASE WHEN p_liked THEN 1 ELSE 0 END,
    total_comments_count = total_comments_count + CASE WHEN p_commented THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = p_video_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Views for monitoring
-- ============================================

-- Active automation status per device
CREATE OR REPLACE VIEW automation_device_status AS
SELECT
  d.serial AS device_serial,
  d.node_id,
  d.status AS device_status,
  d.persona_id,
  dh.current_mode,
  dh.current_task_id,
  dh.battery_level,
  dh.last_seen_at,
  dh.latency_ms,
  aq.task_type AS current_task_type,
  aq.video_title AS current_video_title,
  (
    SELECT COUNT(*)
    FROM persona_youtube_history pyh
    WHERE pyh.device_serial = d.serial
      AND pyh.created_at > NOW() - INTERVAL '24 hours'
  ) AS idle_watches_24h,
  (
    SELECT COUNT(*)
    FROM video_assignments va
    WHERE va.device_serial = d.serial
      AND va.status = 'completed'
      AND va.completed_at > NOW() - INTERVAL '24 hours'
  ) AS queue_watches_24h
FROM devices d
LEFT JOIN LATERAL (
  SELECT * FROM device_heartbeats
  WHERE device_serial = d.serial
  ORDER BY created_at DESC
  LIMIT 1
) dh ON true
LEFT JOIN automation_queue aq ON aq.id = dh.current_task_id;

-- Queue statistics
CREATE OR REPLACE VIEW automation_queue_stats AS
SELECT
  task_type,
  status,
  COUNT(*) AS count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds,
  MIN(created_at) AS oldest_task,
  MAX(completed_at) AS latest_completion
FROM automation_queue
GROUP BY task_type, status
ORDER BY task_type, status;

-- Recent activity feed
CREATE OR REPLACE VIEW automation_recent_activity AS
(
  SELECT
    'idle' AS mode,
    id,
    device_serial,
    search_keyword AS title,
    watch_duration_seconds,
    liked,
    commented,
    created_at
  FROM persona_youtube_history
  ORDER BY created_at DESC
  LIMIT 50
)
UNION ALL
(
  SELECT
    'queue' AS mode,
    va.id,
    va.device_serial,
    aq.video_title AS title,
    va.watch_duration_seconds,
    va.liked,
    va.commented,
    va.created_at
  FROM video_assignments va
  LEFT JOIN automation_queue aq ON aq.video_id = va.video_id
  ORDER BY va.created_at DESC
  LIMIT 50
)
ORDER BY created_at DESC
LIMIT 100;

-- ============================================
-- 8. RLS Policies (if needed)
-- ============================================
-- Enable RLS
ALTER TABLE persona_youtube_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on persona_youtube_history"
  ON persona_youtube_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on video_assignments"
  ON video_assignments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on device_heartbeats"
  ON device_heartbeats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on automation_queue"
  ON automation_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Authenticated read on persona_youtube_history"
  ON persona_youtube_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read on video_assignments"
  ON video_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read on device_heartbeats"
  ON device_heartbeats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read on automation_queue"
  ON automation_queue FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE persona_youtube_history IS 'Idle mode YouTube activity history per persona/device';
COMMENT ON TABLE video_assignments IS 'Queue mode video-to-device assignments and results';
COMMENT ON TABLE device_heartbeats IS 'Device connection status monitoring';
COMMENT ON TABLE automation_queue IS 'Central automation task queue for all modes';
