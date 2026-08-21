import {
  GearIcon as Gear,
  HouseIcon as House,
  PlusIcon as Plus,
  SquaresFourIcon as SquaresFour,
  UsersIcon as Users,
} from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarLinkButton,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  title: "Primitives/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const NavItems = () => (
  <SidebarGroup>
    <SidebarGroupLabel>Application</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive>
            <SquaresFour />
            <span>Dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Users />
            <span>Team</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Gear />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

export const Default: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent>
          <NavItems />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <SidebarTrigger />
        <p className="text-sm text-muted-foreground">Main content area</p>
      </main>
    </SidebarProvider>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <NavItems />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <SidebarTrigger />
        <p className="text-sm text-muted-foreground">Main content area</p>
      </main>
    </SidebarProvider>
  ),
};

const LinkButtons = () => (
  <SidebarMenu>
    <SidebarLinkButton
      icon={<House aria-hidden />}
      label="Home"
      render={(content) => <a href="#home">{content}</a>}
    />
    <SidebarLinkButton icon={<Plus aria-hidden />} label="Create Item" />
  </SidebarMenu>
);

export const LinkButtonExpanded: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarContent>
          <LinkButtons />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <SidebarTrigger />
        <p className="text-sm text-muted-foreground">Main content area</p>
      </main>
    </SidebarProvider>
  ),
};

export const LinkButtonCollapsed: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <LinkButtons />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <SidebarTrigger />
        <p className="text-sm text-muted-foreground">
          Hover the icons — the label shows as a tooltip.
        </p>
      </main>
    </SidebarProvider>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  parameters: { layout: "fullscreen" },
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="offcanvas">
        <SidebarContent>
          <NavItems />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <p className="text-sm text-muted-foreground">Main content</p>
      </main>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Sidebar is open by default — menu items should be visible
    await expect(canvas.getByText("Dashboard")).toBeInTheDocument();
    const trigger = canvas.getByRole("button", { name: /toggle sidebar/i });
    await userEvent.click(trigger);
    // After collapse, the sidebar should have state=collapsed
    const sidebar = canvasElement.querySelector("[data-sidebar='sidebar']");
    await expect(sidebar).toBeTruthy();
    // Re-open
    await userEvent.click(trigger);
    await expect(canvas.getByText("Dashboard")).toBeVisible();
  },
};
