import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge, InspectorPanel, ListRow, Panel, PanelHeader } from ".";

const meta = {
  title: "Design System/InspectorPanel",
  component: InspectorPanel,
  tags: ["autodocs"],
  render: () => (
    <InspectorPanel className="pf-story-inspector">
      <div className="pf-story-panel-stack">
        <Panel density="compact">
          <PanelHeader eyebrow="Evidence" title="Verification" />
          <ListRow title="npm run typecheck" meta="Passed" trailing={<Badge tone="success">Done</Badge>} />
          <ListRow title="npm test" meta="Passed" trailing={<Badge tone="success">Done</Badge>} />
        </Panel>
      </div>
    </InspectorPanel>
  )
} satisfies Meta<typeof InspectorPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
