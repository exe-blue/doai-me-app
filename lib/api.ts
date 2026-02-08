"use client";
/**
 * API fetch wrapper + usePolling for P0 (P2에서 SSE/WS로 전환 가능)
 */

export async function apiGet<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { ...options, method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      let err: string;
      try {
        const j = JSON.parse(text) as { error?: string };
        err = j.error ?? res.statusText;
      } catch {
        err = text || res.statusText;
      }
      return { data: null, error: err };
    }
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { data: null, error: message };
  }
}

import { useEffect, useRef, useState } from "react";

export interface UsePollingOptions {
  enabled?: boolean;
  onError?: (err: string) => void;
}

/**
 * usePolling(url, intervalMs, { enabled })
 * Returns { data, error, loading, refetch, refreshedAt } — R4 표준.
 */
export function usePolling<T = unknown>(
  url: string,
  intervalMs: number,
  options: UsePollingOptions = {}
): { data: T | null; error: string | null; loading: boolean; refetch: () => void; refreshedAt: number | null } {
  const { enabled = true, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const refetchRef = useRef<() => void>(() => {});

  const refetch = async () => {
    const { data: next, error: err } = await apiGet<T>(url);
    setData(next);
    setError(err);
    setLoading(false);
    setRefreshedAt(next != null ? Date.now() : null);
    if (err) onError?.(err);
  };

  useEffect(() => {
    refetchRef.current = refetch;
  });

  useEffect(() => {
    if (!enabled || !url) return;
    const t = setTimeout(() => setLoading(true), 0);
    refetchRef.current?.();
    const id = setInterval(() => refetchRef.current?.(), intervalMs);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [url, intervalMs, enabled]);

  return { data, error, loading, refetch, refreshedAt };
}
