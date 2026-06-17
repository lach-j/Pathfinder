import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button, Toolbar } from ".";

const meta = {
  title: "Design System/Toolbar",
  component: Toolbar,
  tags: ["autodocs"],
  args: {
    align: "between"
  },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "between", "end"] }
  },
  render: (args) => (
    <div className="pf-story-surface">
      <Toolbar {...args}>
        <div className="pf-story-heading">
          <strong>Review toolbar</strong>
          <span>Actions stay reachable while content wraps.</span>
        </div>
        <div className="pf-story-row">
          <Button variant="secondary">Refresh</Button>
          <Button variant="primary">Start review</Button>
        </div>
      </Toolbar>
    </div>
  )
} satisfies Meta<typeof Toolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
