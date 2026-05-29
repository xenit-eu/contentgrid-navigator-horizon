import type { Meta, StoryObj } from "@storybook/react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-80">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p className="text-sm text-muted-foreground">
          Manage your account details and preferences.
        </p>
      </TabsContent>
      <TabsContent value="notifications">
        <p className="text-sm text-muted-foreground">
          Configure email and push notification settings.
        </p>
      </TabsContent>
      <TabsContent value="security">
        <p className="text-sm text-muted-foreground">
          Update your password and two-factor authentication.
        </p>
      </TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm text-muted-foreground">Overview content.</p>
      </TabsContent>
      <TabsContent value="activity">
        <p className="text-sm text-muted-foreground">Recent activity.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p className="text-sm text-muted-foreground">Settings content.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="profile" orientation="vertical" className="w-80">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <p className="text-sm text-muted-foreground">Profile settings.</p>
      </TabsContent>
      <TabsContent value="billing">
        <p className="text-sm text-muted-foreground">Billing and plans.</p>
      </TabsContent>
      <TabsContent value="team">
        <p className="text-sm text-muted-foreground">Team management.</p>
      </TabsContent>
    </Tabs>
  ),
}
