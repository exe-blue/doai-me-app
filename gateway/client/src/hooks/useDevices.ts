/**
 * useDevices Hook
 * SWR을 사용한 디바이스 목록 관리
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import useSWR from 'swr';
import type { DiscoveredDevice, DevicesResponse } from '../types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useDevices() {
  const { data, error, mutate, isLoading } = useSWR<DevicesResponse>(
    '/api/devices',
    fetcher,
    {
      refreshInterval: 30000, // 30초마다 자동 새로고침
      revalidateOnFocus: true
    }
  );

  return {
    devices: data?.devices ?? [] as DiscoveredDevice[],
    count: data?.count,
    isLoading,
    error,
    mutate
  };
}

