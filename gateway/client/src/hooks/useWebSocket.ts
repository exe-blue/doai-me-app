/**
 * useWebSocket Hook
 * WebSocket Multiplexer 연결 관리
 * 
 * - 중복 연결 방지
 * - 재연결 로직 (3회, 10초 간격)
 * - 메모리 누수 방지 (전역 타이머 정리)
 * 
 * @author Axon (Tech Lead)
 * @version 2.2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage, DevicesUpdatedMessage } from '../types';

interface UseWebSocketOptions {
  onDevicesUpdate?: (message: DevicesUpdatedMessage) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// 전역 WebSocket 인스턴스 (싱글톤)
let globalWs: WebSocket | null = null;
let globalWsListeners: Set<(message: WSMessage) => void> = new Set();
let globalConnectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;

// 마운트된 컴포넌트 수 추적 (전역 타이머 정리용)
let mountedComponentsCount = 0;

// 재연결 진행 중 플래그 (race condition 방지)
let isReconnecting = false;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onDevicesUpdate,
    onError,
    autoReconnect = true,
    reconnectInterval = 10000,
    maxReconnectAttempts = 3
  } = options;

  const [isConnected, setIsConnected] = useState(globalConnectionState === 'connected');
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const messageHandlerRef = useRef<((message: WSMessage) => void) | null>(null);
  
  // 수동 재연결 타임아웃 추적
  const manualReconnectTimeoutRef = useRef<number | null>(null);

  // 메시지 핸들러 등록
  useEffect(() => {
    const handler = (message: WSMessage) => {
      setLastMessage(message);
      
      if (message.type === 'devices:updated' && onDevicesUpdate) {
        onDevicesUpdate(message as DevicesUpdatedMessage);
      }
    };
    
    messageHandlerRef.current = handler;
    globalWsListeners.add(handler);
    
    // 마운트된 컴포넌트 수 증가
    mountedComponentsCount++;
    
    return () => {
      globalWsListeners.delete(handler);
      
      // 마운트된 컴포넌트 수 감소
      mountedComponentsCount--;
      
      // 모든 컴포넌트가 언마운트되면 전역 타이머 정리
      if (mountedComponentsCount === 0) {
        if (reconnectTimer !== null) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        isReconnecting = false;
      }
      
      // 수동 재연결 타이머 정리
      if (manualReconnectTimeoutRef.current !== null) {
        clearTimeout(manualReconnectTimeoutRef.current);
        manualReconnectTimeoutRef.current = null;
      }
    };
  }, [onDevicesUpdate]);

  // WebSocket 연결
  const connect = useCallback(() => {
    // 이미 연결 중이거나 연결됨
    if (globalConnectionState !== 'disconnected') {
      return;
    }
    
    globalConnectionState = 'connecting';
    isReconnecting = false;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('[useWebSocket] Connecting to', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[useWebSocket] Connected');
      globalConnectionState = 'connected';
      globalWs = ws;
      reconnectAttempts = 0;
      isReconnecting = false;
      
      // 타이머 정리
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      setIsConnected(true);
      
      // 초기 구독 메시지
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['devices', 'status']
      }));
    };

    ws.onmessage = (event) => {
      // Binary 데이터는 무시 (비디오 스트림은 별도 WebSocket)
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        return;
      }
      
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        // 모든 리스너에게 전달
        globalWsListeners.forEach(listener => {
          try {
            listener(message);
          } catch (e) {
            console.error('[useWebSocket] Handler error:', e);
          }
        });
      } catch {
        // JSON 파싱 실패
      }
    };

    ws.onerror = (event) => {
      console.error('[useWebSocket] Error:', event);
      onError?.(new Error('WebSocket error'));
    };

    ws.onclose = (event) => {
      console.log('[useWebSocket] Closed:', event.code, event.reason);
      globalConnectionState = 'disconnected';
      globalWs = null;
      setIsConnected(false);

      // 자동 재연결 (컴포넌트가 마운트 상태일 때만)
      if (autoReconnect && reconnectAttempts < maxReconnectAttempts && mountedComponentsCount > 0) {
        reconnectAttempts++;
        isReconnecting = true;
        const delay = reconnectInterval * Math.pow(1.5, reconnectAttempts - 1);
        console.log(`[useWebSocket] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // 기존 타이머 정리 후 새 타이머 설정
        if (reconnectTimer !== null) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          isReconnecting = false;
          connect();
        }, delay);
      } else {
        isReconnecting = false;
      }
    };
  }, [autoReconnect, reconnectInterval, maxReconnectAttempts, onError]);

  // 연결 해제
  const disconnect = useCallback(() => {
    // 모든 타이머 정리
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (manualReconnectTimeoutRef.current !== null) {
      clearTimeout(manualReconnectTimeoutRef.current);
      manualReconnectTimeoutRef.current = null;
    }
    
    isReconnecting = false;
    
    if (globalWs && globalWs.readyState === WebSocket.OPEN) {
      globalWs.close(1000, 'User disconnect');
    }
    
    globalWs = null;
    globalConnectionState = 'disconnected';
    setIsConnected(false);
  }, []);

  // 메시지 전송
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // 디바이스에 명령 전송
  const sendToDevice = useCallback((deviceId: string, command: Record<string, unknown>) => {
    return sendMessage({
      type: 'command',
      target: deviceId,
      ...command
    });
  }, [sendMessage]);

  // 전체 디바이스에 브로드캐스트
  const broadcast = useCallback((command: Record<string, unknown>) => {
    return sendMessage({
      type: 'broadcast',
      target: '*',
      ...command
    });
  }, [sendMessage]);

  // 재연결 (race condition 방지)
  const reconnect = useCallback(() => {
    // 이미 재연결 중이거나 타이머가 설정되어 있으면 무시
    if (isReconnecting || reconnectTimer !== null) {
      console.log('[useWebSocket] Reconnect already pending, ignoring');
      return;
    }
    
    // 수동 재연결 타이머가 설정되어 있으면 무시
    if (manualReconnectTimeoutRef.current !== null) {
      console.log('[useWebSocket] Manual reconnect already pending, ignoring');
      return;
    }
    
    console.log('[useWebSocket] Manual reconnect requested');
    
    // 기존 연결/타이머 정리
    disconnect();
    
    // 명시적 수동 재연결이므로 카운터 리셋
    reconnectAttempts = 0;
    isReconnecting = true;
    
    // 약간의 지연 후 연결 (disconnect가 완료될 시간 확보)
    manualReconnectTimeoutRef.current = window.setTimeout(() => {
      manualReconnectTimeoutRef.current = null;
      isReconnecting = false;
      connect();
    }, 100);
  }, [connect, disconnect]);

  // 컴포넌트 마운트 시 연결 (전역 싱글톤)
  useEffect(() => {
    if (globalConnectionState === 'disconnected' && !isReconnecting) {
      connect();
    } else {
      setIsConnected(globalConnectionState === 'connected');
    }
    
    // 언마운트 시에는 연결 유지 (싱글톤이므로)
    // 다른 컴포넌트가 사용 중일 수 있음
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    sendToDevice,
    broadcast,
    reconnect,
    disconnect
  };
}
