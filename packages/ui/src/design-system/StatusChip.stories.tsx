import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusChip } from ".";

const meta = {
  title: "Design System/StatusChip",
  component: StatusChip,
  tags: ["autodocs"],
  args: {
    status: "in_progress"
  },
  argTypes: {
    status: {
      control: "select",
      options: ["proposed", "ready", "in_progress", "review", "complete"]
    },
    label: { control: "text" }
  }
} satisfies Meta<typeof StatusChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Statuses: Story = {
  render: (args) => (
    <div className="pf-story-row">
      <StatusChip {...args} label={undefined} status="proposed" />
      <StatusChip {...args} label={undefined} status="ready" />
      <StatusChip {...args} label={undefined} status="in_progress" />
      <StatusChip {...args} label={undefined} status="review" />
      <StatusChip {...args} label={undefined} status="complete" />
    </div>
  )
};
