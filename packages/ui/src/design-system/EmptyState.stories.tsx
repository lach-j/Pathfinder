import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button, EmptyState } from ".";

const meta = {
  title: "Design System/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    description: "Commit the slice work, then create a Pathfinder review session from the base ref.",
    icon: "◇",
    title: "Start a local review"
  },
  argTypes: {
    icon: { control: "text" },
    title: { control: "text" },
    description: { control: "text" }
  },
  render: (args) => (
    <EmptyState
      {...args}
      className="pf-story-narrow"
      actions={<Button variant="primary">Start review</Button>}
    />
  )
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
