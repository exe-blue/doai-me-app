import type { Meta, StoryObj } from '@storybook/react';
import { ConnectionTypeBadge } from './ConnectionTypeBadge';

const meta = {
  title: 'Atoms/ConnectionTypeBadge',
  component: ConnectionTypeBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['USB', 'WIFI', 'LAN'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    iconOnly: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof ConnectionTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** USB 연결 */
export const USB: Story = {
  args: {
    type: 'USB',
    size: 'md',
  },
};

/** WiFi 연결 */
export const WiFi: Story = {
  args: {
    type: 'WIFI',
    size: 'md',
  },
};

/** LAN 연결 */
export const LAN: Story = {
  args: {
    type: 'LAN',
    size: 'md',
  },
};

/** 아이콘만 */
export const IconOnly: Story = {
  args: {
    type: 'USB',
    iconOnly: true,
  },
};

/** 모든 타입 */
export const AllTypes: Story = {
  render: () => (
    <div className="flex gap-2">
      <ConnectionTypeBadge type="USB" />
      <ConnectionTypeBadge type="WIFI" />
      <ConnectionTypeBadge type="LAN" />
    </div>
  ),
};

/** 모든 사이즈 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <ConnectionTypeBadge type="USB" size="sm" />
      <ConnectionTypeBadge type="USB" size="md" />
      <ConnectionTypeBadge type="USB" size="lg" />
    </div>
  ),
};

