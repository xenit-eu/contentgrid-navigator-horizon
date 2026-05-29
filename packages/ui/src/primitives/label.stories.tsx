import type { Meta, StoryObj } from "@storybook/react"

import { Label } from "./label"
import { Input } from "./input"

const meta = {
  title: "Primitives/Label",
  component: Label,
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Label>Email address</Label>,
}

export const WithInput: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="label-email">Email</Label>
      <Input id="label-email" type="email" placeholder="you@example.com" />
    </div>
  ),
}

export const Required: Story = {
  render: () => (
    <div className="grid w-64 gap-2">
      <Label htmlFor="label-name">
        Full name <span className="text-destructive">*</span>
      </Label>
      <Input id="label-name" placeholder="Jane Smith" />
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="group grid w-64 gap-2" data-disabled="true">
      <Label htmlFor="label-disabled">Username</Label>
      <Input id="label-disabled" disabled value="jane_smith" readOnly />
    </div>
  ),
}
