import { DatabaseIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { IconBadge } from "./icon-badge";
import { PageTitle } from "./page-title";

const meta = {
  title: "Primitives/PageTitle",
  component: PageTitle,
} satisfies Meta<typeof PageTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    header: "Entity Collection",
    title: "Invoices",
    subtitle: "200 items",
  },
};

export const WithLongSubtitle: Story = {
  args: {
    header: "Entity Collection",
    title: "Purchase Orders",
    subtitle: "45 items • Last updated 2 hours ago",
  },
};

export const WithDifferentEntity: Story = {
  args: {
    header: "Entity Collection",
    title: "Customers",
    subtitle: "1,234 items",
  },
};

export const WithIcon: Story = {
  args: {
    header: "Entity Collection",
    title: "Invoices",
    subtitle: "200 items",
    icon: <IconBadge icon={<DatabaseIcon aria-hidden />} color="oklch(0.6 0.2 30)" />,
  },
};

export const Compact: Story = {
  args: {
    title: "Invoices",
    subtitle: "200 items",
    icon: <IconBadge variant="sm" icon={<DatabaseIcon aria-hidden />} color="oklch(0.6 0.2 30)" />,
    size: "compact",
  },
};

export const WithindentSubtitle: Story = {
  args: {
    header: "Entity Collection",
    title: "Invoices",
    subtitle: "200 items",
    icon: <IconBadge icon={<DatabaseIcon aria-hidden />} color="oklch(0.6 0.2 30)" />,
    indentSubtitle: true,
  },
};
