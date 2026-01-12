// ============================================
// DoAi.ME - Node Context v5.0 (Dashboard Port)
// 
// 용어:
// - Node (노드) = PC (Bridge 실행 컴퓨터)
// - Device (디바이스) = 스마트폰 (Android 기기)
// 
// v5.0 변경사항:
// - 안정적인 WebSocket 재연결 (지수 백오프)
// - 깔끔한 로그 시스템 (중복 방지, 카테고리화)
// - 연결 상태 명확화
// ============================================

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';

// ============================================
// Types
// ============================================

export type DeviceStatus = 'idle' | 'busy' | 'error' | 'offline';
export type NodeStatus = 'online' | 'offline' | 'reconnecting';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Node = PC (Gateway Bridge)
export interface GatewayNode {
  id: string;
  hostname: string;
  ipAddress: string;
  platform: string;
  status: NodeStatus;
  deviceCount: number;
  onlineDeviceCount: number;
  laixiConnected: boolean;
  lastSeen: Date;
  reconnectAttempts: number;
}

// Device = 스마트폰
export interface Device {
  id: string;
  serial: string;
  name: string;
  model: string;
  status: DeviceStatus;
  wallet: number;
  currentTask: { videoId: string; title: string } | null;
  lastSeen: Date;
  traits: string[];
  nodeId: string;
  errorMessage?: string;
  recoveryAttempts: number;
}

export interface QueuedVideo {
  id: string;
  videoId: string;
  title: string;
  url: string;
  thumbnail?: string;
  channel?: string;
  registeredAt: Date;
  status: 'queued' | 'running' | 'paused';
  assignedDevices: string[];
  progress: number;
  targetViews: number;
  currentViews: number;
  source?: 'manual' | 'auto_subscribe';
}

export interface CompletedVideo {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  channel?: string;
  completedAt: Date;
  totalViews: number;
  successCount: number;
  errorCount: number;
  duration: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  nodeId?: string;
  deviceId?: string;
  category?: 'connection' | 'device' | 'video' | 'kernel' | 'system';
}

export interface SystemStats {
  totalNodes: number;
  onlineNodes: number;
  totalDevices: number;
  idleDevices: number;
  busyDevices: number;
  errorDevices: number;
  offlineDevices: number;
  totalViews: number;
  todayViews: number;
}

// ============================================
// State
// ============================================

interface NodeState {
  nodes: Map<string, GatewayNode>;
  devices: Map<string, Device>;
  queuedVideos: QueuedVideo[];
  completedVideos: CompletedVideo[];
  logs: LogEntry[];
  stats: SystemStats;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
  reconnectAttempt: number;
}

// ============================================
// Actions
// ============================================

type NodeAction =
  | { type: 'SET_NODE'; payload: GatewayNode }
  | { type: 'UPDATE_NODE'; payload: Partial<GatewayNode> & { id: string } }
  | { type: 'REMOVE_NODE'; payload: string }
  | { type: 'SET_NODE_OFFLINE'; payload: string }
  | { type: 'SET_DEVICES'; payload: { nodeId: string; devices: Device[] } }
  | { type: 'UPDATE_DEVICE'; payload: Partial<Device> & { id: string } }
  | { type: 'SET_DEVICE_OFFLINE'; payload: string }
  | { type: 'SET_ALL_DEVICES_OFFLINE'; payload: string }
  | { type: 'ADD_QUEUED_VIDEO'; payload: QueuedVideo }
  | { type: 'UPDATE_QUEUED_VIDEO'; payload: Partial<QueuedVideo> & { id: string } }
  | { type: 'REMOVE_QUEUED_VIDEO'; payload: string }
  | { type: 'ADD_COMPLETED_VIDEO'; payload: CompletedVideo }
  | { type: 'COMPLETE_VIDEO'; payload: { videoId: string; stats: { successCount: number; errorCount: number } } }
  | { type: 'ADD_LOG'; payload: Omit<LogEntry, 'id' | 'timestamp'> }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_RECONNECT_ATTEMPT'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_STATS' }
  | { type: 'RESET_STATE' };

