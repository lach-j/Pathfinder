import type { Meta, StoryObj } from "@storybook/react-vite";

import { ListRow, Panel, PanelHeader, Sidebar, StatusChip } from ".";

const meta = {
  title: "Design System/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  render: () => (
    <Sidebar className="pf-story-sidebar">
      <div className="pf-story-panel-stack">
        <Panel density="compact">
          <PanelHeader eyebrow="Repository" title="Pathfinder" description="main to active slice" />
        </Panel>
        <Panel density="compact">
          <PanelHeader eyebrow="Slices" title="UI Overhaul" />
          <ListRow
            selected
            title="Slice 63"
            description="Base design system components"
            trailing={<StatusChip status="complete" />}
          />
        </Panel>
      </div>
    </Sidebar>
  )
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
