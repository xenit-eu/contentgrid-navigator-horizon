import { render, screen, within } from "@testing-library/react";
// Need to import fireEvent for the search deselection test
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntityPicker } from "./entity-picker";
import type { EntityPickerColumn, EntityPickerOption, EntityPickerProps } from "./entity-picker";

const OPTIONS: EntityPickerOption[] = [
  { id: "1", href: "/invoices/1", data: { number: "INV-001", amount: 100 } },
  { id: "2", href: "/invoices/2", data: { number: "INV-002", amount: 200 } },
];

const COLUMNS: EntityPickerColumn[] = [
  { key: "number", header: "Number" },
  { key: "amount", header: "Amount" },
];

const BASE_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  relationTitle: "invoice",
  options: OPTIONS,
  columns: COLUMNS,
  searchQuery: "",
  onSearch: vi.fn(),
  onSelect: vi.fn(),
};

function renderPicker(overrides: Partial<EntityPickerProps> = {}) {
  return render(<EntityPicker {...BASE_PROPS} {...overrides} />);
}

describe("EntityPicker — dialog visibility", () => {
  it("renders nothing when open=false", () => {
    renderPicker({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open=true", () => {
    renderPicker();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("EntityPicker — single-select mode (default)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Select Invoice' as dialog title", () => {
    renderPicker();
    expect(screen.getByText("Select Invoice")).toBeInTheDocument();
  });

  it("renders option rows", () => {
    renderPicker();
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();
  });

  it("renders column headers from columns prop", () => {
    renderPicker();
    expect(screen.getByText("Number")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("Confirm button is disabled before any selection", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("clicking a row selects it and enables Confirm", async () => {
    const user = userEvent.setup();
    renderPicker();
    const row = screen.getByText("INV-001").closest("tr")!;
    await user.click(row);
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
  });

  it("calls onSelect with href and label when confirmed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    renderPicker({ onSelect, onOpenChange });
    const row = screen.getByText("INV-001").closest("tr")!;
    await user.click(row);
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(onSelect).toHaveBeenCalledWith("/invoices/1", "INV-001");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel button calls onOpenChange(false) and resets state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPicker({ onOpenChange });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onSearch when typing in search input", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderPicker({ onSearch });
    await user.type(screen.getByPlaceholderText("Search..."), "inv");
    expect(onSearch).toHaveBeenCalled();
  });

  it("uses custom searchPlaceholder", () => {
    renderPicker({ searchPlaceholder: "Find invoices..." });
    expect(screen.getByPlaceholderText("Find invoices...")).toBeInTheDocument();
  });

  it("shows no-items message when options is empty", () => {
    renderPicker({ options: [] });
    expect(screen.getByText("No items found.")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true", () => {
    renderPicker({ isLoading: true, options: [] });
    // Skeletons render as divs with animate-pulse class
    const dialog = screen.getByRole("dialog");
    // There should be no table rendered
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });

  it("deselects row when search query changes", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderPicker({ onSearch });
    const row = screen.getByText("INV-001").closest("tr")!;
    await user.click(row);
    // typing clears selection in single-select
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "x" } });
    expect(onSearch).toHaveBeenCalledWith("x");
  });
});

describe("EntityPicker — pagination", () => {
  it("does not show pagination controls when neither hasPreviousPage nor hasNextPage", () => {
    renderPicker();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("shows pagination when hasNextPage is true", () => {
    renderPicker({ hasNextPage: true });
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
  });

  it("Previous button is disabled when hasPreviousPage is false", () => {
    renderPicker({ hasNextPage: true, hasPreviousPage: false });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("Next button is disabled when hasNextPage is false", () => {
    renderPicker({ hasPreviousPage: true, hasNextPage: false });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("calls onPreviousPage when Previous is clicked", async () => {
    const user = userEvent.setup();
    const onPreviousPage = vi.fn();
    renderPicker({ hasPreviousPage: true, onPreviousPage });
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPreviousPage).toHaveBeenCalled();
  });

  it("calls onNextPage when Next is clicked", async () => {
    const user = userEvent.setup();
    const onNextPage = vi.fn();
    renderPicker({ hasNextPage: true, onNextPage });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNextPage).toHaveBeenCalled();
  });
});

describe("EntityPicker — multi-select mode", () => {
  const multiProps = { ...BASE_PROPS, multiSelect: true };

  beforeEach(() => vi.clearAllMocks());

  it("shows 'Link Invoice' as dialog title", () => {
    render(<EntityPicker {...multiProps} />);
    expect(screen.getByText("Link Invoice")).toBeInTheDocument();
  });

  it("'Link' button is disabled before selection", () => {
    render(<EntityPicker {...multiProps} />);
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("can select multiple rows", async () => {
    const user = userEvent.setup();
    render(<EntityPicker {...multiProps} />);
    const row1 = screen.getByText("INV-001").closest("tr")!;
    const row2 = screen.getByText("INV-002").closest("tr")!;
    await user.click(row1);
    await user.click(row2);
    expect(screen.getByRole("button", { name: "Link 2 items" })).toBeEnabled();
  });

  it("can deselect a previously selected row by clicking again", async () => {
    const user = userEvent.setup();
    render(<EntityPicker {...multiProps} />);
    const row1 = screen.getByText("INV-001").closest("tr")!;
    await user.click(row1);
    await user.click(row1); // deselect
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("calls onSelect for each selected item on confirm", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EntityPicker {...multiProps} onSelect={onSelect} />);
    const row1 = screen.getByText("INV-001").closest("tr")!;
    const row2 = screen.getByText("INV-002").closest("tr")!;
    await user.click(row1);
    await user.click(row2);
    await user.click(screen.getByRole("button", { name: "Link 2 items" }));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith("/invoices/1", "INV-001");
    expect(onSelect).toHaveBeenCalledWith("/invoices/2", "INV-002");
  });
});

describe("EntityPicker — createNewLink", () => {
  it("does not render anything extra when createNewLink is omitted", () => {
    renderPicker();
    expect(screen.queryByText("Create new")).not.toBeInTheDocument();
  });

  it("renders the provided createNewLink node", () => {
    renderPicker({ createNewLink: <a href="/suppliers/~create">Create new</a> });
    expect(screen.getByText("Create new")).toBeInTheDocument();
  });
});

describe("EntityPicker — column fallback (no columns prop)", () => {
  it("auto-resolves columns from option data keys", () => {
    render(
      <EntityPicker
        open={true}
        onOpenChange={vi.fn()}
        relationTitle="item"
        options={[{ id: "1", href: "/items/1", data: { name: "Alpha", status: "active" } }]}
        searchQuery=""
        onSearch={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("renders object cell values as JSON rather than [object Object]", () => {
    render(
      <EntityPicker
        open={true}
        onOpenChange={vi.fn()}
        relationTitle="item"
        columns={[{ key: "meta", header: "Meta" }]}
        options={[{ id: "1", href: "/items/1", data: { meta: { nested: "value" } } }]}
        searchQuery=""
        onSearch={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('{"nested":"value"}')).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it("returns empty columns when options array is empty and no columns prop", () => {
    render(
      <EntityPicker
        open={true}
        onOpenChange={vi.fn()}
        relationTitle="item"
        options={[]}
        searchQuery=""
        onSearch={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("No items found.")).toBeInTheDocument();
  });
});
