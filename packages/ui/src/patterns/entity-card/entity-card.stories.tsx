import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { EntityCard } from "./entity-card";

const meta = {
  title: "Patterns/EntityCard",
  component: EntityCard,
} satisfies Meta<typeof EntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <EntityCard
        name="invoice"
        title="Invoice"
        count={42}
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="w-64">
      <EntityCard
        name="supplier"
        title="Supplier"
        count={8}
        description="Companies that supply goods and services to the organisation."
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const WithContent: Story = {
  render: () => (
    <div className="w-64">
      <EntityCard
        name="document"
        title="Document"
        count={123}
        description="Uploaded files and attachments."
        hasContent
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const NoCount: Story = {
  render: () => (
    <div className="w-64">
      <EntityCard
        name="category"
        title="Category"
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const ZeroCount: Story = {
  render: () => (
    <div className="w-64">
      <EntityCard
        name="tag"
        title="Tag"
        count={0}
        description="Labels applied to items."
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[48rem]">
      <EntityCard
        name="invoice"
        title="Invoice"
        count={42}
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
      <EntityCard
        name="supplier"
        title="Supplier"
        count={8}
        description="Goods and service providers."
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
      <EntityCard
        name="document"
        title="Document"
        count={123}
        hasContent
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
      <EntityCard
        name="category"
        title="Category"
        count={0}
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
      <EntityCard
        name="product"
        title="Product"
        count={57}
        description="Catalogue items."
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
      <EntityCard
        name="order"
        title="Order"
        count={14}
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="w-64">
      <EntityCard
        name="invoice"
        title="Invoice"
        count={42}
        onTitleClick={() => {}}
        onCreateClick={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Invoice")).toBeInTheDocument();
    await expect(canvas.getByText("42")).toBeInTheDocument();
    await expect(canvas.getByText("items")).toBeInTheDocument();
    const createBtn = canvas.getByRole("button", { name: /create invoice/i });
    await expect(createBtn).toBeInTheDocument();
    await userEvent.click(createBtn);
  },
};
