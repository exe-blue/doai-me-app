import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LogLine } from './LogLine';

const meta = {
  title: 'Molecules/LogLine',
  component: LogLine,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    level: {
      control: { type: 'select' },
      options: ['info', 'warn', 'error', 'debug', 'success'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl bg-room-800 rounded-lg p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LogLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Info 로그 */
export const Info: Story = {
  args: {
    timestamp: new Date(),
    level: 'info',
    source: 'Gateway',
    message: '디바이스 연결됨: R9XN30L5S8Y',
  },
};

/** Warning 로그 */
export const Warning: Story = {
  args: {
    timestamp: new Date(),
    level: 'warn',
    source: 'Heartbeat',
    message: '응답 지연 감지: DEV_003 (500ms)',
  },
};

/** Error 로그 */
export const Error: Story = {
  args: {
    timestamp: new Date(),
    level: 'error',
    source: 'ADB',
    message: 'ADB 연결 실패: device not found',
    data: {
      deviceId: 'R9XN30L5S8Y',
      errorCode: 'DEVICE_NOT_FOUND',
      retryCount: 3,
    },
  },
};

/** Debug 로그 */
export const Debug: Story = {
  args: {
    timestamp: new Date(),
    level: 'debug',
    source: 'WebSocket',
    message: 'Message received: devices:updated',
  },
};

/** Success 로그 */
export const Success: Story = {
  args: {
    timestamp: new Date(),
    level: 'success',
    source: 'Dispatch',
    message: 'POP 명령 전송 완료 (20대)',
  },
};

/** 데이터 포함 (확장 가능) */
export const WithData: Story = {
  args: {
    timestamp: new Date(),
    level: 'info',
    source: 'API',
    message: 'Device status changed',
    data: {
      deviceId: 'R9XN30L5S8Y',
      previousStatus: 'OFFLINE',
      newStatus: 'ONLINE',
      connectionType: 'USB',
    },
    expanded: true,
  },
};

/** 로그 스트림 예시 */
export const LogStream: Story = {
  render: function LogStreamExample() {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    
    const logs = [
      { level: 'info', source: 'Gateway', message: '서버 시작: http://0.0.0.0:3100', timestamp: new Date(Date.now() - 10000) },
      { level: 'success', source: 'ADB', message: 'ADB 서버 연결 완료', timestamp: new Date(Date.now() - 9000) },
      { level: 'info', source: 'Discovery', message: '디바이스 스캔 시작...', timestamp: new Date(Date.now() - 8000) },
      { level: 'success', source: 'Discovery', message: '20대 디바이스 발견', timestamp: new Date(Date.now() - 7000), data: { usb: 15, wifi: 3, lan: 2 } },
      { level: 'debug', source: 'WebSocket', message: 'Client connected: ws://...', timestamp: new Date(Date.now() - 6000) },
      { level: 'warn', source: 'Heartbeat', message: 'DEV_003 응답 없음 (재시도 1/3)', timestamp: new Date(Date.now() - 5000) },
      { level: 'error', source: 'ADB', message: 'DEV_003 연결 실패', timestamp: new Date(Date.now() - 4000), data: { error: 'timeout', duration: 5000 } },
      { level: 'info', source: 'Dispatch', message: 'POP 명령 준비: 19대 대상', timestamp: new Date(Date.now() - 3000) },
      { level: 'success', source: 'Dispatch', message: 'POP 전송 완료', timestamp: new Date(Date.now() - 2000) },
    ] as const;
    
    return (
      <div className="flex flex-col">
        {logs.map((log, i) => (
          <LogLine
            key={i}
            {...log}
            expanded={expandedIndex === i}
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          />
        ))}
      </div>
    );
  },
};

