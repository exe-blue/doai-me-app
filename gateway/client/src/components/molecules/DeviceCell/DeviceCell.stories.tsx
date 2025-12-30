import type { Meta, StoryObj } from '@storybook/react';
import { DeviceCell } from './DeviceCell';
import type { DiscoveredDevice } from '../../../types';

const mockDevice: DiscoveredDevice = {
  serial: 'R9XN30L5S8Y',
  connectionType: 'USB',
  status: 'ONLINE',
  model: 'Galaxy S9',
  androidVersion: '10',
  lastSeenAt: new Date().toISOString(),
  gatewayClientConnected: true,
  aiCitizenId: 'citizen_001',
  aiCitizen: {
    id: 'citizen_001',
    name: '김민수',
    existence_state: 'ACTIVE',
  },
  metrics: {
    existence_score: 0.85,
    priority: 0.7,
    uniqueness: 0.6,
    corruption: 0.15,
  },
};

const offlineDevice: DiscoveredDevice = {
  ...mockDevice,
  serial: 'OFFLINE_001',
  status: 'OFFLINE',
  gatewayClientConnected: false,
  metrics: {
    existence_score: 0.2,
    priority: 0.3,
    uniqueness: 0.5,
    corruption: 0.4,
  },
};

const meta = {
  title: 'Molecules/DeviceCell',
  component: DeviceCell,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'range', min: 120, max: 400, step: 10 },
    },
    height: {
      control: { type: 'range', min: 200, max: 600, step: 10 },
    },
    selected: {
      control: { type: 'boolean' },
    },
    showStream: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof DeviceCell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 온라인 디바이스 */
export const Online: Story = {
  args: {
    device: mockDevice,
    width: 200,
    height: 350,
    selected: false,
  },
};

/** 오프라인 디바이스 */
export const Offline: Story = {
  args: {
    device: offlineDevice,
    width: 200,
    height: 350,
  },
};

/** 선택된 디바이스 */
export const Selected: Story = {
  args: {
    device: mockDevice,
    width: 200,
    height: 350,
    selected: true,
  },
};

/** WiFi 연결 */
export const WiFiConnection: Story = {
  args: {
    device: { ...mockDevice, connectionType: 'WIFI' },
    width: 200,
    height: 350,
  },
};

/** LAN 연결 */
export const LANConnection: Story = {
  args: {
    device: { ...mockDevice, connectionType: 'LAN' },
    width: 200,
    height: 350,
  },
};

/** FADING 상태 */
export const FadingState: Story = {
  args: {
    device: {
      ...mockDevice,
      metrics: {
        existence_score: 0.25,
        priority: 0.3,
        uniqueness: 0.4,
        corruption: 0.6,
      },
    },
    width: 200,
    height: 350,
  },
};

/** 작은 셀 */
export const SmallCell: Story = {
  args: {
    device: mockDevice,
    width: 150,
    height: 260,
  },
};

/** 그리드 예시 */
export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-2 p-4 bg-room-900">
      <DeviceCell device={mockDevice} width={180} height={320} />
      <DeviceCell device={{ ...mockDevice, serial: 'DEV_002', connectionType: 'WIFI' }} width={180} height={320} />
      <DeviceCell device={offlineDevice} width={180} height={320} />
      <DeviceCell device={{ ...mockDevice, serial: 'DEV_004' }} width={180} height={320} selected />
      <DeviceCell device={{ ...mockDevice, serial: 'DEV_005', connectionType: 'LAN' }} width={180} height={320} />
      <DeviceCell device={{ ...mockDevice, serial: 'DEV_006', metrics: { existence_score: 0.3, priority: 0.4, uniqueness: 0.5, corruption: 0.3 } }} width={180} height={320} />
    </div>
  ),
};

