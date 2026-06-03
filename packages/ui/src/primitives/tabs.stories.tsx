import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

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
};

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
};

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
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <Tabs defaultValue="first" className="w-80">
      <TabsList>
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="second">Second</TabsTrigger>
        <TabsTrigger value="third">Third</TabsTrigger>
      </TabsList>
      <TabsContent value="first">
        <p className="text-sm">First tab content</p>
      </TabsContent>
      <TabsContent value="second">
        <p className="text-sm">Second tab content</p>
      </TabsContent>
      <TabsContent value="third">
        <p className="text-sm">Third tab content</p>
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Initially the first tab is active. Radix unmounts inactive TabsContent, so
    // inactive panels are asserted absent from the DOM (not merely hidden).
    await expect(canvas.getByText(/first tab content/i)).toBeVisible();
    await expect(canvas.queryByText(/second tab content/i)).not.toBeInTheDocument();
    // Click the second tab
    const secondTab = canvas.getByRole("tab", { name: /second/i });
    await userEvent.click(secondTab);
    await expect(canvas.getByText(/second tab content/i)).toBeVisible();
    await expect(canvas.queryByText(/first tab content/i)).not.toBeInTheDocument();
    // Keyboard: arrow to third (automatic activation selects on focus)
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByText(/third tab content/i)).toBeVisible();
  },
};
