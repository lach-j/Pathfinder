import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from ".";

const meta = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Run checks",
    disabled: false,
    loading: false,
    size: "md",
    variant: "secondary"
  },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    children: { control: "text" }
  }
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="pf-story-row">
      <Button {...args} variant="primary">Primary</Button>
      <Button {...args} variant="secondary">Secondary</Button>
      <Button {...args} variant="ghost">Ghost</Button>
      <Button {...args} variant="danger">Danger</Button>
    </div>
  )
};
