/**
 * useDevices Hook
 * SWR을 사용한 디바이스 목록 관리
 * 
 * 재시도 로직: 3회, 지수 백오프
 * 
 * @author Axon (Tech Lead)
 * @version 2.1.0
 */

import useSWR from 'swr';
import type { DiscoveredDevice, DevicesResponse } from '../types';

// 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 3000, // 기본 3초
  backoffMultiplier: 2
};

// 커스텀 fetcher with 타임아웃
const fetcher = async (url: string): Promise<DevicesResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

export function useDevices() {
  const { data, error, mutate, isLoading, isValidating } = useSWR<DevicesResponse>(
    '/api/devices',
    fetcher,
    {
      refreshInterval: 30000, // 30초마다 자동 새로고침
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // 5초 내 중복 요청 방지
      
      // 에러 시 재시도
      errorRetryCount: RETRY_CONFIG.maxRetries,
      errorRetryInterval: RETRY_CONFIG.retryDelay,
      onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
        // 404는 재시도 안함
        if (error.message.includes('404')) return;
        
        // 최대 재시도 횟수 초과
        if (retryCount >= RETRY_CONFIG.maxRetries) return;
        
        // 지수 백오프로 재시도
        const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
        setTimeout(() => revalidate({ retryCount }), delay);
      },
      
      // 네트워크 에러 시 이전 데이터 유지
      keepPreviousData: true
    }
  );

  // 온라인 디바이스 수 계산
  const onlineCount = data?.devices?.filter(d => d.status === 'ONLINE').length ?? 0;
  
  // 오프라인 디바이스 수 계산
  const offlineCount = data?.devices?.filter(d => d.status === 'OFFLINE').length ?? 0;
  
  // 에러 상태 디바이스 수 계산
  const errorCount = data?.devices?.filter(d => d.status === 'ERROR').length ?? 0;

  return {
    devices: data?.devices ?? [] as DiscoveredDevice[],
    count: data?.count ?? { total: 0, online: 0, offline: 0, byType: {} },
    onlineCount,
    offlineCount,
    errorCount,
    isLoading,
    isValidating, // 백그라운드 업데이트 중
    error,
    mutate,
    
    // 수동 새로고침
    refresh: () => mutate(),
    
    // 특정 디바이스 정보만 업데이트
    updateDevice: (deviceId: string, updates: Partial<DiscoveredDevice>) => {
      mutate((current) => {
        if (!current) return current;
        return {
          ...current,
          devices: current.devices.map(d => 
            d.serial === deviceId ? { ...d, ...updates } : d
          )
        };
      }, false);
    }
  };
}
