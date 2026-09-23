import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DataTable } from "./data-table";

const meta = {
  title: "Patterns/DataTable",
  component: DataTable,
  tags: ["autodocs"],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { key: "number", header: "Number", sortable: true },
  { key: "supplier", header: "Supplier" },
  { key: "amount", header: "Amount", sortable: true },
];

const ROWS = [
  { id: "1", data: { number: "INV-001", supplier: "Acme Corp", amount: "1,200.00" } },
  { id: "2", data: { number: "INV-002", supplier: "Globex Inc", amount: "850.00" } },
  { id: "3", data: { number: "INV-003", supplier: "Initech", amount: "3,400.00" } },
];

export const Default: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
  },
};

export const WithActions: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    onViewDetails: fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const WithSort: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    currentSort: "number,asc",
    onSort: fn(),
    sortOptions: [
      { value: "number,asc", property: "number", prompt: "Sort by Number ascending" },
      { value: "number,desc", property: "number", prompt: "Sort by Number descending" },
      { value: "amount,asc", property: "amount", prompt: "Sort by Amount ascending" },
      { value: "amount,desc", property: "amount", prompt: "Sort by Amount descending" },
    ],
  },
};

export const Empty: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: [],
    onCreateClick: fn(),
  },
};

export const WithRowClick: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    onRowClick: fn(),
  },
};

export const WithInteraction: Story = {
  // axe-no-contrast: row action menu opens a portal; scrim composites into axe background calc.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    onViewDetails: fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Open the action menu for the first row
    const menuButtons = canvas.getAllByRole("button", { name: /open menu/i });
    await userEvent.click(menuButtons[0]);

    let menu: HTMLElement;
    await waitFor(() => {
      menu = within(document.body).getByRole("menu");
      expect(menu).toBeVisible();
    });

    const viewItem = within(menu!).getByRole("menuitem", { name: /view details/i });
    await userEvent.click(viewItem);
    await expect(args.onViewDetails).toHaveBeenCalledWith("1");
  },
};

export const DeleteConfirmation: Story = {
  // axe-no-contrast: confirmation dialog opens a portal.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const menuButtons = canvas.getAllByRole("button", { name: /open menu/i });
    await userEvent.click(menuButtons[0]);

    let menu: HTMLElement;
    await waitFor(() => {
      menu = within(document.body).getByRole("menu");
      expect(menu).toBeVisible();
    });

    const deleteItem = within(menu!).getByRole("menuitem", { name: /delete/i });
    await userEvent.click(deleteItem);

    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    const confirmBtn = within(dialog!).getByRole("button", { name: /^delete$/i });
    await userEvent.click(confirmBtn);
    await expect(args.onDelete).toHaveBeenCalledWith("1");
  },
};

export const WithSelection: Story = {
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    selectedIds: new Set(["2"]),
    onSelectionChange: fn(),
  },
};

export const ScrollableWithManyColumns: Story = {
  // Demonstrates `containerClassName`: height-capping and scrolling the table's own wrapper (not
  // an ancestor) keeps the horizontal scrollbar reachable at the bottom of the visible rows even
  // when there are many more rows than fit — see that prop's doc comment for why an ancestor
  // wrapper alone can't do this.
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: [
      ...COLUMNS,
      { key: "date", header: "Date" },
      { key: "notes", header: "Notes" },
      { key: "reference", header: "Reference" },
    ],
    rows: Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      data: {
        number: `INV-${String(i + 1).padStart(3, "0")}`,
        supplier: `Supplier ${i + 1}`,
        amount: `${(i + 1) * 100}.00`,
        date: "2026-01-01",
        notes: "A fairly long free-text note that helps push this table wider than its container.",
        reference: `REF-${i + 1}`,
      },
    })),
    containerClassName: "max-h-64 overflow-auto",
  },
};

export const UnlinkConfirmation: Story = {
  // axe-no-contrast: confirmation dialog opens a portal.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    entityName: "invoice",
    entityTitle: "Invoices",
    columns: COLUMNS,
    rows: ROWS,
    onUnlink: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const unlinkButtons = canvas.getAllByRole("button", { name: /unlink/i });
    await userEvent.click(unlinkButtons[0]);

    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    const confirmBtn = within(dialog!).getByRole("button", { name: /^unlink$/i });
    await userEvent.click(confirmBtn);
    await expect(args.onUnlink).toHaveBeenCalledWith("1");
  },
};
