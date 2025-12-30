import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TabItem } from './TabItem';

const meta = {
  title: 'Molecules/TabItem',
  component: TabItem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: { type: 'select' },
      options: ['line', 'pill'],
    },
  },
} satisfies Meta<typeof TabItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 탭 (비활성) */
export const Default: Story = {
  args: {
    id: 'tab-1',
    icon: '📱',
    label: 'Devices',
  },
};

/** 활성 탭 */
export const Active: Story = {
  args: {
    id: 'tab-1',
    icon: '📱',
    label: 'Devices',
    active: true,
  },
};

/** 배지 포함 */
export const WithBadge: Story = {
  args: {
    id: 'tab-1',
    icon: '🔔',
    label: 'Notifications',
    badge: 5,
  },
};

/** Pill 변형 */
export const PillVariant: Story = {
  args: {
    id: 'tab-1',
    icon: '📱',
    label: 'Devices',
    variant: 'pill',
    active: true,
  },
};

/** 비활성화 */
export const Disabled: Story = {
  args: {
    id: 'tab-1',
    icon: '⚙️',
    label: 'Settings',
    disabled: true,
  },
};

/** Line 탭 바 */
export const LineTabBar: Story = {
  render: function LineTabBarExample() {
    const [activeTab, setActiveTab] = useState('devices');
    const tabs = [
      { id: 'devices', icon: '📱', label: 'Devices' },
      { id: 'logs', icon: '📝', label: 'Logs', badge: 3 },
      { id: 'files', icon: '📁', label: 'Files' },
      { id: 'settings', icon: '⚙️', label: 'Settings' },
    ];
    
    return (
      <div className="flex border-b border-room-600">
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            {...tab}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant="line"
          />
        ))}
      </div>
    );
  },
};

/** Pill 탭 바 */
export const PillTabBar: Story = {
  render: function PillTabBarExample() {
    const [activeTab, setActiveTab] = useState('all');
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'online', label: 'Online', badge: 18 },
      { id: 'offline', label: 'Offline', badge: 2 },
      { id: 'error', label: 'Error' },
    ];
    
    return (
      <div className="flex gap-2 p-2 bg-room-800 rounded-lg">
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            {...tab}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant="pill"
            size="sm"
          />
        ))}
      </div>
    );
  },
};

/** 아이콘 전용 */
export const IconOnly: Story = {
  render: function IconOnlyExample() {
    const [activeTab, setActiveTab] = useState('grid');
    const tabs = [
      { id: 'grid', icon: '⊞', label: '' },
      { id: 'list', icon: '☰', label: '' },
      { id: 'detail', icon: '⬚', label: '' },
    ];
    
    return (
      <div className="flex gap-1 p-1 bg-room-800 rounded-lg">
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            {...tab}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant="pill"
            size="sm"
          />
        ))}
      </div>
    );
  },
};

