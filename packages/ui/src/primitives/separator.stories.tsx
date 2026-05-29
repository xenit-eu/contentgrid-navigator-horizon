import type { Meta, StoryObj } from "@storybook/react"

import { Separator } from "./separator"

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-48">
      <p className="text-sm font-medium">Account</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Notifications</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Security</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-4 text-sm">
      <span>Home</span>
      <Separator orientation="vertical" />
      <span>Settings</span>
      <Separator orientation="vertical" />
      <span>Help</span>
    </div>
  ),
}
