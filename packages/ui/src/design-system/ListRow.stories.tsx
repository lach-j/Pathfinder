import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge, ListRow, StatusChip } from ".";

const meta = {
  title: "Design System/ListRow",
  component: ListRow,
  tags: ["autodocs"],
  args: {
    description: "Reusable primitives and Storybook coverage for dense Pathfinder workflows.",
    meta: "Active slice",
    selected: false,
    title: "Slice 63: Base Design System Components"
  },
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    meta: { control: "text" },
    selected: { control: "boolean" }
  },
  render: (args) => (
    <div className="pf-story-list pf-story-narrow">
      <ListRow {...args} trailing={<StatusChip status="in_progress" label="In progress" />} />
      <ListRow
        title="Slice 64: Workspace Shell UX Refresh"
        description="Navigation hierarchy and responsive behavior."
        meta="Blocked by slice 63"
        trailing={<Badge>Proposed</Badge>}
      />
    </div>
  )
} satisfies Meta<typeof ListRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
