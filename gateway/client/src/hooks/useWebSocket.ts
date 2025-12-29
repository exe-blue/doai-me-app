/**
 * useWebSocket Hook
 * WebSocket Multiplexer 연결 관리
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage, DevicesUpdatedMessage } from '../types';

interface UseWebSocketOptions {
  onDevicesUpdate?: (message: DevicesUpdatedMessage) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onDevicesUpdate,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  // WebSocket 연결
  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // 디바이스 구독
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['devices', 'stream']
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        setLastMessage(message);

        // 디바이스 업데이트 핸들러
        if (message.type === 'devices:updated' && onDevicesUpdate) {
          onDevicesUpdate(message as DevicesUpdatedMessage);
        }
      } catch {
        // JSON 파싱 실패 (바이너리 스트림 등)
      }
    };

    ws.onerror = (event) => {
      onError?.(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      // 자동 재연결
      if (autoReconnect) {
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    wsRef.current = ws;
  }, [onDevicesUpdate, onError, autoReconnect, reconnectInterval]);

  // 연결 해제
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // 메시지 전송
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
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

  // 컴포넌트 마운트 시 연결
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    sendToDevice,
    broadcast,
    reconnect: connect,
    disconnect
  };
}
