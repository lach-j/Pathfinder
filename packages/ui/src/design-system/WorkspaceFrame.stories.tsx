import type { Meta, StoryObj } from "@storybook/react-vite";

import { InspectorPanel, MainSurface, Panel, PanelHeader, Sidebar, WorkspaceFrame } from ".";

const meta = {
  title: "Design System/WorkspaceFrame",
  component: WorkspaceFrame,
  tags: ["autodocs"],
  render: () => (
    <WorkspaceFrame>
      <Sidebar>
        <div className="pf-story-panel-stack">
          <Panel density="compact">
            <PanelHeader eyebrow="Sidebar" title="Workstreams" description="Navigation column" />
          </Panel>
        </div>
      </Sidebar>
      <MainSurface>
        <Panel>
          <PanelHeader eyebrow="Main" title="Canvas or review surface" description="Primary workspace content" />
        </Panel>
      </MainSurface>
      <InspectorPanel>
        <div className="pf-story-panel-stack">
          <Panel density="compact">
            <PanelHeader eyebrow="Inspector" title="Artifacts" description="Context panel" />
          </Panel>
        </div>
      </InspectorPanel>
    </WorkspaceFrame>
  )
} satisfies Meta<typeof WorkspaceFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
