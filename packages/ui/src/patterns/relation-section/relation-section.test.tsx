import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationSection } from "./relation-section";
import type { RelationColumn, RelationItem } from "./relation-section";

const ITEMS: RelationItem[] = [
  { id: "1", data: { name: "Alpha", code: "A1" } },
  { id: "2", data: { name: "Beta", code: "B2" } },
];

const COLUMNS: RelationColumn[] = [
  { key: "name", title: "Name" },
  { key: "code", title: "Code" },
];

function renderRelation(overrides: Partial<Parameters<typeof RelationSection>[0]> = {}) {
  return render(<RelationSection title="Invoices" {...overrides} />);
}

// ---------------------------------------------------------------------------
// Many-to-many layout (default)
// ---------------------------------------------------------------------------
describe("RelationSection — many-to-many layout (default)", () => {
  it("renders the title", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS });
    expect(screen.getAllByText("Invoices")[0]).toBeInTheDocument();
  });

  it("renders item count badge", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS });
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
  });

  it("renders row data", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders '—' for null data values", () => {
    renderRelation({
      items: [{ id: "1", data: { name: null, code: undefined } }],
      columns: COLUMNS,
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders object cell values as JSON rather than [object Object]", () => {
    renderRelation({
      items: [{ id: "1", data: { name: "Alpha", code: { x: 1 } } }],
      columns: COLUMNS,
    });
    expect(screen.getByText('{"x":1}')).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it("renders empty state when items is empty", () => {
    renderRelation({ items: [] });
    expect(screen.getByText("No invoices linked")).toBeInTheDocument();
  });

  it("shows Link button in empty state when onLink is provided", () => {
    renderRelation({ items: [], onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("calls onLink when Link button is clicked in empty state", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ items: [], onLink });
    await user.click(screen.getByRole("button", { name: /link invoices/i }));
    expect(onLink).toHaveBeenCalled();
  });

  it("does not show Link button in empty state when onLink is absent", () => {
    renderRelation({ items: [] });
    expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
  });

  it("renders loading skeleton when isLoading is true", () => {
    const { container } = renderRelation({ isLoading: true });
    // Skeletons are div elements with animate-pulse
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("renders error message when error is set", () => {
    renderRelation({ error: new Error("oops") });
    expect(screen.getByText("Failed to load relation data.")).toBeInTheDocument();
  });

  it("shows Link button in header when items are loaded and onLink is provided", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS, onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("calls onLink when header Link button is clicked", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ items: ITEMS, columns: COLUMNS, onLink });
    await user.click(screen.getByRole("button", { name: /link invoices/i }));
    expect(onLink).toHaveBeenCalled();
  });

  it("calls onViewItem when a row is clicked", async () => {
    const user = userEvent.setup();
    const onViewItem = vi.fn();
    renderRelation({ items: ITEMS, columns: COLUMNS, onViewItem });
    await user.click(screen.getByText("Alpha"));
    expect(onViewItem).toHaveBeenCalledWith("1");
  });

  it("renders unlink buttons when onUnlink is provided", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS, onUnlink: vi.fn() });
    expect(screen.getAllByRole("button", { name: /unlink/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("clicking unlink button opens the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderRelation({ items: ITEMS, columns: COLUMNS, onUnlink: vi.fn() });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    expect(screen.getByText(/unlink invoices/i)).toBeInTheDocument();
  });

  it("confirms unlink and calls onUnlink with item id", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderRelation({ items: ITEMS, columns: COLUMNS, onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onUnlink).toHaveBeenCalledWith("1");
  });

  it("cancels unlink dialog without calling onUnlink", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderRelation({ items: ITEMS, columns: COLUMNS, onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("shows 'Unlinking...' text when isUnlinking is true", async () => {
    const user = userEvent.setup();
    renderRelation({ items: ITEMS, columns: COLUMNS, onUnlink: vi.fn(), isUnlinking: true });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    expect(screen.getByRole("button", { name: "Unlinking..." })).toBeDisabled();
  });

  it("auto-resolves column keys from data when no columns prop provided", () => {
    renderRelation({ items: ITEMS });
    // Should render the data values even without explicit columns
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("filters out keys starting with _ and 'id' in auto-resolved columns", () => {
    renderRelation({
      items: [{ id: "1", data: { _internal: "skip", id: "skip", name: "ShowMe" } }],
    });
    expect(screen.getByText("ShowMe")).toBeInTheDocument();
    expect(screen.queryByText("skip")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Many-to-one layout
// ---------------------------------------------------------------------------
describe("RelationSection — many-to-one layout (isManyToOne=true)", () => {
  it("renders title in card header", () => {
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS });
    expect(screen.getAllByText("Invoices")[0]).toBeInTheDocument();
  });

  it("renders item data in compact card layout", () => {
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("renders empty state when no items", () => {
    renderRelation({ isManyToOne: true, items: [] });
    expect(screen.getByText("No invoices linked")).toBeInTheDocument();
  });

  it("shows Link button in empty state when onLink is provided", () => {
    renderRelation({ isManyToOne: true, items: [], onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("calls onLink from empty state", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ isManyToOne: true, items: [], onLink });
    await user.click(screen.getByRole("button", { name: /link invoices/i }));
    expect(onLink).toHaveBeenCalled();
  });

  it("shows Change button when items are loaded and onLink is provided", () => {
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS, onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
  });

  it("calls onLink when Change button is clicked", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS, onLink });
    await user.click(screen.getByRole("button", { name: /change/i }));
    expect(onLink).toHaveBeenCalled();
  });

  it("renders loading skeleton when isLoading is true", () => {
    const { container } = renderRelation({ isManyToOne: true, isLoading: true });
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("renders error message when error is set", () => {
    renderRelation({ isManyToOne: true, error: new Error("fail") });
    expect(screen.getByText("Failed to load relation data.")).toBeInTheDocument();
  });

  it("calls onViewItem when View details icon is clicked", async () => {
    const user = userEvent.setup();
    const onViewItem = vi.fn();
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS, onViewItem });
    await user.click(screen.getAllByRole("button", { name: /view details/i })[0]);
    expect(onViewItem).toHaveBeenCalledWith("1");
  });

  it("opens unlink confirmation dialog from compact card", async () => {
    const user = userEvent.setup();
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS, onUnlink: vi.fn() });
    await user.click(screen.getAllByRole("button", { name: /unlink/i })[0]);
    expect(screen.getByText(/unlink invoices/i)).toBeInTheDocument();
  });

  it("confirms unlink in compact card and calls onUnlink", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderRelation({ isManyToOne: true, items: ITEMS, columns: COLUMNS, onUnlink });
    await user.click(screen.getAllByRole("button", { name: /unlink/i })[0]);
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onUnlink).toHaveBeenCalledWith("1");
  });

  it("renders attribute details in compact card", () => {
    renderRelation({
      isManyToOne: true,
      items: [{ id: "1", data: { name: "Alpha", code: "A1" } }],
      columns: COLUMNS,
    });
    expect(screen.getByText(/Name: Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Code: A1/)).toBeInTheDocument();
  });
});

describe("RelationSection — column title resolution", () => {
  it("resolves column titles from columns prop", () => {
    renderRelation({ items: ITEMS, columns: COLUMNS });
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("falls back to title-casing the key when columns is not provided", () => {
    renderRelation({ items: [{ id: "1", data: { my_field: "value" } }] });
    expect(screen.getByText("My Field")).toBeInTheDocument();
  });

  it("filters columns prop keys that are not in item data", () => {
    renderRelation({
      items: [{ id: "1", data: { name: "Alpha" } }],
      columns: [
        { key: "name", title: "Name" },
        { key: "nonexistent", title: "Should Not Show" },
      ],
    });
    expect(screen.queryByText("Should Not Show")).not.toBeInTheDocument();
  });
});
