import {
  BuildingsIcon as Buildings,
  FileTextIcon as FileText,
  GearIcon as Gear,
  HouseIcon as House,
  PlusIcon as Plus,
  SquaresFourIcon as SquaresFour,
  StackIcon as Stack,
  UsersIcon as Users,
} from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { formatCount } from "../lib/format-count";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarLinkButton,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "./sidebar";
import { Skeleton } from "./skeleton";

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
    <SidebarLinkButton icon={<Plus aria-hidden />} label="Create" />
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
        <SidebarTrigger />
        <p className="text-sm text-muted-foreground">Main content</p>
      </main>
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Sidebar is open by default — menu items should be visible
    await expect(canvas.getByText("Dashboard")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /collapse sidebar/i }));
    // After collapse, the sidebar should have state=collapsed
    const sidebar = canvasElement.querySelector("[data-sidebar='sidebar']");
    await expect(sidebar).toBeTruthy();
    // Re-open
    await userEvent.click(canvas.getByRole("button", { name: /expand sidebar/i }));
    await expect(canvas.getByText("Dashboard")).toBeVisible();
  },
};

// The reference design's rows: 36px, 14px text, muted tabular counts, the active row in a sky tint
// with an ocean bar, entity icons in their own colours.
const entityRows = [
  { name: "Invoices", count: "1 284", color: "#0a6aa1", Icon: FileText, active: true },
  { name: "Contracts", count: "412", color: "#b85b1f", Icon: FileText },
  { name: "Framework agreement annexes", count: "9", color: "#5a6b8c", Icon: Buildings },
];

const EntityRows = () => (
  <>
    <SidebarGroup className="pb-0">
      <SidebarMenu>
        <SidebarLinkButton icon={<Plus aria-hidden />} label="Create" variant="primary" />
        <SidebarLinkButton icon={<House aria-hidden />} label="Home" />
      </SidebarMenu>
    </SidebarGroup>
    <SidebarGroup className="pt-0">
      <SidebarSeparator className="mx-auto my-1 hidden w-7 group-data-[collapsible=icon]:block" />
      <SidebarGroupLabel icon={<Stack aria-hidden />}>Entities</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {entityRows.map(({ name, count, color, Icon, active }) => (
            <SidebarMenuItem key={name}>
              <SidebarMenuButton isActive={active} tooltip={name}>
                <Icon aria-hidden style={{ color }} />
                <span>{name}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{count}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </>
);

export const EntityRowsExpanded: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" style={{ top: 0 }}>
        <SidebarContent>
          <EntityRows />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4" />
    </SidebarProvider>
  ),
};

export const EntityRowsCollapsed: Story = {
  render: () => (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon" style={{ top: 0 }}>
        <SidebarContent>
          <EntityRows />
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4" />
    </SidebarProvider>
  ),
};

// Count states: exact, estimated, zero, loading (a skeleton pill) and unknown (nothing at all).
export const CountStates: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" style={{ top: 0 }}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {[
                { label: "Exact", count: formatCount({ count: 412, isEstimated: false }) },
                { label: "Thousands", count: formatCount({ count: 1284, isEstimated: false }) },
                { label: "Estimated", count: formatCount({ count: 1204, isEstimated: true }) },
                { label: "Zero", count: formatCount({ count: 0, isEstimated: false }) },
                { label: "Loading", count: null },
                { label: "Unknown or not allowed", count: undefined },
              ].map(({ label, count }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton>
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {count === null ? (
                    <SidebarMenuBadge aria-hidden>
                      <Skeleton className="h-2.5 w-6.5 rounded-full" />
                    </SidebarMenuBadge>
                  ) : (
                    count !== undefined && <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4" />
    </SidebarProvider>
  ),
};

export const LoadingEntityList: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" style={{ top: 0 }}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {["70%", "55%", "64%"].map((width) => (
                <SidebarMenuItem key={width}>
                  <SidebarMenuSkeleton width={width} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex flex-1 flex-col gap-4 p-4" />
    </SidebarProvider>
  ),
};