// ============================================
// Initial State
// ============================================

const initialStats: SystemStats = {
  totalNodes: 0,
  onlineNodes: 0,
  totalDevices: 0,
  idleDevices: 0,
  busyDevices: 0,
  errorDevices: 0,
  offlineDevices: 0,
  totalViews: 0,
  todayViews: 0,
};

const initialState: NodeState = {
  nodes: new Map(),
  devices: new Map(),
  queuedVideos: [],
  completedVideos: [],
  logs: [],
  stats: initialStats,
  connectionStatus: 'disconnected',
  lastError: null,
  reconnectAttempt: 0,
};

// ============================================
// Reducer
// ============================================

function calculateStats(nodes: Map<string, GatewayNode>, devices: Map<string, Device>, prevStats: SystemStats): SystemStats {
  const nodeArray = Array.from(nodes.values());
  const deviceArray = Array.from(devices.values());

  return {
    totalNodes: nodeArray.length,
    onlineNodes: nodeArray.filter(n => n.status === 'online').length,
    totalDevices: deviceArray.length,
    idleDevices: deviceArray.filter(d => d.status === 'idle').length,
    busyDevices: deviceArray.filter(d => d.status === 'busy').length,
    errorDevices: deviceArray.filter(d => d.status === 'error').length,
    offlineDevices: deviceArray.filter(d => d.status === 'offline').length,
    totalViews: prevStats.totalViews,
    todayViews: prevStats.todayViews,
  };
}

