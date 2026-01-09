/**
 * Device Store
 * 
 * 실시간 디바이스 상태 관리 (Zustand)
 * 
 * @author Axon (Tech Lead)
 */

import { create } from 'zustand';
import { 
  getDevices, 
  getDevice, 
  rescanDevices,
  Device, 
  DeviceCount 
} from '@/services/api';

interface DeviceState {
  // 상태
  devices: Device[];
  count: DeviceCount | null;
  selectedDeviceId: string | null;
  expandedDeviceId: string | null;
  
  // 로딩 상태
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  
  // 필터
  filters: {
    status: string[];
    activity: string[];
    connectionType: string[];
    searchTerm: string;
  };
  
  // 정렬
  sortBy: string;
  
  // 액션
  fetchDevices: () => Promise<void>;
  fetchDevice: (id: string) => Promise<Device | null>;
  scanDevices: () => Promise<void>;
  
  // UI 액션
  setSelectedDevice: (id: string | null) => void;
  toggleExpandDevice: (id: string) => void;
  setFilters: (filters: Partial<DeviceState['filters']>) => void;
  setSortBy: (sortBy: string) => void;
  
  // WebSocket 업데이트
  updateDevice: (device: Partial<Device> & { serial: string }) => void;
  addDevice: (device: Device) => void;
  removeDevice: (serial: string) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  // 초기 상태
  devices: [],
  count: null,
  selectedDeviceId: null,
  expandedDeviceId: null,
  isLoading: false,
  isScanning: false,
  error: null,
  filters: {
    status: [],
    activity: [],
    connectionType: [],
    searchTerm: '',
  },
  sortBy: 'existence_desc',

  // 디바이스 목록 조회
  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await getDevices();
      
      if (response.success) {
        set({
          devices: response.devices,
          count: response.count,
          isLoading: false,
        });
      } else {
        throw new Error('디바이스 목록 조회 실패');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류';
      set({ error: message, isLoading: false });
    }
  },

  // 단일 디바이스 조회
  fetchDevice: async (id: string) => {
    try {
      const response = await getDevice(id);
      
      if (response.success) {
        // 스토어 내 디바이스 정보 업데이트
        set((state) => ({
          devices: state.devices.map((d) =>
            d.serial === id ? { ...d, ...response.device } : d
          ),
        }));
        return response.device;
      }
      return null;
    } catch (e) {
      console.error('[DeviceStore] 디바이스 조회 실패:', e);
      return null;
    }
  },

  // 디바이스 스캔
  scanDevices: async () => {
    set({ isScanning: true });
    
    try {
      await rescanDevices();
      // 스캔 완료 후 목록 갱신
      await get().fetchDevices();
    } catch (e) {
      console.error('[DeviceStore] 스캔 실패:', e);
    } finally {
      set({ isScanning: false });
    }
  },

  // 선택된 디바이스 설정
  setSelectedDevice: (id) => {
    set({ selectedDeviceId: id });
  },

  // 디바이스 확장/축소 토글
  toggleExpandDevice: (id) => {
    set((state) => ({
      expandedDeviceId: state.expandedDeviceId === id ? null : id,
    }));
  },

  // 필터 설정
  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  // 정렬 설정
  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  // WebSocket: 디바이스 업데이트
  updateDevice: (partialDevice) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.serial === partialDevice.serial ? { ...d, ...partialDevice } : d
      ),
    }));
  },

  // WebSocket: 디바이스 추가
  addDevice: (device) => {
    set((state) => {
      // 이미 존재하면 업데이트
      const exists = state.devices.some((d) => d.serial === device.serial);
      if (exists) {
        return {
          devices: state.devices.map((d) =>
            d.serial === device.serial ? device : d
          ),
        };
      }
      return { devices: [...state.devices, device] };
    });
  },

  // WebSocket: 디바이스 제거
  removeDevice: (serial) => {
    set((state) => ({
      devices: state.devices.filter((d) => d.serial !== serial),
      expandedDeviceId: state.expandedDeviceId === serial ? null : state.expandedDeviceId,
    }));
  },
}));

// ============================================================
// 파생 셀렉터 (필터링 & 정렬)
// ============================================================

export const useFilteredDevices = () => {
  const devices = useDeviceStore((state) => state.devices);
  const filters = useDeviceStore((state) => state.filters);
  const sortBy = useDeviceStore((state) => state.sortBy);

  // 필터 적용
  let filtered = devices.filter((device) => {
    // 상태 필터
    if (filters.status.length > 0 && !filters.status.includes(device.status)) {
      return false;
    }
    
    // 연결 타입 필터
    if (filters.connectionType.length > 0 && !filters.connectionType.includes(device.connectionType)) {
      return false;
    }
    
    // 검색어 필터
    if (filters.searchTerm) {
      const search = filters.searchTerm.toLowerCase();
      const matchSerial = device.serial.toLowerCase().includes(search);
      const matchName = device.aiCitizen?.name?.toLowerCase().includes(search);
      const matchModel = device.model?.toLowerCase().includes(search);
      if (!matchSerial && !matchName && !matchModel) {
        return false;
      }
    }
    
    return true;
  });

  // 정렬 적용
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'existence_desc':
        return (b.metrics?.existence_score || 0) - (a.metrics?.existence_score || 0);
      case 'existence_asc':
        return (a.metrics?.existence_score || 0) - (b.metrics?.existence_score || 0);
      case 'name_asc':
        return (a.aiCitizen?.name || a.serial).localeCompare(b.aiCitizen?.name || b.serial);
      case 'name_desc':
        return (b.aiCitizen?.name || b.serial).localeCompare(a.aiCitizen?.name || a.serial);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  return filtered;
};

