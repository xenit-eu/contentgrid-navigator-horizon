import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { EntityPicker } from "./entity-picker";
import type { EntityPickerColumn, EntityPickerOption } from "./entity-picker";

const meta = {
  title: "Patterns/EntityPicker",
  component: EntityPicker,
} satisfies Meta<typeof EntityPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS: EntityPickerOption[] = [
  { id: "1", href: "/invoices/1", data: { number: "INV-001", amount: 1250, status: "open" } },
  { id: "2", href: "/invoices/2", data: { number: "INV-002", amount: 890, status: "paid" } },
  { id: "3", href: "/invoices/3", data: { number: "INV-003", amount: 3400, status: "overdue" } },
];

const COLUMNS: EntityPickerColumn[] = [
  { key: "number", header: "Number" },
  { key: "amount", header: "Amount (€)" },
  { key: "status", header: "Status" },
];

/** Wrapper that holds dialog open state so the picker is fully interactive. */
const PickerDemo = ({
  multiSelect = false,
  hasNextPage = false,
  hasPreviousPage = false,
  isLoading = false,
  emptyOptions = false,
}: {
  multiSelect?: boolean;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  isLoading?: boolean;
  emptyOptions?: boolean;
}) => {
  const [open, setOpen] = React.useState(true);
  const [search, setSearch] = React.useState("");

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open picker
      </Button>
    );
  }

  return (
    <EntityPicker
      open={open}
      onOpenChange={setOpen}
      relationTitle="invoice"
      options={emptyOptions ? [] : OPTIONS}
      columns={COLUMNS}
      isLoading={isLoading}
      searchQuery={search}
      onSearch={setSearch}
      multiSelect={multiSelect}
      hasNextPage={hasNextPage}
      hasPreviousPage={hasPreviousPage}
      onSelect={() => setOpen(false)}
    />
  );
};

export const Default: Story = {
  render: () => <PickerDemo />,
};

export const MultiSelect: Story = {
  render: () => <PickerDemo multiSelect />,
};

export const Loading: Story = {
  render: () => <PickerDemo isLoading />,
};

export const Empty: Story = {
  render: () => <PickerDemo emptyOptions />,
};

export const WithPagination: Story = {
  render: () => <PickerDemo hasNextPage hasPreviousPage />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <PickerDemo />,
  play: async ({ canvasElement }) => {
    const dialog = within(document.body).getByRole("dialog");
    await expect(within(dialog).getByText("Select Invoice")).toBeInTheDocument();
    await expect(within(dialog).getByText("INV-001")).toBeInTheDocument();
    const selectBtn = within(dialog).getByRole("button", { name: "Select" });
    await expect(selectBtn).toBeDisabled();
    const row = within(dialog).getByText("INV-001").closest("tr")!;
    await userEvent.click(row);
    await expect(selectBtn).toBeEnabled();
    // Search box is present
    const searchInput = within(dialog).getByPlaceholderText("Search...");
    await expect(searchInput).toBeInTheDocument();
    void canvasElement;
  },
};
