import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button, Notice } from ".";

const meta = {
  title: "Design System/Notice",
  component: Notice,
  tags: ["autodocs"],
  args: {
    children: "Keep this slice focused on primitives. Full workspace migration belongs to the next slice.",
    title: "Scope guard",
    tone: "warning"
  },
  argTypes: {
    tone: { control: "select", options: ["accent", "success", "warning", "danger", "info"] },
    title: { control: "text" },
    children: { control: "text" }
  },
  render: (args) => (
    <Notice {...args} className="pf-story-narrow" actions={<Button size="sm">Dismiss</Button>} />
  )
} satisfies Meta<typeof Notice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: (args) => (
    <div className="pf-story-list pf-story-narrow">
      <Notice {...args} tone="info" title="Info">Review session metadata is available.</Notice>
      <Notice {...args} tone="success" title="Success">All local checks passed.</Notice>
      <Notice {...args} tone="warning" title="Warning">One review comment needs attention.</Notice>
      <Notice {...args} tone="danger" title="Danger">Pathfinder state was not found.</Notice>
    </div>
  )
};
