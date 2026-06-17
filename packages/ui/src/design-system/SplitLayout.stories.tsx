import type { Meta, StoryObj } from "@storybook/react-vite";

import { EmptyState, Panel, PanelHeader, SplitLayout } from ".";

const meta = {
  title: "Design System/SplitLayout",
  component: SplitLayout,
  tags: ["autodocs"],
  render: () => (
    <div className="pf-story-surface">
      <SplitLayout>
        <Panel>
          <PanelHeader eyebrow="Primary" title="Diff review" description="Wide side of a split workflow." />
        </Panel>
        <Panel>
          <EmptyState title="No file selected" description="Select a file to inspect comments." />
        </Panel>
      </SplitLayout>
    </div>
  )
} satisfies Meta<typeof SplitLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
