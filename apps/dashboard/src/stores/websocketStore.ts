/**
 * WebSocket Store
 * 
 * 실시간 디바이스 상태 업데이트를 위한 WebSocket 연결 관리
 * 
 * @author Axon (Tech Lead)
 */

import { create } from 'zustand';
import { useDeviceStore } from './deviceStore';
import type { Device } from '@/services/api';

// WebSocket 메시지 타입
interface WSMessage {
  type: string;
  payload: unknown;
}

interface DeviceUpdatePayload {
  serial: string;
  status?: Device['status'];
  metrics?: Device['metrics'];
  aiCitizen?: Device['aiCitizen'];
  current_task?: Device['current_task'];
}

interface WebSocketState {
  // 상태
  socket: WebSocket | null;
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastMessage: WSMessage | null;
  reconnectAttempts: number;
  
  // 스트림 구독
  streamSubscriptions: Set<string>;
  
  // 액션
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: WSMessage) => void;
  
  // 스트림 제어
  subscribeStream: (deviceId: string) => void;
  unsubscribeStream: (deviceId: string) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  lastMessage: null,
  reconnectAttempts: 0,
  streamSubscriptions: new Set(),

  connect: () => {
    const { socket, connectionStatus } = get();
    
    // 이미 연결 중이거나 연결된 경우
    if (socket && (connectionStatus === 'connected' || connectionStatus === 'connecting')) {
      return;
    }

    // 기존 소켓이 error 상태이거나 정리가 필요한 경우 완전히 정리
    // 왜 이렇게 작성했는가? - 연결 누수(leak) 방지
    if (socket) {
      // 이벤트 핸들러 제거
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      
      // 아직 닫히지 않은 소켓이면 닫기
      if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
        try {
          socket.close();
        } catch {
          // 닫기 실패 무시
        }
      }
      
      // reconnectTimer 정리
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // 상태 초기화
      set({ socket: null, isConnected: false });
    }

    set({ connectionStatus: 'connecting' });
    
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('[WebSocket] 연결됨');
      set({ 
        socket: ws, 
        isConnected: true, 
        connectionStatus: 'connected',
        reconnectAttempts: 0 
      });
      
      // 기존 스트림 구독 복원
      const { streamSubscriptions } = get();
      streamSubscriptions.forEach((deviceId) => {
        ws.send(JSON.stringify({
          type: 'stream:subscribe',
          devices: [deviceId],
          quality: { resolution: 'MEDIUM' }
        }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        set({ lastMessage: message });
        
        // 메시지 타입별 처리
        handleMessage(message);
      } catch (e) {
        console.warn('[WebSocket] 메시지 파싱 실패:', e);
      }
    };

    ws.onerror = () => {
      console.error('[WebSocket] 오류 발생');
      set({ connectionStatus: 'error' });
    };

    ws.onclose = () => {
      console.log('[WebSocket] 연결 종료');
      set({ 
        socket: null, 
        isConnected: false, 
        connectionStatus: 'disconnected' 
      });
      
      // 재연결 시도
      const { reconnectAttempts } = get();
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log(`[WebSocket] ${RECONNECT_DELAY}ms 후 재연결 시도 (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          set({ reconnectAttempts: reconnectAttempts + 1 });
          get().connect();
        }, RECONNECT_DELAY);
      }
    };

    set({ socket: ws });
  },

  disconnect: () => {
    const { socket } = get();
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (socket) {
      socket.close();
    }
    
    set({ 
      socket: null, 
      isConnected: false, 
      connectionStatus: 'disconnected',
      reconnectAttempts: MAX_RECONNECT_ATTEMPTS // 재연결 방지
    });
  },

  sendMessage: (message) => {
    const { socket, isConnected } = get();
    
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] 연결되지 않음, 메시지 전송 실패');
    }
  },

  subscribeStream: (deviceId) => {
    const { socket, isConnected, streamSubscriptions } = get();
    
    // 구독 목록에 추가
    const newSubscriptions = new Set(streamSubscriptions);
    newSubscriptions.add(deviceId);
    set({ streamSubscriptions: newSubscriptions });
    
    // 연결된 상태면 구독 메시지 전송
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'stream:subscribe',
        devices: [deviceId],
        quality: { resolution: 'MEDIUM' }
      }));
    }
  },

  unsubscribeStream: (deviceId) => {
    const { socket, isConnected, streamSubscriptions } = get();
    
    // 구독 목록에서 제거
    const newSubscriptions = new Set(streamSubscriptions);
    newSubscriptions.delete(deviceId);
    set({ streamSubscriptions: newSubscriptions });
    
    // 연결된 상태면 구독 해제 메시지 전송
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'stream:unsubscribe',
        devices: [deviceId]
      }));
    }
  },
}));

/** 메시지 타입별 핸들러 */
function handleMessage(message: WSMessage) {
  const deviceStore = useDeviceStore.getState();
  
  switch (message.type) {
    // Gateway가 보내는 메시지 타입 (device:status, devices:updated 등)
    case 'device:status': {
      const payload = message.payload as DeviceUpdatePayload;
      deviceStore.updateDevice(payload);
      break;
    }
    
    case 'devices:updated': {
      // action에 따라 처리
      const { action, device, devices } = message.payload as {
        action: string;
        device?: Device;
        devices?: Device[];
        count?: { total: number; online: number };
      };
      
      if (action === 'initial' && devices) {
        // 초기 목록은 전체 갱신
        deviceStore.fetchDevices();
      } else if (action === 'added' && device) {
        deviceStore.addDevice(device as Device);
      } else if (action === 'removed' && device) {
        deviceStore.removeDevice(device.serial);
      } else if (action === 'changed' && device) {
        deviceStore.updateDevice(device);
      } else {
        // 기본: 전체 갱신
        deviceStore.fetchDevices();
      }
      break;
    }
    
    // Legacy 타입 (호환성)
    case 'DEVICE_UPDATE': {
      const payload = message.payload as DeviceUpdatePayload;
      deviceStore.updateDevice(payload);
      break;
    }
    
    case 'DEVICE_ADDED': {
      const device = message.payload as Device;
      deviceStore.addDevice(device);
      break;
    }
    
    case 'DEVICE_REMOVED': {
      const { serial } = message.payload as { serial: string };
      deviceStore.removeDevice(serial);
      break;
    }
    
    case 'DEVICES_UPDATED': {
      deviceStore.fetchDevices();
      break;
    }
    
    case 'SCAN_COMPLETE': {
      console.log('[WebSocket] 스캔 완료');
      deviceStore.fetchDevices();
      break;
    }
    
    case 'error': {
      console.error('[WebSocket] 서버 에러:', message.payload);
      break;
    }
    
    default:
      console.log('[WebSocket] 메시지:', message.type, message.payload);
  }
}
