import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './IconButton';

const meta = {
  title: 'Atoms/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['ghost', 'outline', 'filled'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ghost 버튼 */
export const Ghost: Story = {
  args: {
    icon: '🏠',
    label: 'Home',
    variant: 'ghost',
  },
};

/** Outline 버튼 */
export const Outline: Story = {
  args: {
    icon: '⚙️',
    label: 'Settings',
    variant: 'outline',
  },
};

/** Filled 버튼 */
export const Filled: Story = {
  args: {
    icon: '➕',
    label: 'Add',
    variant: 'filled',
  },
};

/** 활성 상태 */
export const Active: Story = {
  args: {
    icon: '📱',
    label: 'Devices',
    variant: 'ghost',
    active: true,
  },
};

/** 비활성화 */
export const Disabled: Story = {
  args: {
    icon: '🔒',
    label: 'Locked',
    disabled: true,
  },
};

/** 네비게이션 예시 */
export const Navigation: Story = {
  render: () => (
    <div className="flex items-center gap-1 p-2 bg-gray-800 rounded-lg">
      <IconButton icon="📊" label="Dashboard" variant="ghost" active />
      <IconButton icon="📱" label="Devices" variant="ghost" />
      <IconButton icon="📁" label="Files" variant="ghost" />
      <IconButton icon="📝" label="Logs" variant="ghost" />
      <IconButton icon="⚙️" label="Settings" variant="ghost" />
    </div>
  ),
};

/** 툴바 예시 */
export const Toolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
      <IconButton icon="▶️" label="Play" variant="filled" />
      <IconButton icon="⏸️" label="Pause" variant="outline" />
      <IconButton icon="⏹️" label="Stop" variant="outline" />
      <div className="w-px h-6 bg-gray-600" />
      <IconButton icon="🔄" label="Refresh" variant="ghost" />
      <IconButton icon="📷" label="Screenshot" variant="ghost" />
    </div>
  ),
};

/** 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton icon="⭐" label="Small" size="sm" variant="outline" />
      <IconButton icon="⭐" label="Medium" size="md" variant="outline" />
      <IconButton icon="⭐" label="Large" size="lg" variant="outline" />
    </div>
  ),
};

/** 모든 변형 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <IconButton icon="📱" label="Ghost" variant="ghost" />
        <span className="text-xs text-gray-400">Ghost</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <IconButton icon="📱" label="Outline" variant="outline" />
        <span className="text-xs text-gray-400">Outline</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <IconButton icon="📱" label="Filled" variant="filled" />
        <span className="text-xs text-gray-400">Filled</span>
      </div>
    </div>
  ),
};