function nodeReducer(state: NodeState, action: NodeAction): NodeState {
  switch (action.type) {
    case 'SET_NODE': {
      const newNodes = new Map(state.nodes);
      newNodes.set(action.payload.id, action.payload);
      const newStats = calculateStats(newNodes, state.devices, state.stats);
      return { ...state, nodes: newNodes, stats: newStats };
    }

    case 'UPDATE_NODE': {
      const newNodes = new Map(state.nodes);
      const existing = newNodes.get(action.payload.id);
      if (existing) {
        newNodes.set(action.payload.id, { ...existing, ...action.payload });
        const newStats = calculateStats(newNodes, state.devices, state.stats);
        return { ...state, nodes: newNodes, stats: newStats };
      }
      return state;
    }

    case 'REMOVE_NODE': {
      const newNodes = new Map(state.nodes);
      newNodes.delete(action.payload);
      const newDevices = new Map(state.devices);
      state.devices.forEach((device, id) => {
        if (device.nodeId === action.payload) {
          newDevices.delete(id);
        }
      });
      const newStats = calculateStats(newNodes, newDevices, state.stats);
      return { ...state, nodes: newNodes, devices: newDevices, stats: newStats };
    }

    case 'SET_NODE_OFFLINE': {
      const newNodes = new Map(state.nodes);
      const node = newNodes.get(action.payload);
      if (node) {
        newNodes.set(action.payload, { 
          ...node, 
          status: 'offline',
          laixiConnected: false,
          onlineDeviceCount: 0,
        });
      }
      const newStats = calculateStats(newNodes, state.devices, state.stats);
      return { ...state, nodes: newNodes, stats: newStats };
    }

    case 'SET_DEVICES': {
      const newDevices = new Map(state.devices);
      state.devices.forEach((device, id) => {
        if (device.nodeId === action.payload.nodeId) {
          newDevices.delete(id);
        }
      });
      action.payload.devices.forEach(device => {
        newDevices.set(device.id, device);
      });
      const newStats = calculateStats(state.nodes, newDevices, state.stats);
      return { ...state, devices: newDevices, stats: newStats };
    }

    case 'UPDATE_DEVICE': {
      const newDevices = new Map(state.devices);
      const existing = newDevices.get(action.payload.id);
      if (existing) {
        newDevices.set(action.payload.id, { ...existing, ...action.payload });
        const newStats = calculateStats(state.nodes, newDevices, state.stats);
        return { ...state, devices: newDevices, stats: newStats };
      }
      return state;
    }

    case 'SET_DEVICE_OFFLINE': {
      const newDevices = new Map(state.devices);
      const device = newDevices.get(action.payload);
      if (device) {
        newDevices.set(action.payload, {
          ...device,
          status: 'offline',
          currentTask: null,
        });
        const newStats = calculateStats(state.nodes, newDevices, state.stats);
        return { ...state, devices: newDevices, stats: newStats };
      }
      return state;
    }

    case 'SET_ALL_DEVICES_OFFLINE': {
      const newDevices = new Map(state.devices);
      state.devices.forEach((device, id) => {
        if (device.nodeId === action.payload) {
          newDevices.set(id, {
            ...device,
            status: 'offline',
            currentTask: null,
          });
        }
      });
      const newStats = calculateStats(state.nodes, newDevices, state.stats);
      return { ...state, devices: newDevices, stats: newStats };
    }

    case 'ADD_QUEUED_VIDEO':
      return { ...state, queuedVideos: [...state.queuedVideos, action.payload] };

    case 'UPDATE_QUEUED_VIDEO':
      return {
        ...state,
        queuedVideos: state.queuedVideos.map(v =>
          v.id === action.payload.id ? { ...v, ...action.payload } : v
        ),
      };

    case 'REMOVE_QUEUED_VIDEO':
      return { ...state, queuedVideos: state.queuedVideos.filter(v => v.id !== action.payload) };

    case 'ADD_COMPLETED_VIDEO':
      return {
        ...state,
        completedVideos: [action.payload, ...state.completedVideos],
        stats: {
          ...state.stats,
          totalViews: state.stats.totalViews + action.payload.totalViews,
          todayViews: state.stats.todayViews + action.payload.totalViews,
        },
      };

    case 'COMPLETE_VIDEO': {
      const { videoId, stats } = action.payload;
      const video = state.queuedVideos.find(v => v.id === videoId);
      if (!video) return state;

      const completedVideo: CompletedVideo = {
        id: video.id,
        title: video.title,
        url: video.url,
        thumbnail: video.thumbnail,
        channel: video.channel,
        completedAt: new Date(),
        totalViews: video.currentViews,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        duration: Math.floor((Date.now() - video.registeredAt.getTime()) / 1000),
      };

      return {
        ...state,
        queuedVideos: state.queuedVideos.filter(v => v.id !== videoId),
        completedVideos: [completedVideo, ...state.completedVideos],
        stats: {
          ...state.stats,
          totalViews: state.stats.totalViews + completedVideo.totalViews,
          todayViews: state.stats.todayViews + completedVideo.totalViews,
        },
      };
    }

    case 'ADD_LOG': {
      const newLog: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date(),
        ...action.payload,
      };
      // 최대 300개 로그 유지
      return { ...state, logs: [newLog, ...state.logs.slice(0, 299)] };
    }

    case 'CLEAR_LOGS':
      return { ...state, logs: [] };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    case 'SET_RECONNECT_ATTEMPT':
      return { ...state, reconnectAttempt: action.payload };

    case 'SET_ERROR':
      return { ...state, lastError: action.payload };

    case 'UPDATE_STATS': {
      const newStats = calculateStats(state.nodes, state.devices, state.stats);
      return { ...state, stats: newStats };
    }

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// Context Interface
// ============================================

interface NodeContextValue {
  state: NodeState;
  nodes: GatewayNode[];
  getNodeById: (id: string) => GatewayNode | undefined;
  getOnlineNodes: () => GatewayNode[];
  devices: Device[];
  getDeviceById: (id: string) => Device | undefined;
  getDevicesByNodeId: (nodeId: string) => Device[];
  getIdleDevices: () => Device[];
  getBusyDevices: () => Device[];
  addVideo: (video: Omit<QueuedVideo, 'id' | 'registeredAt' | 'status' | 'assignedDevices' | 'progress' | 'currentViews'>) => void;
  updateVideo: (video: Partial<QueuedVideo> & { id: string }) => void;
  completeVideo: (videoId: string, stats: { successCount: number; errorCount: number }) => void;
  injectVideo: (video: { videoId: string; title: string; url: string; thumbnail?: string; channel?: string }, targetViews: number, options?: Record<string, unknown>) => void;
  addLog: (level: LogEntry['level'], message: string, options?: { nodeId?: string; deviceId?: string; category?: LogEntry['category'] }) => void;
  clearLogs: () => void;
  connect: () => void;
  disconnect: () => void;
  refreshDevices: () => void;
  sendCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => void;
}

const NodeContext = createContext<NodeContextValue | null>(null);

// ============================================
// Provider
// ============================================

const getWebSocketUrl = () => {
  return import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
};

interface NodeProviderProps {
  children: ReactNode;
  wsEndpoint?: string;
}

export function NodeProvider({ children, wsEndpoint }: NodeProviderProps) {
  const effectiveWsEndpoint = wsEndpoint || getWebSocketUrl();
  const [state, dispatch] = useReducer(nodeReducer, initialState);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastLogRef = useRef<{ message: string; time: number }>({ message: '', time: 0 });
  
  // 설정
  const MAX_RECONNECT_ATTEMPTS = 20;
  const BASE_RECONNECT_DELAY = 1000; // 1초부터 시작
  const MAX_RECONNECT_DELAY = 30000; // 최대 30초

  // ─────────────────────────────────────────
  // 로그 추가 (중복 방지)
  // ─────────────────────────────────────────
  
  const addLogInternal = useCallback((
    level: LogEntry['level'], 
    message: string, 
    options?: { nodeId?: string; deviceId?: string; category?: LogEntry['category'] }
  ) => {
    const now = Date.now();
    
    // 같은 메시지가 1초 이내에 중복되면 무시
    if (lastLogRef.current.message === message && now - lastLogRef.current.time < 1000) {
      return;
    }
    
    lastLogRef.current = { message, time: now };
    
    dispatch({ 
      type: 'ADD_LOG', 
      payload: { 
        level, 
        message, 
        nodeId: options?.nodeId,
        deviceId: options?.deviceId,
        category: options?.category,
      } 
    });
  }, []);

  // ─────────────────────────────────────────
  // 재연결 딜레이 계산 (지수 백오프)
  // ─────────────────────────────────────────
  
  const getReconnectDelay = useCallback((attempt: number): number => {
    // 지수 백오프: 1초, 2초, 4초, 8초... 최대 30초
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    // 약간의 랜덤 지터 추가 (0-500ms)
    return delay + Math.random() * 500;
  }, []);

  // ─────────────────────────────────────────
  // Video Completion (reducer-based for WebSocket handlers)
  // ─────────────────────────────────────────

  const completeVideo = useCallback((videoId: string, stats: { successCount: number; errorCount: number }) => {
    // dispatch로 reducer에서 상태 변경 처리 (stale closure 방지)
    dispatch({ type: 'COMPLETE_VIDEO', payload: { videoId, stats } });
    // 로그는 별도 dispatch로 처리 (video title은 reducer에서 알 수 없으므로 일반 메시지)
    addLogInternal('success', `🎉 영상 완료 (${stats.successCount}회 시청)`, { category: 'video' });
  }, [addLogInternal]);

  const completeVideoFromWs = useCallback((videoId: string, stats: { successCount: number; errorCount: number }) => {
    // WebSocket 핸들러에서도 reducer 기반으로 처리 (stale state 방지)
    dispatch({ type: 'COMPLETE_VIDEO', payload: { videoId, stats } });
    addLogInternal('success', `🎉 영상 완료 (${stats.successCount}회 시청)`, { category: 'video' });
  }, [addLogInternal]);

  // ─────────────────────────────────────────
  // 데이터 변환 (WebSocket 메시지 핸들러에서 사용)
  // ─────────────────────────────────────────

  const convertNodeData = (raw: Record<string, unknown>): GatewayNode => ({
    id: raw.id as string,
    hostname: raw.hostname as string || 'Unknown',
    ipAddress: raw.ipAddress as string || '127.0.0.1',
    platform: raw.platform as string || 'unknown',
    status: (raw.status as NodeStatus) || 'online',
    deviceCount: (raw.deviceCount as number) || 0,
    onlineDeviceCount: (raw.onlineDeviceCount as number) || 0,
    laixiConnected: (raw.laixiConnected as boolean) || false,
    lastSeen: raw.lastSeen ? new Date(raw.lastSeen as string) : new Date(),
    reconnectAttempts: (raw.reconnectAttempts as number) || 0,
  });

  const convertDeviceData = (raw: Record<string, unknown>, nodeId: string): Device => ({
    id: raw.id as string,
    serial: raw.serial as string || raw.id as string,
    name: raw.name as string || `Device ${(raw.id as string).slice(-4)}`,
    model: raw.model as string || 'Unknown',
    status: (raw.status as DeviceStatus) || 'idle',
    wallet: (raw.wallet as number) || 0,
    currentTask: raw.currentTask as { videoId: string; title: string } | null,
    lastSeen: raw.lastSeen ? new Date(raw.lastSeen as string) : new Date(),
    traits: (raw.traits as string[]) || [],
    nodeId: raw.nodeId as string || nodeId,
    errorMessage: raw.errorMessage as string | undefined,
    recoveryAttempts: (raw.recoveryAttempts as number) || 0,
  });

  // ─────────────────────────────────────────
  // WebSocket 메시지 핸들러 (must be declared before connect)
  // ─────────────────────────────────────────

  const handleWebSocketMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'INIT':
      case 'STATE_UPDATE': {
        // 노드(PC) 정보 처리
        if (data.node) {
          const node = convertNodeData(data.node as Record<string, unknown>);
          dispatch({ type: 'SET_NODE', payload: node });

          if (data.type === 'INIT') {
            addLogInternal(
              'success',
              `📡 노드 연결: ${node.hostname} (${node.ipAddress})`,
              { category: 'device', nodeId: node.id }
            );
          }
        }

        // 디바이스(스마트폰) 정보 처리
        if (data.devices && Array.isArray(data.devices)) {
          const nodeId = (data.node as Record<string, unknown>)?.id as string || 'unknown';
          const devices = (data.devices as Array<Record<string, unknown>>).map(d =>
            convertDeviceData(d, nodeId)
          );
          dispatch({ type: 'SET_DEVICES', payload: { nodeId, devices } });

          if (data.type === 'INIT') {
            const onlineCount = devices.filter(d => d.status !== 'offline').length;
            addLogInternal(
              'info',
              `📱 ${devices.length}개 디바이스 감지 (${onlineCount}개 온라인)`,
              { category: 'device', nodeId }
            );
          }
        }
        break;
      }

      case 'DEVICE_STATUS': {
        const deviceId = data.deviceId as string;
        const status = data.status as DeviceStatus;
        const task = data.currentTask as { videoId: string; title: string } | null;

        dispatch({
          type: 'UPDATE_DEVICE',
          payload: { id: deviceId, status, currentTask: task, lastSeen: new Date() },
        });

        // 상태 변경 로그 (busy/idle 전환만)
        if (status === 'busy' && task) {
          addLogInternal('info', `▶️ 시청 시작: ${task.title}`, { category: 'video', deviceId });
        } else if (status === 'idle') {
          addLogInternal('info', `⏹️ 작업 완료`, { category: 'video', deviceId });
        }
        break;
      }

      case 'DEVICE_ERROR': {
        const deviceId = data.deviceId as string;
        const error = data.error as string;

        dispatch({
          type: 'UPDATE_DEVICE',
          payload: { id: deviceId, status: 'error', errorMessage: error, currentTask: null },
        });
        addLogInternal('error', `❌ 디바이스 오류: ${error}`, { category: 'device', deviceId });
        break;
      }

      case 'DEVICE_RECOVERED': {
        const deviceId = data.deviceId as string;
        dispatch({
          type: 'UPDATE_DEVICE',
          payload: { id: deviceId, status: 'idle', errorMessage: undefined, recoveryAttempts: 0, lastSeen: new Date() },
        });
        addLogInternal('success', `✅ 디바이스 복구됨`, { category: 'device', deviceId });
        break;
      }

      case 'LAIXI_CONNECTED': {
        const nodeId = data.nodeId as string;
        dispatch({ type: 'UPDATE_NODE', payload: { id: nodeId, laixiConnected: true, status: 'online' } });
        addLogInternal('success', `✅ Laixi 연결됨`, { category: 'connection', nodeId });
        break;
      }

      case 'LAIXI_DISCONNECTED': {
        const nodeId = data.nodeId as string;
        dispatch({ type: 'UPDATE_NODE', payload: { id: nodeId, laixiConnected: false } });
        dispatch({ type: 'SET_ALL_DEVICES_OFFLINE', payload: nodeId });
        addLogInternal('error', `⚠️ Laixi 연결 끊김`, { category: 'connection', nodeId });
        break;
      }

      case 'LAIXI_RECONNECTING': {
        const nodeId = data.nodeId as string;
        const attempt = data.attempt as number;
        dispatch({ type: 'UPDATE_NODE', payload: { id: nodeId, status: 'reconnecting', reconnectAttempts: attempt } });
        addLogInternal('warn', `🔄 Laixi 재연결 중 (${attempt}/10)`, { category: 'connection', nodeId });
        break;
      }

      case 'VIDEO_PROGRESS': {
        dispatch({
          type: 'UPDATE_QUEUED_VIDEO',
          payload: {
            id: data.videoId as string,
            currentViews: data.currentViews as number,
            progress: data.progress as number,
          },
        });
        break;
      }

      case 'WATCH_PROGRESS': {
        // 시청 진행률 (너무 자주 오면 로그 안 함)
        break;
      }

      case 'VIDEO_DISTRIBUTED': {
        const count = data.distributedCount as number;
        addLogInternal('success', `📤 영상 배분 완료: ${count}개 디바이스`, { category: 'video' });
        break;
      }

      case 'VIDEO_COMPLETE': {
        completeVideoFromWs(
          data.videoId as string,
          data.stats as { successCount: number; errorCount: number }
        );
        break;
      }

      case 'INJECT_RESULT': {
        if (data.success) {
          addLogInternal('success', `✅ ${data.distributedCount}개 디바이스에 배분`, { category: 'video' });
        } else {
          addLogInternal('error', `❌ 배분 실패: ${data.reason || '알 수 없는 오류'}`, { category: 'video' });
        }
        break;
      }

      case 'DISTRIBUTION_FAILED': {
        addLogInternal('error', `❌ 배분 실패: ${data.reason || '활성 디바이스 없음'}`, { category: 'video' });
        break;
      }

      case 'LOG': {
        // 서버에서 보내는 로그 (category 포함)
        addLogInternal(
          data.level as LogEntry['level'],
          data.message as string,
          {
            nodeId: data.nodeId as string | undefined,
            deviceId: data.deviceId as string | undefined,
            category: data.category as LogEntry['category'] || 'system',
          }
        );
        break;
      }

      case 'PONG': {
        // 핑퐁 응답 - 로그 안 함
        break;
      }

      default:
        // 알 수 없는 메시지 타입 - 디버그용
        if (process.env.NODE_ENV === 'development') {
          console.log('Unknown WS message:', data.type, data);
        }
        break;
    }
  }, [addLogInternal, completeVideoFromWs]);

  // ─────────────────────────────────────────
  // WebSocket 연결
  // ─────────────────────────────────────────

  const connect = useCallback(() => {
    // 이미 연결 중이거나 연결됨
    if (isConnectingRef.current) {
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLogInternal('info', '이미 연결되어 있습니다', { category: 'connection' });
      return;
    }

    if (!effectiveWsEndpoint) {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
      addLogInternal('error', '❌ WebSocket URL이 설정되지 않았습니다', { category: 'connection' });
      return;
    }

    isConnectingRef.current = true;
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
    
    const attemptNum = reconnectAttemptsRef.current;
    if (attemptNum === 0) {
      addLogInternal('info', `🔌 Bridge 연결 시도: ${effectiveWsEndpoint}`, { category: 'connection' });
    } else {
      addLogInternal('info', `🔄 재연결 시도 ${attemptNum}/${MAX_RECONNECT_ATTEMPTS}`, { category: 'connection' });
    }

    try {
      const ws = new WebSocket(effectiveWsEndpoint);

      // 연결 타임아웃 (10초)
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          addLogInternal('warn', '⏱️ 연결 타임아웃 (10초)', { category: 'connection' });
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;

        // StrictMode 대응: 언마운트된 경우 무시
        if (!isMountedRef.current) {
          ws.close(1000, 'Component already unmounted');
          return;
        }

        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
        dispatch({ type: 'SET_RECONNECT_ATTEMPT', payload: 0 });
        dispatch({ type: 'SET_ERROR', payload: null });

        addLogInternal('success', '✅ Bridge 연결 성공', { category: 'connection' });

        // 초기 상태 요청
        ws.send(JSON.stringify({ type: 'GET_STATE' }));
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          addLogInternal('error', `📩 메시지 파싱 오류: ${error}`, { category: 'system' });
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        isConnectingRef.current = false;
        
        // onerror 다음에 onclose가 호출되므로 여기서는 간단히 로그만
        const errorInfo = (event as ErrorEvent).message || 'Unknown error';
        addLogInternal('error', `⚠️ WebSocket 오류: ${errorInfo}`, { category: 'connection' });
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        isConnectingRef.current = false;
        wsRef.current = null;
        
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });

        // 클로즈 코드별 메시지
        let closeReason = '';
        switch (event.code) {
          case 1000: closeReason = '정상 종료'; break;
          case 1001: closeReason = '페이지 이동'; break;
          case 1002: closeReason = '프로토콜 오류'; break;
          case 1003: closeReason = '지원하지 않는 데이터'; break;
          case 1006: closeReason = '비정상 종료 (서버 다운?)'; break;
          case 1007: closeReason = '잘못된 데이터'; break;
          case 1008: closeReason = '정책 위반'; break;
          case 1009: closeReason = '메시지 너무 큼'; break;
          case 1011: closeReason = '서버 오류'; break;
          case 1015: closeReason = 'TLS 핸드셰이크 실패'; break;
          default: closeReason = event.reason || `코드: ${event.code}`;
        }

        // StrictMode 대응: 언마운트된 경우 재연결 안함
        if (!isMountedRef.current) {
          return;
        }

        // 재연결 시도
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = getReconnectDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          dispatch({ type: 'SET_RECONNECT_ATTEMPT', payload: reconnectAttemptsRef.current });

          addLogInternal(
            'warn',
            `🔌 연결 끊김 (${closeReason}). ${(delay / 1000).toFixed(1)}초 후 재연결...`,
            { category: 'connection' }
          );

          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          dispatch({ type: 'SET_ERROR', payload: '최대 재연결 횟수 초과' });
          addLogInternal(
            'error',
            `❌ 재연결 실패 (${MAX_RECONNECT_ATTEMPTS}회 시도). 수동으로 재연결하세요.`,
            { category: 'connection' }
          );
        }
      };

      wsRef.current = ws;
    } catch (error) {
      isConnectingRef.current = false;
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
      addLogInternal('error', `❌ 연결 생성 실패: ${error}`, { category: 'connection' });
    }
  }, [effectiveWsEndpoint, addLogInternal, getReconnectDelay, handleWebSocketMessage]);

  const disconnect = useCallback(() => {
    // 재연결 타이머 취소
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // 연결 시도 플래그 초기화
    isConnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    // WebSocket 닫기
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
    dispatch({ type: 'SET_RECONNECT_ATTEMPT', payload: 0 });
    addLogInternal('info', '🔌 연결 종료됨', { category: 'connection' });
  }, [addLogInternal]);

  // ─────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────

  const addVideo = useCallback((
    video: Omit<QueuedVideo, 'id' | 'registeredAt' | 'status' | 'assignedDevices' | 'progress' | 'currentViews'>
  ) => {
    const newVideo: QueuedVideo = {
      ...video,
      id: `video_${Date.now()}`,
      registeredAt: new Date(),
      status: 'queued',
      assignedDevices: [],
      progress: 0,
      currentViews: 0,
    };

    dispatch({ type: 'ADD_QUEUED_VIDEO', payload: newVideo });
    addLogInternal('info', `📋 영상 등록: "${video.title}"`, { category: 'video' });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ADD_VIDEO', video: newVideo }));
    }
  }, [addLogInternal]);

  const updateVideo = useCallback((video: Partial<QueuedVideo> & { id: string }) => {
    dispatch({ type: 'UPDATE_QUEUED_VIDEO', payload: video });
  }, []);

  const injectVideo = useCallback((
    video: { videoId: string; title: string; url: string; thumbnail?: string; channel?: string },
    targetViews: number,
    options: Record<string, unknown> = {}
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'INJECT_VIDEO',
        video: { id: `video_${Date.now()}`, ...video },
        targetViews,
        options,
      }));
      addLogInternal('info', `📤 영상 주입: "${video.title}" (목표: ${targetViews}회)`, { category: 'video' });
    } else {
      addLogInternal('error', '❌ Bridge 연결 안됨 - 영상 주입 실패', { category: 'connection' });
    }
  }, [addLogInternal]);

  const refreshDevices = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REFRESH_DEVICES' }));
      addLogInternal('info', '🔄 디바이스 새로고침 요청', { category: 'device' });
    } else {
      addLogInternal('warn', '⚠️ Bridge 연결 안됨', { category: 'connection' });
    }
  }, [addLogInternal]);

  const sendCommand = useCallback((deviceId: string, command: string, params: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SEND_COMMAND', deviceId, command, params }));
    }
  }, []);

  const addLog = useCallback((
    level: LogEntry['level'], 
    message: string, 
    options?: { nodeId?: string; deviceId?: string; category?: LogEntry['category'] }
  ) => {
    addLogInternal(level, message, options);
  }, [addLogInternal]);

  const clearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR_LOGS' });
  }, []);

  // ─────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────

  const getNodeById = useCallback((id: string) => state.nodes.get(id), [state.nodes]);
  const getOnlineNodes = useCallback(() => Array.from(state.nodes.values()).filter(n => n.status === 'online'), [state.nodes]);
  
  const getDeviceById = useCallback((id: string) => state.devices.get(id), [state.devices]);
  const getDevicesByNodeId = useCallback((nodeId: string) => 
    Array.from(state.devices.values()).filter(d => d.nodeId === nodeId), [state.devices]);
  const getIdleDevices = useCallback(() => 
    Array.from(state.devices.values()).filter(d => d.status === 'idle'), [state.devices]);
  const getBusyDevices = useCallback(() => 
    Array.from(state.devices.values()).filter(d => d.status === 'busy'), [state.devices]);

  // ─────────────────────────────────────────
  // 초기 연결
  // ─────────────────────────────────────────

  useEffect(() => {
    // 컴포넌트 마운트 시 연결
    isMountedRef.current = true;
    connect();

    // 컴포넌트 언마운트 시 정리
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // WebSocket이 OPEN 상태일 때만 정상 종료
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────
  // Context Value
  // ─────────────────────────────────────────

  const contextValue: NodeContextValue = {
    state,
    nodes: Array.from(state.nodes.values()),
    getNodeById,
    getOnlineNodes,
    devices: Array.from(state.devices.values()),
    getDeviceById,
    getDevicesByNodeId,
    getIdleDevices,
    getBusyDevices,
    addVideo,
    updateVideo,
    completeVideo,
    injectVideo,
    addLog,
    clearLogs,
    connect,
    disconnect,
    refreshDevices,
    sendCommand,
  };

  return (
    <NodeContext.Provider value={contextValue}>
      {children}
    </NodeContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useNodes() {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNodes must be used within a NodeProvider');
  }
  return context;
}
