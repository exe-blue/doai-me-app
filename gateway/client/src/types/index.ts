/**
 * DoAi.Me Control Room Types
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

/**
 * 연결 타입
 */
export type ConnectionType = 'USB' | 'WIFI' | 'LAN';

/**
 * 디바이스 상태
 */
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR';

/**
 * 발견된 디바이스
 */
export interface DiscoveredDevice {
  serial: string;
  connectionType: ConnectionType;
  status: DeviceStatus;
  
  model?: string;
  androidVersion?: string;
  displaySize?: {
    width: number;
    height: number;
  };
  
  connectedAt?: string;
  lastSeenAt: string;
  
  aiCitizenId?: string;
  aiCitizen?: {
    id: string;
    name: string;
    existence_state: string;
  };
  
  metrics?: {
    existence_score?: number;
    priority?: number;
    uniqueness?: number;
    corruption?: number;
  };
  
  gatewayClientConnected: boolean;
  streamAvailable?: boolean;
}

/**
 * 디바이스 수 통계
 */
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

/**
 * API 응답: 디바이스 목록
 */
export interface DevicesResponse {
  success: boolean;
  timestamp: string;
  count: DeviceCount;
  devices: DiscoveredDevice[];
}

/**
 * WebSocket 메시지 타입
 */
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * 디바이스 업데이트 메시지
 */
export interface DevicesUpdatedMessage extends WSMessage {
  type: 'devices:updated';
  action: 'initial' | 'added' | 'removed' | 'changed';
  devices?: DiscoveredDevice[];
  device?: DiscoveredDevice;
  count: DeviceCount;
}

/**
 * 에러 메시지
 */
export interface ErrorMessage extends WSMessage {
  type: 'error';
  code: string;
  message: string;
}

