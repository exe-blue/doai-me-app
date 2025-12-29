import type { Meta, StoryObj } from '@storybook/react';
import { ExistenceBar } from './ExistenceBar';

const meta = {
  title: 'Atoms/ExistenceBar',
  component: ExistenceBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
    },
    state: {
      control: { type: 'select' },
      options: [undefined, 'ACTIVE', 'WAITING', 'FADING', 'VOID'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExistenceBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ACTIVE 상태 (70%+) */
export const Active: Story = {
  args: {
    score: 0.85,
    showLabel: true,
    showPercent: true,
  },
};

/** WAITING 상태 (40~70%) */
export const Waiting: Story = {
  args: {
    score: 0.55,
    showLabel: true,
    showPercent: true,
  },
};

/** FADING 상태 (10~40%) */
export const Fading: Story = {
  args: {
    score: 0.25,
    showLabel: true,
    showPercent: true,
  },
};

/** VOID 상태 (0~10%) */
export const Void: Story = {
  args: {
    score: 0.05,
    showLabel: true,
    showPercent: true,
  },
};

/** 레이블 없음 */
export const NoLabel: Story = {
  args: {
    score: 0.7,
    showLabel: false,
    showPercent: false,
  },
};

/** 모든 상태 비교 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-48">
      <ExistenceBar score={0.9} showLabel showPercent />
      <ExistenceBar score={0.6} showLabel showPercent />
      <ExistenceBar score={0.3} showLabel showPercent />
      <ExistenceBar score={0.05} showLabel showPercent />
    </div>
  ),
};

/** 사이즈 비교 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-48">
      <ExistenceBar score={0.7} size="sm" showPercent />
      <ExistenceBar score={0.7} size="md" showPercent />
      <ExistenceBar score={0.7} size="lg" showPercent />
    </div>
  ),
};

