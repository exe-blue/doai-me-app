/**
 * Supabase Client for Dashboard App
 * 
 * 환경 변수:
 * - VITE_SUPABASE_URL: Supabase 프로젝트 URL
 * - VITE_SUPABASE_ANON_KEY: Supabase anon key
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail fast: 환경 변수 누락 시 즉시 에러 발생
if (!supabaseUrl) {
  throw new Error('[Supabase] Missing VITE_SUPABASE_URL environment variable');
}
if (!supabaseAnonKey) {
  throw new Error('[Supabase] Missing VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export default supabase;
