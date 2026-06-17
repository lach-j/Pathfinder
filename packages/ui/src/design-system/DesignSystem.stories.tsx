import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  InspectorPanel,
  ListRow,
  MainSurface,
  Metric,
  Notice,
  Panel,
  PanelHeader,
  Sidebar,
  SplitLayout,
  StatusChip,
  Tabs,
  Toolbar,
  WorkspaceFrame
} from ".";

const meta = {
  title: "Design System/Base Components",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Reusable Pathfinder UI primitives for dense local workspace, review, and artifact surfaces."
      }
    }
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ControlsAndStates: Story = {
  render: () => (
    <div className="pf-story-grid">
      <Panel>
        <PanelHeader
          eyebrow="Controls"
          title="Buttons and status affordances"
          description="Compact actions and readable metadata for repeated workflow use."
        />
        <div className="pf-story-stack">
          <Toolbar align="start">
            <Button variant="primary">Start review</Button>
            <Button variant="secondary">Refresh diff</Button>
            <Button variant="ghost">Copy feedback</Button>
            <Button variant="danger">Discard draft</Button>
            <Button loading>Writing</Button>
            <IconButton aria-label="Open command menu" icon="⌘" />
          </Toolbar>
          <div className="pf-story-row">
            <StatusChip status="proposed" />
            <StatusChip status="ready" />
            <StatusChip status="in_progress" />
            <StatusChip status="review" />
            <StatusChip status="complete" />
          </div>
          <div className="pf-story-row">
            <Badge>Local only</Badge>
            <Badge tone="accent">Active</Badge>
            <Badge tone="success">Checks passed</Badge>
            <Badge tone="warning">Review needed</Badge>
            <Badge tone="danger">Open feedback</Badge>
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelHeader eyebrow="Tabs" title="Artifact panel tabs" />
        <Tabs
          activeId="plan"
          tabs={[
            { id: "plan", label: "Plan", count: 4 },
            { id: "evidence", label: "Evidence", count: 2 },
            { id: "feedback", label: "Feedback", count: 1 }
          ]}
        />
      </Panel>
    </div>
  )
};

export const DenseWorkspaceExample: Story = {
  render: () => (
    <WorkspaceFrame>
      <Sidebar>
        <div className="pf-story-panel-stack">
          <Panel density="compact">
            <PanelHeader eyebrow="Repository" title="Pathfinder" description="main to active slice" />
          </Panel>
          <Panel density="compact">
            <PanelHeader eyebrow="Workstream" title="UI Overhaul" />
            <div className="pf-story-list">
              <ListRow
                selected
                title="Slice 63: Base Design System Components"
                description="Reusable primitives and Storybook states"
                meta="Active slice"
                trailing={<StatusChip status="in_progress" label="In progress" />}
              />
              <ListRow
                title="Slice 64: Workspace Shell UX Refresh"
                description="Navigation hierarchy and responsive behavior"
                meta="Blocked by slice 63"
                trailing={<StatusChip status="proposed" />}
              />
            </div>
          </Panel>
        </div>
      </Sidebar>
      <MainSurface>
        <SplitLayout>
          <Panel>
            <Toolbar>
              <PanelHeader
                eyebrow="Implementation"
                title="Base components"
                description="Dense controls, metadata, list rows, notices, and empty states."
              />
              <Button variant="primary">Run checks</Button>
            </Toolbar>
            <div className="pf-story-metrics">
              <Metric label="Components" value="12" tone="accent" hint="base layer" />
              <Metric label="Stories" value="4" tone="success" hint="dense states" />
              <Metric label="Open comments" value="0" hint="ready" />
            </div>
            <Notice tone="warning" title="Scope guard">
              Keep this slice focused on primitives. Full workspace migration belongs to the next slice.
            </Notice>
            <div className="pf-story-list">
              <ListRow
                title="Button, IconButton, Tabs"
                description="Primary workflow controls with loading, disabled, focus, and compact variants."
                trailing={<Badge tone="success">Ready</Badge>}
              />
              <ListRow
                title="Panel, Toolbar, ListRow"
                description="Surface and scan patterns for workspace navigation and review panels."
                trailing={<Badge tone="accent">Reusable</Badge>}
              />
              <ListRow
                title="EmptyState, Notice, Metric"
                description="Feedback states for missing Pathfinder state, review warnings, and counts."
                trailing={<Badge>Stable</Badge>}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Empty state" title="No review session" />
            <EmptyState
              title="Start a local review"
              description="Commit the slice work, then create a Pathfinder review session from the base ref."
              actions={<Button variant="primary">Start review</Button>}
            />
          </Panel>
        </SplitLayout>
      </MainSurface>
      <InspectorPanel>
        <div className="pf-story-panel-stack">
          <Panel density="compact">
            <PanelHeader eyebrow="Evidence" title="Verification" />
            <div className="pf-story-list">
              <ListRow title="npm run typecheck" meta="Pending" trailing={<Badge>Required</Badge>} />
              <ListRow title="npm test" meta="Pending" trailing={<Badge>Required</Badge>} />
              <ListRow title="npm run build" meta="Pending" trailing={<Badge>Required</Badge>} />
            </div>
          </Panel>
        </div>
      </InspectorPanel>
    </WorkspaceFrame>
  )
};

export const CompactAndLongText: Story = {
  render: () => (
    <Panel className="pf-story-narrow">
      <PanelHeader
        eyebrow="Long content"
        title="Very long workstream and slice labels stay readable inside compact surfaces"
        description="This catches wrapping, metadata density, and trailing control behavior."
        actions={<Button size="sm">Action</Button>}
      />
      <div className="pf-story-list">
        <ListRow
          title="Slice 66: Review Experience Refresh With Clear File Navigation And Accessible Comment Controls"
          description="Prioritize diff readability and comment ergonomics without letting decorative styling compete with code review."
          meta="packages/ui/src/workspace/BranchReviewWorkspace.tsx"
          trailing={<StatusChip status="review" />}
        />
        <Notice tone="danger" title="Unavailable state">
          Pathfinder state was not found for this repository. Run setup before opening the workspace.
        </Notice>
        <Button disabled>Disabled command</Button>
      </div>
    </Panel>
  )
};
