import {
  BuildingsIcon as Buildings,
  FileTextIcon as FileText,
  GearIcon as Gear,
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
import { ThemeProvider } from "../../primitives/theme-provider";
import { PhoneMenuAccount } from "./phone-menu-account";
import { PhoneMenuHeader } from "./phone-menu-header";

const meta = {
  title: "Patterns/PhoneMenu",
  component: PhoneMenuHeader,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { parameters }) => (
      <ThemeProvider defaultTheme="light" forcedTheme={parameters.forcedTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof PhoneMenuHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const entities = [
  { name: "Invoices", count: "1 284", Icon: FileText, active: true },
  { name: "Contracts", count: "412", Icon: FileText },
  { name: "Suppliers", count: "87", Icon: Buildings },
];

const DrawerAccount = ({ settingsCurrent = false }: { settingsCurrent?: boolean }) => (
  <PhoneMenuAccount name="Sam Peeters" email="sam.peeters@example.com" onLogOut={() => {}}>
    <SidebarLinkButton
      icon={<Gear aria-hidden className="text-muted-foreground" />}
      label="Settings"
      isActive={settingsCurrent}
      aria-current={settingsCurrent ? "page" : undefined}
    />
  </PhoneMenuAccount>
);

/**
 * The navigation drawer on a phone. Tagged `mobile`, so the visual and accessibility specs render
 * it in a 390×844 viewport, where `Sidebar` switches to its sheet; `defaultOpenMobile` opens it.
 * Tagged `axe-no-contrast` because the brand's "content" is set in sky on white (3.1:1); WCAG 1.4.3
 * exempts logotypes. The account block has its own contrast-checked stories.
 */
export const PhoneDrawer: Story = {
  tags: ["mobile", "axe-no-contrast"],
  render: () => <Drawer />,
};

/** The same drawer in dark mode: the lockup takes the page header's white and accent colours. */
export const PhoneDrawerDark: Story = {
  tags: ["mobile"],
  parameters: { forcedTheme: "dark" },
  render: () => <Drawer />,
};

const Drawer = () => (
  <SidebarProvider defaultOpenMobile>
    <Sidebar collapsible="icon" mobileHeader={<PhoneMenuHeader />} mobileFooter={<DrawerAccount />}>
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
);

/** The drawer's footer on its own, at the drawer's width (300px). */
export const AccountBlock: Story = {
  parameters: { layout: "centered" },
  render: () => (
    <SidebarProvider>
      <div className="bg-sidebar w-[300px]">
        <DrawerAccount />
      </div>
    </SidebarProvider>
  ),
};

export const AccountBlockSettingsCurrent: Story = {
  parameters: { layout: "centered" },
  render: () => (
    <SidebarProvider>
      <div className="bg-sidebar w-[300px]">
        <DrawerAccount settingsCurrent />
      </div>
    </SidebarProvider>
  ),
};
