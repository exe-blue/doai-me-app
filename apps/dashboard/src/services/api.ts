/**
 * API 서비스 레이어
 * 
 * Gateway API와의 통신을 담당
 * 
 * @author Axon (Tech Lead)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/** HTTP 에러 클래스 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 공통 fetch 래퍼 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      response.statusText,
      errorData.message || `API 요청 실패: ${response.status}`
    );
  }

  // 204 No Content 또는 빈 응답 처리
  if (response.status === 204) {
    return null as T;
  }

  // Content-Length가 0이면 빈 응답
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null as T;
  }

  // Content-Type 확인
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // JSON이 아닌 경우 text로 반환하거나 null
    const text = await response.text();
    return (text || null) as T;
  }

  // JSON 파싱 (try-catch로 안전하게)
  try {
    return await response.json();
  } catch {
    // JSON 파싱 실패 시 null 반환
    return null as T;
  }
}

// ============================================================
// 디바이스 API
// ============================================================

export interface DeviceMetrics {
  existence_score: number;
  priority: number;
  uniqueness: number;
  corruption: number;
}

export interface AICitizen {
  id: string;
  name: string;
  existence_state: 'ACTIVE' | 'WAITING' | 'FADING' | 'VOID';
}

export interface Device {
  serial: string;
  connectionType: 'USB' | 'WIFI' | 'LAN';
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';
  model: string;
  androidVersion: string;
  displaySize: string;
  connectedAt: string;
  lastSeenAt: string;
  
  // AI 시민 정보
  aiCitizenId?: string;
  aiCitizen?: AICitizen;
  metrics: DeviceMetrics;
  
  // 연결 상태
  gatewayClientConnected: boolean;
  streamAvailable: boolean;
  
  // 현재 작업 (상세 조회 시)
  current_task?: {
    type: string;
    video_id?: string;
    progress: number;
    started_at: string;
  };
  
  // 스트림 URL
  stream_url?: string;
}

export interface DeviceCount {
  total: number;
  online: number;
  offline: number;
  byType: {
    USB: number;
    WIFI: number;
    LAN: number;
  };
}

export interface DeviceListResponse {
  success: boolean;
  timestamp: string;
  count: DeviceCount;
  devices: Device[];
}

export interface DeviceDetailResponse {
  success: boolean;
  device: Device;
}

/** 디바이스 목록 조회 */
export async function getDevices(): Promise<DeviceListResponse> {
  return fetchApi<DeviceListResponse>('/devices');
}

/** 단일 디바이스 조회 */
export async function getDevice(id: string): Promise<DeviceDetailResponse> {
  return fetchApi<DeviceDetailResponse>(`/devices/${id}`);
}

/** 디바이스 재스캔 요청 */
export async function rescanDevices(): Promise<{ success: boolean; message: string }> {
  return fetchApi('/devices/scan', { method: 'POST' });
}

// ============================================================
// 스트림 API
// ============================================================

/**
 * 스크린샷 가져오기
 * @param deviceId 디바이스 ID
 * @returns Base64 데이터 URL 문자열
 * @description fetchApi를 사용하여 일관된 에러 처리. Blob을 Base64로 변환하여 반환.
 * 호출자는 URL.revokeObjectURL을 호출할 필요가 없음.
 */
export async function getScreenshot(deviceId: string): Promise<string> {
  const url = `${API_BASE}/control/${deviceId}/screenshot`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, 'Screenshot failed');
  }
  
  const blob = await response.blob();
  
  // Blob을 Base64 데이터 URL로 변환
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// 제어 API
// ============================================================

export interface TouchEvent {
  x: number;
  y: number;
  action: 'down' | 'up' | 'move';
}

/** 터치 이벤트 전송 */
export async function sendTouch(deviceId: string, touch: TouchEvent) {
  return fetchApi(`/control/${deviceId}/touch`, {
    method: 'POST',
    body: JSON.stringify(touch),
  });
}

/** 키 이벤트 전송 */
export async function sendKey(deviceId: string, keycode: number) {
  return fetchApi(`/control/${deviceId}/key`, {
    method: 'POST',
    body: JSON.stringify({ keycode }),
  });
}

/** 텍스트 입력 */
export async function sendText(deviceId: string, text: string) {
  return fetchApi(`/control/${deviceId}/text`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ============================================================
// 페르소나 API
// ============================================================

export interface Persona {
  id: string;
  name: string;
  traits: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  interests: string[];
  existence_state: string;
  created_at: string;
}

/** 페르소나 목록 조회 */
export async function getPersonas(): Promise<Persona[]> {
  const response = await fetchApi<{ success: boolean; personas: Persona[] }>('/personas');
  return response.personas;
}

/** 디바이스에 페르소나 할당 */
export async function assignPersona(deviceId: string, personaId: string) {
  return fetchApi(`/devices/${deviceId}/persona`, {
    method: 'POST',
    body: JSON.stringify({ personaId }),
  });
}
