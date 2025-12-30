import type { Meta, StoryObj } from '@storybook/react';
import { ControlButton } from './ControlButton';

const meta = {
  title: 'Molecules/ControlButton',
  component: ControlButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['back', 'home', 'recent', 'screenshot', 'restart', 'custom'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'danger', 'warning'],
    },
  },
} satisfies Meta<typeof ControlButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Back 버튼 */
export const Back: Story = {
  args: {
    type: 'back',
  },
};

/** Home 버튼 */
export const Home: Story = {
  args: {
    type: 'home',
  },
};

/** Recent 버튼 */
export const Recent: Story = {
  args: {
    type: 'recent',
  },
};

/** Screenshot 버튼 */
export const Screenshot: Story = {
  args: {
    type: 'screenshot',
  },
};

/** Restart 버튼 (Warning) */
export const Restart: Story = {
  args: {
    type: 'restart',
    variant: 'warning',
  },
};

/** 로딩 상태 */
export const Loading: Story = {
  args: {
    type: 'screenshot',
    loading: true,
  },
};

/** 비활성화 */
export const Disabled: Story = {
  args: {
    type: 'back',
    disabled: true,
  },
};

/** 커스텀 버튼 */
export const Custom: Story = {
  args: {
    type: 'custom',
    icon: '🎮',
    label: 'Play',
  },
};

/** 네비게이션 컨트롤 */
export const NavigationControls: Story = {
  render: () => (
    <div className="flex gap-2 p-4 bg-room-800 rounded-lg">
      <ControlButton type="back" />
      <ControlButton type="home" />
      <ControlButton type="recent" />
    </div>
  ),
};

/** 유틸리티 컨트롤 */
export const UtilityControls: Story = {
  render: () => (
    <div className="flex gap-2 p-4 bg-room-800 rounded-lg">
      <ControlButton type="screenshot" />
      <ControlButton type="restart" variant="warning" />
      <ControlButton type="custom" icon="❌" label="Kill App" variant="danger" />
    </div>
  ),
};

/** 전체 제어 패널 */
export const FullControlPanel: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-room-800 rounded-lg w-72">
      <div className="text-sm text-gray-400 mb-1">Navigation</div>
      <div className="grid grid-cols-3 gap-2">
        <ControlButton type="back" />
        <ControlButton type="home" />
        <ControlButton type="recent" />
      </div>
      
      <div className="text-sm text-gray-400 mb-1 mt-2">Actions</div>
      <div className="grid grid-cols-2 gap-2">
        <ControlButton type="screenshot" />
        <ControlButton type="restart" variant="warning" />
      </div>
      
      <div className="text-sm text-gray-400 mb-1 mt-2">AutoX.js</div>
      <div className="grid grid-cols-2 gap-2">
        <ControlButton type="custom" icon="▶️" label="Start" />
        <ControlButton type="custom" icon="⏹️" label="Stop" variant="danger" />
      </div>
    </div>
  ),
};

