import type { Meta, StoryObj } from '@storybook/react';
import { MetricBadge } from './MetricBadge';

const meta = {
  title: 'Atoms/MetricBadge',
  component: MetricBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['existence', 'priority', 'uniqueness', 'corruption', 'fps', 'bitrate'],
    },
    value: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof MetricBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Existence 메트릭 */
export const Existence: Story = {
  args: {
    type: 'existence',
    value: 0.85,
    format: 'percent',
  },
};

/** Priority 메트릭 */
export const Priority: Story = {
  args: {
    type: 'priority',
    value: 0.7,
    format: 'percent',
  },
};

/** Uniqueness 메트릭 */
export const Uniqueness: Story = {
  args: {
    type: 'uniqueness',
    value: 0.6,
    format: 'percent',
  },
};

/** Corruption 메트릭 (낮음) */
export const CorruptionLow: Story = {
  args: {
    type: 'corruption',
    value: 0.1,
    format: 'percent',
  },
};

/** Corruption 메트릭 (높음) */
export const CorruptionHigh: Story = {
  args: {
    type: 'corruption',
    value: 0.8,
    format: 'percent',
  },
};

/** FPS 메트릭 */
export const FPS: Story = {
  args: {
    type: 'fps',
    value: 30,
    format: 'fps',
  },
};

/** Bitrate 메트릭 */
export const Bitrate: Story = {
  args: {
    type: 'bitrate',
    value: 2500,
    format: 'bitrate',
  },
};

/** 모든 메트릭 타입 */
export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <MetricBadge type="existence" value={0.85} />
      <MetricBadge type="priority" value={0.7} />
      <MetricBadge type="uniqueness" value={0.6} />
      <MetricBadge type="corruption" value={0.2} />
      <MetricBadge type="fps" value={30} format="fps" />
      <MetricBadge type="bitrate" value={2500} format="bitrate" />
    </div>
  ),
};

/** 디바이스 메트릭 그룹 */
export const DeviceMetrics: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-lg">
      <div className="text-xs text-gray-400 mb-1">AI Citizen Metrics</div>
      <div className="flex flex-wrap gap-1.5">
        <MetricBadge type="existence" value={0.78} size="sm" />
        <MetricBadge type="priority" value={0.65} size="sm" />
        <MetricBadge type="uniqueness" value={0.52} size="sm" />
        <MetricBadge type="corruption" value={0.15} size="sm" />
      </div>
    </div>
  ),
};

