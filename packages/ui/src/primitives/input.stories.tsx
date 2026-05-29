import type { Meta, StoryObj } from "@storybook/react"

import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "Primitives/Input",
  component: Input,
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Input placeholder="Enter text…" />,
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="email">Email address</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="readonly-name">Username</Label>
      <Input id="readonly-name" disabled value="jane_smith" readOnly />
    </div>
  ),
}

export const Invalid: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="invalid-email">Email address</Label>
      <Input
        id="invalid-email"
        type="email"
        aria-invalid="true"
        defaultValue="not-an-email"
      />
      <p className="text-sm text-destructive">Please enter a valid email.</p>
    </div>
  ),
}
