-- Migration: Add YouTube Advanced Features
-- Adds columns for subscribe, notification, share, and playlist tracking
-- Created: 2025-12-28

-- Add new columns to task_results table
ALTER TABLE task_results ADD COLUMN subscribed INTEGER DEFAULT 0;
ALTER TABLE task_results ADD COLUMN notification_set INTEGER DEFAULT 0;
ALTER TABLE task_results ADD COLUMN shared INTEGER DEFAULT 0;
ALTER TABLE task_results ADD COLUMN added_to_playlist INTEGER DEFAULT 0;
