-- Rollback Migration: Remove YouTube Advanced Features Columns
-- Reverts changes made in 001_add_youtube_advanced_features.sql
-- Created: 2025-12-28

-- task_results 테이블에서 추가된 컬럼 제거
ALTER TABLE task_results DROP COLUMN IF EXISTS subscribed;
ALTER TABLE task_results DROP COLUMN IF EXISTS notification_set;
ALTER TABLE task_results DROP COLUMN IF EXISTS shared;
ALTER TABLE task_results DROP COLUMN IF EXISTS added_to_playlist;


