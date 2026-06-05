import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { RelationSection } from "./relation-section";
import type { RelationColumn, RelationItem } from "./relation-section";

const meta = {
  title: "Patterns/RelationSection",
  component: RelationSection,
} satisfies Meta<typeof RelationSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: RelationItem[] = [
  { id: "1", data: { name: "INV-2024-001", amount: 1250, status: "open" } },
  { id: "2", data: { name: "INV-2024-002", amount: 890, status: "paid" } },
  { id: "3", data: { name: "INV-2024-003", amount: 3400, status: "overdue" } },
];

const COLUMNS: RelationColumn[] = [
  { key: "name", title: "Number" },
  { key: "amount", title: "Amount (€)" },
  { key: "status", title: "Status" },
];

const SINGLE_ITEM: RelationItem[] = [
  { id: "10", data: { name: "Acme Corp", vat: "BE0123456789", country: "Belgium" } },
];

const SINGLE_COLUMNS: RelationColumn[] = [
  { key: "name", title: "Name" },
  { key: "vat", title: "VAT number" },
  { key: "country", title: "Country" },
];

// ---------------------------------------------------------------------------
// Many-to-many (collapsible table) — default layout
// ---------------------------------------------------------------------------

export const Default: Story = {
  render: () => (
    <div className="max-w-2xl">
      <RelationSection
        title="Invoices"
        items={ITEMS}
        columns={COLUMNS}
        onLink={() => {}}
        onUnlink={() => {}}
        onViewItem={() => {}}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="max-w-2xl">
      <RelationSection title="Invoices" items={[]} onLink={() => {}} />
    </div>
  ),
};

export const EmptyNoActions: Story = {
  render: () => (
    <div className="max-w-2xl">
      <RelationSection title="Invoices" items={[]} />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="max-w-2xl">
      <RelationSection title="Invoices" isLoading />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="max-w-2xl">
      <RelationSection title="Invoices" error={new Error("Network error")} />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Many-to-one (compact card) layout
// ---------------------------------------------------------------------------

export const ManyToOneWithItem: Story = {
  render: () => (
    <div className="max-w-sm">
      <RelationSection
        title="Supplier"
        isManyToOne
        items={SINGLE_ITEM}
        columns={SINGLE_COLUMNS}
        onLink={() => {}}
        onUnlink={() => {}}
        onViewItem={() => {}}
      />
    </div>
  ),
};

export const ManyToOneEmpty: Story = {
  render: () => (
    <div className="max-w-sm">
      <RelationSection title="Supplier" isManyToOne items={[]} onLink={() => {}} />
    </div>
  ),
};

export const ManyToOneLoading: Story = {
  render: () => (
    <div className="max-w-sm">
      <RelationSection title="Supplier" isManyToOne isLoading />
    </div>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <div className="max-w-2xl">
      <RelationSection
        title="Invoices"
        items={ITEMS}
        columns={COLUMNS}
        onLink={() => {}}
        onUnlink={() => {}}
        onViewItem={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Invoices")[0]).toBeInTheDocument();
    await expect(canvas.getByText("INV-2024-001")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
    const [firstUnlink] = canvas.getAllByRole("button", { name: /unlink/i });
    await userEvent.click(firstUnlink);
    await expect(within(document.body).getByText(/unlink invoices/i)).toBeInTheDocument();
    await userEvent.click(within(document.body).getByRole("button", { name: "Cancel" }));
  },
};
