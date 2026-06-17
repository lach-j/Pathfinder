import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge, Button, Panel, PanelHeader } from ".";

const meta = {
  title: "Design System/Panel",
  component: Panel,
  tags: ["autodocs"],
  args: {
    density: "normal"
  },
  argTypes: {
    density: { control: "inline-radio", options: ["normal", "compact"] }
  },
  render: (args) => (
    <Panel {...args} className="pf-story-narrow">
      <PanelHeader
        eyebrow="Workstream"
        title="UI Overhaul"
        description="A bounded surface for related Pathfinder content."
        actions={<Badge tone="accent">Active</Badge>}
      />
      <div className="pf-story-stack">
        <p className="pf-story-copy">Panels provide the base surface treatment for inspectors, lists, and workflow sections.</p>
        <Button variant="primary">Open review</Button>
      </div>
    </Panel>
  )
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
