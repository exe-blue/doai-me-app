/**
 * DoAi.Me MVP Orchestration v1 — Supabase Storage upload
 * Path: {youtubeVideoId}/{node_id}/{device_id}/{run_id}/{timestamp}.png
 * Timeout: 30s upload
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logInfo, logError } from './logger.js';
import { UPLOAD_TIMEOUT_MS } from './config.js';

export function buildStoragePath(
  youtubeVideoId: string,
  nodeId: string,
  deviceId: string,
  runId: string,
  timestamp: number
): string {
  return `${youtubeVideoId}/${nodeId}/${deviceId}/${runId}/${timestamp}.png`;
}

export async function uploadScreenshot(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer,
  runId: string,
  nodeId: string,
  deviceId: string
): Promise<{ ok: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      logError('Upload failed', error, { run_id: runId, node_id: nodeId, device_id: deviceId });
      return { ok: false };
    }
    logInfo('Upload OK', { run_id: runId, node_id: nodeId, device_id: deviceId });
    return { ok: true };
  } catch (err) {
    logError('Upload timeout or error', err, { run_id: runId, node_id: nodeId, device_id: deviceId });
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
