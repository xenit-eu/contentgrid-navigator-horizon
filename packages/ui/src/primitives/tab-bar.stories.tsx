import * as React from "react";
import { DatabaseIcon, InvoiceIcon, UsersIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { TabBar, TabContent, TabLink } from "./tab-bar";

const meta = {
  title: "Primitives/TabBar",
  component: TabBar,
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

function LinkTabsDemo() {
  const [active, setActive] = React.useState("overview");
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="w-96">
      <TabBar>
        {tabs.map((tab) => (
          <TabLink
            key={tab.key}
            href="#"
            active={active === tab.key}
            onClick={(event) => {
              event.preventDefault();
              setActive(tab.key);
            }}
          >
            {tab.label}
          </TabLink>
        ))}
      </TabBar>
      <TabContent>
        <p className="text-sm text-muted-foreground">Content for “{active}”.</p>
      </TabContent>
    </div>
  );
}

export const Default: Story = {
  render: () => <LinkTabsDemo />,
};

function IconTabsDemo() {
  const [active, setActive] = React.useState("invoices");
  const tabs = [
    {
      key: "invoices",
      label: "Invoices",
      icon: <InvoiceIcon aria-hidden />,
      color: "oklch(0.55 0.17 155)",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      icon: <UsersIcon aria-hidden />,
      color: "oklch(0.6 0.2 30)",
    },
    {
      key: "products",
      label: "Products",
      icon: <DatabaseIcon aria-hidden />,
      color: "oklch(0.55 0.2 260)",
    },
  ];

  return (
    <TabBar>
      {tabs.map((tab) => (
        <TabLink
          key={tab.key}
          href="#"
          active={active === tab.key}
          icon={tab.icon}
          iconColor={tab.color}
          onClick={(event) => {
            event.preventDefault();
            setActive(tab.key);
          }}
        >
          {tab.label}
        </TabLink>
      ))}
    </TabBar>
  );
}

export const WithIcons: Story = {
  render: () => (
    <div className="w-96">
      <IconTabsDemo />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex w-96 gap-4">
      <TabBar orientation="vertical" className="w-40">
        <TabLink href="#" active>
          Profile
        </TabLink>
        <TabLink href="#">Billing</TabLink>
        <TabLink href="#">Team</TabLink>
      </TabBar>
      <TabContent className="pt-0">
        <p className="text-sm text-muted-foreground">Profile settings.</p>
      </TabContent>
    </div>
  ),
};

function VerticalIconTabsDemo() {
  const [active, setActive] = React.useState("invoices");
  const tabs = [
    {
      key: "invoices",
      label: "Invoices",
      icon: <InvoiceIcon aria-hidden />,
      color: "oklch(0.55 0.17 155)",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      icon: <UsersIcon aria-hidden />,
      color: "oklch(0.6 0.2 30)",
    },
    {
      key: "products",
      label: "Products",
      icon: <DatabaseIcon aria-hidden />,
      color: "oklch(0.55 0.2 260)",
    },
  ];

  return (
    <div className="flex w-96 gap-4">
      <TabBar orientation="vertical" className="w-40">
        {tabs.map((tab) => (
          <TabLink
            key={tab.key}
            href="#"
            active={active === tab.key}
            icon={tab.icon}
            iconColor={tab.color}
            onClick={(event) => {
              event.preventDefault();
              setActive(tab.key);
            }}
          >
            {tab.label}
          </TabLink>
        ))}
      </TabBar>
      <TabContent className="pt-0">
        <p className="text-sm text-muted-foreground">Content for “{active}”.</p>
      </TabContent>
    </div>
  );
}

export const VerticalWithIcons: Story = {
  render: () => <VerticalIconTabsDemo />,
};
