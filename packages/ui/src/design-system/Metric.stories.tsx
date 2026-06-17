import type { Meta, StoryObj } from "@storybook/react-vite";

import { Metric } from ".";

const meta = {
  title: "Design System/Metric",
  component: Metric,
  tags: ["autodocs"],
  args: {
    hint: "base layer",
    label: "Components",
    tone: "accent",
    value: "12"
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "accent", "success", "warning", "danger", "info"]
    },
    value: { control: "text" },
    label: { control: "text" },
    hint: { control: "text" }
  }
} satisfies Meta<typeof Metric>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: (args) => (
    <div className="pf-story-metrics">
      <Metric {...args} tone="neutral" value="0" label="Open comments" hint="ready" />
      <Metric {...args} tone="accent" value="12" label="Components" hint="base layer" />
      <Metric {...args} tone="success" value="167" label="Tests" hint="passing" />
      <Metric {...args} tone="warning" value="1" label="Review" hint="pending" />
    </div>
  )
};
