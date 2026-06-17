import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs } from ".";

const meta = {
  title: "Design System/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: {
    activeId: "plan",
    tabs: [
      { id: "plan", label: "Plan", count: 4 },
      { id: "evidence", label: "Evidence", count: 2 },
      { id: "feedback", label: "Feedback", count: 1 }
    ]
  },
  argTypes: {
    activeId: { control: "select", options: ["plan", "evidence", "feedback"] },
    tabs: { control: "object" }
  }
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
