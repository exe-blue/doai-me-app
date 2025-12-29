import type { Meta, StoryObj } from '@storybook/react';
import { GlobalActionButton } from './GlobalActionButton';

const meta = {
  title: 'Atoms/GlobalActionButton',
  component: GlobalActionButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['accident', 'pop', 'zombie', 'rescan', 'default'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof GlobalActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Accident 버튼 */
export const Accident: Story = {
  args: {
    variant: 'accident',
    label: 'Accident',
  },
};

/** Pop 버튼 */
export const Pop: Story = {
  args: {
    variant: 'pop',
    label: 'Pop',
  },
};

/** Zombie Recovery 버튼 */
export const Zombie: Story = {
  args: {
    variant: 'zombie',
    label: 'Zombie',
  },
};

/** Rescan 버튼 */
export const Rescan: Story = {
  args: {
    variant: 'rescan',
    label: 'Rescan',
  },
};

/** Default 버튼 */
export const Default: Story = {
  args: {
    variant: 'default',
    label: 'Action',
  },
};

/** 로딩 상태 */
export const Loading: Story = {
  args: {
    variant: 'pop',
    label: 'Loading...',
    loading: true,
  },
};

/** 비활성화 */
export const Disabled: Story = {
  args: {
    variant: 'accident',
    label: 'Disabled',
    disabled: true,
  },
};

/** 모든 버튼 타입 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <GlobalActionButton variant="accident" label="Accident" />
      <GlobalActionButton variant="pop" label="Pop" />
      <GlobalActionButton variant="zombie" label="Zombie" />
      <GlobalActionButton variant="rescan" label="Rescan" />
      <GlobalActionButton variant="default" label="Default" />
    </div>
  ),
};

/** 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <GlobalActionButton variant="accident" label="Small" size="sm" />
      <GlobalActionButton variant="accident" label="Medium" size="md" />
      <GlobalActionButton variant="accident" label="Large" size="lg" />
    </div>
  ),
};

/** 액션 바 예시 */
export const ActionBar: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
      <GlobalActionButton variant="accident" label="Accident" />
      <GlobalActionButton variant="pop" label="Pop" />
      <GlobalActionButton variant="zombie" label="Zombie" />
      <div className="w-px h-6 bg-gray-600" />
      <GlobalActionButton variant="rescan" label="Rescan" />
    </div>
  ),
};

