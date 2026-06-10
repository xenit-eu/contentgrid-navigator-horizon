import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { RelationSection } from "./relation-section";

const meta = {
  title: "Patterns/RelationSection",
  component: RelationSection,
  tags: ["autodocs"],
} satisfies Meta<typeof RelationSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const SUPPLIER_ITEMS = [{ id: "4a1b", data: { name: "Northwind Logistics", country: "Belgium" } }];

const INVOICE_ITEMS = [
  { id: "inv-1", data: { reference: "INV-2026-04812", amount: "24800", issue_date: "2026-05-14" } },
  {
    id: "inv-2",
    data: { reference: "INV-2026-04811", amount: "9412.5", issue_date: "2026-05-09" },
  },
  { id: "inv-3", data: { reference: "INV-2026-04790", amount: "18200", issue_date: "2026-05-02" } },
];

// ---------------------------------------------------------------------------
// To-one (isManyToOne)
// ---------------------------------------------------------------------------

/** To-one relation — single item in accordion (PAGE 03 side-panel style). */
export const ToOne: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: SUPPLIER_ITEMS,
    onViewItem: fn(),
    onUnlink: fn(),
  },
};

export const ToOneEmpty: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: [],
    onLink: fn(),
  },
};

export const ToOneLoading: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    isLoading: true,
  },
};

export const ToOneError: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    error: new Error("Network error"),
  },
};

// ---------------------------------------------------------------------------
// To-many (default)
// ---------------------------------------------------------------------------

/** To-many relation — item list with "View all" affordance (PAGE 04 style). */
export const ToMany: Story = {
  args: {
    title: "Invoices",
    items: INVOICE_ITEMS,
    totalCount: 42,
    onViewItem: fn(),
    onViewAll: fn(),
    onUnlink: fn(),
  },
};

/** To-many without a "View all" handler — no affordance rendered. */
export const ToManyNoViewAll: Story = {
  args: {
    title: "Contracts",
    items: [
      { id: "c1", data: { reference: "CTR-2026-001", status: "active" } },
      { id: "c2", data: { reference: "CTR-2026-002", status: "active" } },
    ],
    onViewItem: fn(),
  },
};

export const ToManyEmpty: Story = {
  args: {
    title: "Invoices",
    items: [],
    onLink: fn(),
  },
};

export const ToManyLoading: Story = {
  args: {
    title: "Invoices",
    isLoading: true,
  },
};

export const ToManyError: Story = {
  args: {
    title: "Invoices",
    error: new Error("Network error"),
  },
};

/** Five or more items — all shown up to MAX_VISIBLE_ITEMS (5). */
export const ToManyManyItems: Story = {
  args: {
    title: "Line items",
    items: [
      { id: "li-1", data: { product: "Widget A", qty: 10 } },
      { id: "li-2", data: { product: "Widget B", qty: 5 } },
      { id: "li-3", data: { product: "Gadget C", qty: 2 } },
      { id: "li-4", data: { product: "Part D", qty: 20 } },
      { id: "li-5", data: { product: "Component E", qty: 1 } },
    ],
    totalCount: 12,
    onViewItem: fn(),
    onViewAll: fn(),
  },
};

/** Boolean field rendered as badge in meta line. */
export const WithBooleanField: Story = {
  args: {
    title: "Suppliers",
    items: [
      { id: "s1", data: { name: "Apex Components", active: true } },
      { id: "s2", data: { name: "Lumen & Co.", active: false } },
    ],
    onViewItem: fn(),
  },
};

// ---------------------------------------------------------------------------
// Interaction tests
// ---------------------------------------------------------------------------

export const UnlinkInteraction: Story = {
  // axe-no-contrast: confirmation dialog portal composites into axe background calc.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    title: "Invoices",
    items: INVOICE_ITEMS,
    onViewItem: fn(),
    onUnlink: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const unlinkButtons = canvas.getAllByRole("button", { name: /unlink/i });
    await expect(unlinkButtons.length).toBeGreaterThan(0);
    await userEvent.click(unlinkButtons[0]);

    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    const confirmBtn = within(dialog!).getByRole("button", { name: /^unlink$/i });
    await userEvent.click(confirmBtn);
    await expect(args.onUnlink).toHaveBeenCalledWith("inv-1");
  },
};

export const ToOneUnlinkInteraction: Story = {
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: SUPPLIER_ITEMS,
    onViewItem: fn(),
    onUnlink: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const unlinkBtn = canvas.getByRole("button", { name: /unlink/i });
    await userEvent.click(unlinkBtn);

    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    const confirmBtn = within(dialog!).getByRole("button", { name: /^unlink$/i });
    await userEvent.click(confirmBtn);
    await expect(args.onUnlink).toHaveBeenCalledWith("4a1b");
  },
};

export const ViewAllInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    title: "Invoices",
    items: INVOICE_ITEMS,
    totalCount: 42,
    onViewItem: fn(),
    onViewAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewAllBtn = canvas.getByRole("button", { name: /view all/i });
    await userEvent.click(viewAllBtn);
    await expect(args.onViewAll).toHaveBeenCalled();
  },
};
