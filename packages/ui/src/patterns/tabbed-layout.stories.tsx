import * as React from "react";
import { DatabaseIcon, InvoiceIcon, UsersIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { TabLink } from "../primitives/tab-bar";
import { TabbedLayout } from "./tabbed-layout";

const meta = {
  title: "Patterns/TabbedLayout",
  component: TabbedLayout,
  args: {
    tabs: [],
    renderTabLink: () => null,
  },
} satisfies Meta<typeof TabbedLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In app code `renderTabLink` wraps the caller's router `Link` (e.g. TanStack
 * Router) in `asChild` — the story below stands in with plain anchors.
 */
function RoutedLayoutDemo() {
  const [active, setActive] = React.useState("overview");
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <TabbedLayout
      tabs={tabs.map((tab) => ({ ...tab, active: tab.key === active }))}
      renderTabLink={(tab, label) => (
        <TabLink
          key={tab.key}
          href="#"
          active={tab.active}
          onClick={(event) => {
            event.preventDefault();
            setActive(tab.key);
          }}
        >
          {label}
        </TabLink>
      )}
    >
      <p className="text-sm text-muted-foreground">Content for “{active}”.</p>
    </TabbedLayout>
  );
}

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <RoutedLayoutDemo />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="w-96">
      <TabbedLayout
        orientation="vertical"
        tabs={[
          { key: "profile", label: "Profile", active: true },
          { key: "billing", label: "Billing" },
          { key: "team", label: "Team" },
        ]}
        renderTabLink={(tab, label) => (
          <TabLink key={tab.key} href="#" active={tab.active}>
            {label}
          </TabLink>
        )}
      >
        <p className="text-sm text-muted-foreground">Profile settings.</p>
      </TabbedLayout>
    </div>
  ),
};

function IconLayoutDemo() {
  const [active, setActive] = React.useState("invoices");
  const tabs = [
    {
      key: "invoices",
      label: "Invoices",
      icon: <InvoiceIcon aria-hidden />,
      iconColor: "oklch(0.55 0.17 155)",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      icon: <UsersIcon aria-hidden />,
      iconColor: "oklch(0.6 0.2 30)",
    },
    {
      key: "products",
      label: "Products",
      icon: <DatabaseIcon aria-hidden />,
      iconColor: "oklch(0.55 0.2 260)",
    },
  ];

  return (
    <TabbedLayout
      tabs={tabs.map((tab) => ({ ...tab, active: tab.key === active }))}
      renderTabLink={(tab, label) => (
        <TabLink
          key={tab.key}
          href="#"
          active={tab.active}
          icon={tab.icon}
          iconColor={tab.iconColor}
          onClick={(event) => {
            event.preventDefault();
            setActive(tab.key);
          }}
        >
          {label}
        </TabLink>
      )}
    >
      <p className="text-sm text-muted-foreground">Content for “{active}”.</p>
    </TabbedLayout>
  );
}

export const WithIcons: Story = {
  render: () => (
    <div className="w-96">
      <IconLayoutDemo />
    </div>
  ),
};

function VerticalIconLayoutDemo() {
  const [active, setActive] = React.useState("invoices");
  const tabs = [
    {
      key: "invoices",
      label: "Invoices",
      icon: <InvoiceIcon aria-hidden />,
      iconColor: "oklch(0.55 0.17 155)",
    },
    {
      key: "suppliers",
      label: "Suppliers",
      icon: <UsersIcon aria-hidden />,
      iconColor: "oklch(0.6 0.2 30)",
    },
    {
      key: "products",
      label: "Products",
      icon: <DatabaseIcon aria-hidden />,
      iconColor: "oklch(0.55 0.2 260)",
    },
  ];

  return (
    <TabbedLayout
      orientation="vertical"
      tabs={tabs.map((tab) => ({ ...tab, active: tab.key === active }))}
      renderTabLink={(tab, label) => (
        <TabLink
          key={tab.key}
          href="#"
          active={tab.active}
          icon={tab.icon}
          iconColor={tab.iconColor}
          onClick={(event) => {
            event.preventDefault();
            setActive(tab.key);
          }}
        >
          {label}
        </TabLink>
      )}
    >
      <p className="text-sm text-muted-foreground">Content for “{active}”.</p>
    </TabbedLayout>
  );
}

export const VerticalWithIcons: Story = {
  render: () => (
    <div className="w-96">
      <VerticalIconLayoutDemo />
    </div>
  ),
};
