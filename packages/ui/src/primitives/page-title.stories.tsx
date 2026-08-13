import type { Meta, StoryObj } from "@storybook/react";
import { PageTitle } from "./page-title";

const meta = {
  title: "Primitives/PageTitle",
  component: PageTitle,
} satisfies Meta<typeof PageTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <PageTitle header="Entity Collection" title="Invoices" subtitle="200 items" />,
};

export const WithLongSubtitle: Story = {
  render: () => (
    <PageTitle
      header="Entity Collection"
      title="Purchase Orders"
      subtitle="45 items • Last updated 2 hours ago"
    />
  ),
};

export const WithDifferentEntity: Story = {
  render: () => <PageTitle header="Entity Collection" title="Customers" subtitle="1,234 items" />,
};
