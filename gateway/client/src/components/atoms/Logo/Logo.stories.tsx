import type { Meta, StoryObj } from '@storybook/react';
import { Logo } from './Logo';

const meta = {
  title: 'Atoms/Logo',
  component: Logo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
    showText: {
      control: { type: 'boolean' },
    },
    animated: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 로고 */
export const Default: Story = {
  args: {
    size: 'md',
    showText: true,
    animated: false,
  },
};

/** 작은 로고 */
export const Small: Story = {
  args: {
    size: 'sm',
    showText: true,
  },
};

/** 큰 로고 */
export const Large: Story = {
  args: {
    size: 'lg',
    showText: true,
  },
};

/** 초대형 로고 */
export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    showText: true,
  },
};

/** 아이콘만 */
export const IconOnly: Story = {
  args: {
    size: 'md',
    showText: false,
  },
};

/** 애니메이션 */
export const Animated: Story = {
  args: {
    size: 'lg',
    showText: true,
    animated: true,
  },
};

/** 모든 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6 items-start">
      <Logo size="sm" />
      <Logo size="md" />
      <Logo size="lg" />
      <Logo size="xl" />
    </div>
  ),
};

