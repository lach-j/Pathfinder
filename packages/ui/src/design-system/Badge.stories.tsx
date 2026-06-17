import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from ".";

const meta = {
  title: "Design System/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Local only",
    tone: "neutral"
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "accent", "success", "warning", "danger", "info"]
    },
    children: { control: "text" }
  }
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: (args) => (
    <div className="pf-story-row">
      <Badge {...args} tone="neutral">Neutral</Badge>
      <Badge {...args} tone="accent">Accent</Badge>
      <Badge {...args} tone="success">Success</Badge>
      <Badge {...args} tone="warning">Warning</Badge>
      <Badge {...args} tone="danger">Danger</Badge>
      <Badge {...args} tone="info">Info</Badge>
    </div>
  )
};
