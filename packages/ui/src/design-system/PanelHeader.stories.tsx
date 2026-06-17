import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge, Button, Panel, PanelHeader } from ".";

const meta = {
  title: "Design System/PanelHeader",
  component: PanelHeader,
  tags: ["autodocs"],
  args: {
    description: "Summary copy should wrap cleanly and stay readable in dense panels.",
    eyebrow: "Artifact",
    title: "Review evidence"
  },
  argTypes: {
    eyebrow: { control: "text" },
    title: { control: "text" },
    description: { control: "text" }
  },
  render: (args) => (
    <Panel className="pf-story-narrow">
      <PanelHeader
        {...args}
        actions={
          <>
            <Badge tone="success">Ready</Badge>
            <Button size="sm">Copy</Button>
          </>
        }
      />
    </Panel>
  )
} satisfies Meta<typeof PanelHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
