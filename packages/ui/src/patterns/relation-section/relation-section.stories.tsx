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

const ITEMS = [
  { id: "1", data: { name: "Acme Corp", city: "Amsterdam" } },
  { id: "2", data: { name: "Globex Inc", city: "Rotterdam" } },
];

const COLUMNS = [
  { key: "name", title: "Name" },
  { key: "city", title: "City" },
];

// Many-to-many (collapsible table) layout

export const ManyToMany: Story = {
  args: {
    title: "Suppliers",
    items: ITEMS,
    columns: COLUMNS,
    onLink: fn(),
    onUnlink: fn(),
    onViewItem: fn(),
  },
};

export const ManyToManyLoading: Story = {
  args: {
    title: "Suppliers",
    isLoading: true,
    columns: COLUMNS,
  },
};

export const ManyToManyEmpty: Story = {
  args: {
    title: "Suppliers",
    items: [],
    columns: COLUMNS,
    onLink: fn(),
  },
};

export const ManyToManyError: Story = {
  args: {
    title: "Suppliers",
    items: undefined,
    error: new Error("Network error"),
    columns: COLUMNS,
  },
};

// Many-to-one (compact card) layout

export const ManyToOne: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: [ITEMS[0]],
    columns: COLUMNS,
    onLink: fn(),
    onUnlink: fn(),
    onViewItem: fn(),
  },
};

export const ManyToOneEmpty: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: [],
    columns: COLUMNS,
    onLink: fn(),
  },
};

export const ManyToOneLoading: Story = {
  args: {
    title: "Supplier",
    isManyToOne: true,
    isLoading: true,
    columns: COLUMNS,
  },
};

// Interaction tests

export const UnlinkInteraction: Story = {
  // axe-no-contrast: confirmation dialog portal composites into axe background calc.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    title: "Suppliers",
    items: ITEMS,
    columns: COLUMNS,
    onLink: fn(),
    onUnlink: fn(),
    onViewItem: fn(),
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
    await expect(args.onUnlink).toHaveBeenCalledWith("1");
  },
};

export const ManyToOneUnlinkInteraction: Story = {
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    title: "Supplier",
    isManyToOne: true,
    items: [ITEMS[0]],
    columns: COLUMNS,
    onLink: fn(),
    onUnlink: fn(),
    onViewItem: fn(),
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
    await expect(args.onUnlink).toHaveBeenCalledWith("1");
  },
};
