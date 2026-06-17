import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconButton } from ".";

const meta = {
  title: "Design System/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: {
    "aria-label": "Refresh review",
    disabled: false,
    icon: "↻",
    loading: false,
    size: "md",
    variant: "ghost"
  },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    icon: { control: "text" },
    "aria-label": { control: "text" },
    loading: { control: "boolean" },
    disabled: { control: "boolean" }
  }
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="pf-story-row">
      <IconButton {...args} aria-label="Refresh review" icon="↻" />
      <IconButton {...args} aria-label="Copy feedback" icon="⧉" variant="secondary" />
      <IconButton {...args} aria-label="Open command menu" icon="⌘" variant="primary" />
      <IconButton {...args} aria-label="Delete draft" icon="×" variant="danger" />
    </div>
  )
};
