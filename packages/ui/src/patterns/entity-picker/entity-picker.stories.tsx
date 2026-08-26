import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EntityPicker } from "./entity-picker";

const meta = {
  title: "Patterns/EntityPicker",
  component: EntityPicker,
  tags: ["autodocs"],
} satisfies Meta<typeof EntityPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS = [
  { id: "1", href: "/suppliers/1", data: { name: "Acme Corp", city: "Amsterdam" } },
  { id: "2", href: "/suppliers/2", data: { name: "Globex Inc", city: "Rotterdam" } },
  { id: "3", href: "/suppliers/3", data: { name: "Initech", city: "Utrecht" } },
];

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "city", header: "City" },
];

export const Default: Story = {
  // Open-portal story: scrim composites into axe background calc (false positives).
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: OPTIONS,
    columns: COLUMNS,
    searchQuery: "",
    onSearch: fn(),
    onSelect: fn(),
  },
};

export const Loading: Story = {
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: [],
    columns: COLUMNS,
    isLoading: true,
    searchQuery: "",
    onSearch: fn(),
    onSelect: fn(),
  },
};

export const Empty: Story = {
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: [],
    columns: COLUMNS,
    searchQuery: "unknown",
    onSearch: fn(),
    onSelect: fn(),
  },
};

export const WithPagination: Story = {
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: OPTIONS,
    columns: COLUMNS,
    searchQuery: "",
    onSearch: fn(),
    hasPreviousPage: false,
    hasNextPage: true,
    onPreviousPage: fn(),
    onNextPage: fn(),
    onSelect: fn(),
  },
};

export const MultiSelect: Story = {
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: OPTIONS,
    columns: COLUMNS,
    multiSelect: true,
    searchQuery: "",
    onSearch: fn(),
    onSelect: fn(),
  },
};

export const WithCreateNewLink: Story = {
  tags: ["axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: [],
    columns: COLUMNS,
    searchQuery: "unknown",
    onSearch: fn(),
    onSelect: fn(),
    createNewLink: (
      <a href="/suppliers/~create" target="_blank" rel="noopener noreferrer">
        Create new
      </a>
    ),
  },
};

export const WithInteraction: Story = {
  // axe-no-contrast: open dialog portal composites into axe background calc.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: OPTIONS,
    columns: COLUMNS,
    searchQuery: "",
    onSearch: fn(),
    onSelect: fn(),
  },
  play: async ({ args }) => {
    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("dialog");
      expect(dialog).toBeVisible();
    });

    // Select a row and confirm
    const rows = within(dialog!).getAllByRole("row");
    // First row is the header; click second row (index 1)
    await userEvent.click(rows[1]);

    const confirmBtn = within(dialog!).getByRole("button", { name: /^select$/i });
    await expect(confirmBtn).not.toBeDisabled();
    await userEvent.click(confirmBtn);
    await expect(args.onSelect).toHaveBeenCalledWith(["/suppliers/1"]);
  },
};

export const MultiSelectWithInteraction: Story = {
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    open: true,
    onOpenChange: fn(),
    relationTitle: "Supplier",
    options: OPTIONS,
    columns: COLUMNS,
    multiSelect: true,
    searchQuery: "",
    onSearch: fn(),
    onSelect: fn(),
  },
  play: async ({ args }) => {
    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("dialog");
      expect(dialog).toBeVisible();
    });

    const rows = within(dialog!).getAllByRole("row");
    // Select first two data rows
    await userEvent.click(rows[1]);
    await userEvent.click(rows[2]);

    const confirmBtn = within(dialog!).getByRole("button", { name: /link 2 items/i });
    await expect(confirmBtn).not.toBeDisabled();
    await userEvent.click(confirmBtn);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith(["/suppliers/1", "/suppliers/2"]);
  },
};
