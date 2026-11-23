import {
  BuildingsIcon as Buildings,
  FileTextIcon as FileText,
  HouseIcon as House,
  PlusIcon as Plus,
  StackIcon as Stack,
} from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
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
  SidebarProvider,
} from "../../primitives/sidebar";
import { PhoneMenuHeader } from "./phone-menu-header";

const meta = {
  title: "Patterns/PhoneMenu",
  component: PhoneMenuHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PhoneMenuHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const entities = [
  { name: "Invoices", count: "1 284", Icon: FileText, active: true },
  { name: "Contracts", count: "412", Icon: FileText },
  { name: "Suppliers", count: "87", Icon: Buildings },
];

/**
 * The navigation drawer on a phone. Tagged `mobile`, so the visual and accessibility specs render
 * it in a 390×844 viewport, where `Sidebar` switches to its sheet; `defaultOpenMobile` opens it.
 * Tagged `axe-no-contrast` because the reference design sets the brand's "grid" in sky on white
 * (3.1:1); WCAG 1.4.3 exempts logotypes. The account block has its own contrast-checked stories.
 */
export const PhoneDrawer: Story = {
  tags: ["mobile", "axe-no-contrast"],
  render: () => (
    <SidebarProvider defaultOpenMobile>
      <Sidebar collapsible="icon" mobileHeader={<PhoneMenuHeader />}>
        <SidebarContent>
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              <SidebarLinkButton icon={<Plus aria-hidden />} label="Create" variant="primary" />
              <SidebarLinkButton icon={<House aria-hidden />} label="Home" />
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel icon={<Stack aria-hidden />}>Entities</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {entities.map(({ name, count, Icon, active }) => (
                  <SidebarMenuItem key={name}>
                    <SidebarMenuButton isActive={active}>
                      <Icon aria-hidden />
                      <span>{name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <main className="flex-1" />
    </SidebarProvider>
  ),
};
