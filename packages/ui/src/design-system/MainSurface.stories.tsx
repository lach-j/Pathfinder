import type { Meta, StoryObj } from "@storybook/react-vite";

import { MainSurface, Metric, Notice, Panel, PanelHeader } from ".";

const meta = {
  title: "Design System/MainSurface",
  component: MainSurface,
  tags: ["autodocs"],
  render: () => (
    <MainSurface className="pf-story-main">
      <Panel>
        <PanelHeader eyebrow="Implementation" title="Base components" description="Main work area surface." />
        <div className="pf-story-metrics">
          <Metric value="12" label="Components" tone="accent" />
          <Metric value="4" label="Stories" tone="success" />
        </div>
        <Notice tone="info" title="Review ready">Use this area for dense workspace content.</Notice>
      </Panel>
    </MainSurface>
  )
} satisfies Meta<typeof MainSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
