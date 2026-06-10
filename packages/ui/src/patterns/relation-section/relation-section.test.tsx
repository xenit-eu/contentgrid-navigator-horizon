import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationSection } from "./relation-section";
import type { RelationItem } from "./relation-section";

const ITEMS: RelationItem[] = [
  { id: "1", data: { name: "Alpha", code: "A1" } },
  { id: "2", data: { name: "Beta", code: "B2" } },
];

function renderRelation(overrides: Partial<Parameters<typeof RelationSection>[0]> = {}) {
  return render(<RelationSection title="Invoices" {...overrides} />);
}

// ---------------------------------------------------------------------------
// Accordion shell (shared by both to-one and to-many)
// ---------------------------------------------------------------------------
describe("RelationSection — accordion shell", () => {
  it("renders the relation title", () => {
    renderRelation({ items: ITEMS });
    expect(screen.getAllByText(/Invoices/i)[0]).toBeInTheDocument();
  });

  it("shows · to-many label for default (many) layout", () => {
    renderRelation({ items: ITEMS });
    expect(screen.getByText(/· to-many/i)).toBeInTheDocument();
  });

  it("shows · to-one label when isManyToOne=true", () => {
    renderRelation({ isManyToOne: true, items: ITEMS });
    expect(screen.getByText(/· to-one/i)).toBeInTheDocument();
  });

  it("renders item count in header", () => {
    renderRelation({ items: ITEMS });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders totalCount in header when provided", () => {
    renderRelation({ items: ITEMS, totalCount: 42 });
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders loading skeleton when isLoading is true", () => {
    const { container } = renderRelation({ isLoading: true });
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("renders error message when error is set", () => {
    renderRelation({ error: new Error("oops") });
    expect(screen.getByText("Failed to load relation data.")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Item list layout
// ---------------------------------------------------------------------------
describe("RelationSection — item list", () => {
  it("renders item primary labels", () => {
    renderRelation({ items: ITEMS });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders a secondary meta line for items with multiple fields", () => {
    renderRelation({
      items: [{ id: "1", data: { name: "Alpha", code: "A1" } }],
    });
    // "A1" should appear as the meta (secondary field after name)
    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("falls back to item.id as label when all displayable fields are null", () => {
    renderRelation({
      items: [{ id: "id-only-123", data: { name: null, code: null } }],
    });
    // id appears in both the name div and meta div (both fall back to id)
    expect(screen.getAllByText("id-only-123").length).toBeGreaterThan(0);
  });

  it("shows up to 5 items and hides the rest", () => {
    const sixItems = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      data: { name: `Item ${i}` },
    }));
    renderRelation({ items: sixItems, onViewAll: vi.fn() });
    // Only 5 items rendered
    expect(screen.getAllByText(/^Item \d$/).length).toBe(5);
  });

  it("does not render a table element", () => {
    const { container } = renderRelation({ items: ITEMS });
    expect(container.querySelector("table")).toBeNull();
  });

  it("calls onViewItem when a row is clicked", async () => {
    const user = userEvent.setup();
    const onViewItem = vi.fn();
    renderRelation({ items: ITEMS, onViewItem });
    await user.click(screen.getByText("Alpha"));
    expect(onViewItem).toHaveBeenCalledWith("1");
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
describe("RelationSection — empty state", () => {
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
});

// ---------------------------------------------------------------------------
// View all affordance
// ---------------------------------------------------------------------------
describe("RelationSection — view all", () => {
  it("shows View all affordance when onViewAll is provided and items exist", () => {
    renderRelation({ items: ITEMS, totalCount: 42, onViewAll: vi.fn() });
    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  it("View all label includes totalCount and title", () => {
    renderRelation({ items: ITEMS, totalCount: 42, onViewAll: vi.fn() });
    expect(screen.getByRole("button", { name: /view all 42 invoices/i })).toBeInTheDocument();
  });

  it("calls onViewAll when View all is clicked", async () => {
    const user = userEvent.setup();
    const onViewAll = vi.fn();
    renderRelation({ items: ITEMS, totalCount: 42, onViewAll });
    await user.click(screen.getByRole("button", { name: /view all/i }));
    expect(onViewAll).toHaveBeenCalled();
  });

  it("does not show View all affordance when onViewAll is absent", () => {
    renderRelation({ items: ITEMS, totalCount: 42 });
    expect(screen.queryByRole("button", { name: /view all/i })).not.toBeInTheDocument();
  });

  it("does not show View all for to-one layout", () => {
    renderRelation({ isManyToOne: true, items: ITEMS, totalCount: 42, onViewAll: vi.fn() });
    expect(screen.queryByRole("button", { name: /view all/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Link / Change button (when items are loaded)
// ---------------------------------------------------------------------------
describe("RelationSection — link button with items", () => {
  it("shows Link button in header area when items loaded and onLink provided (to-many)", () => {
    renderRelation({ items: ITEMS, onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("shows Change button for to-one when items loaded and onLink provided", () => {
    renderRelation({ isManyToOne: true, items: [ITEMS[0]], onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
  });

  it("calls onLink when Link button is clicked", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ items: ITEMS, onLink });
    await user.click(screen.getByRole("button", { name: /link invoices/i }));
    expect(onLink).toHaveBeenCalled();
  });

  it("calls onLink when Change button is clicked", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    renderRelation({ isManyToOne: true, items: [ITEMS[0]], onLink });
    await user.click(screen.getByRole("button", { name: /change/i }));
    expect(onLink).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unlink flow
// ---------------------------------------------------------------------------
describe("RelationSection — unlink flow", () => {
  it("renders unlink buttons when onUnlink is provided", () => {
    renderRelation({ items: ITEMS, onUnlink: vi.fn() });
    expect(screen.getAllByRole("button", { name: /unlink/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("clicking unlink button opens the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderRelation({ items: ITEMS, onUnlink: vi.fn() });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    expect(screen.getByText(/unlink invoices/i)).toBeInTheDocument();
  });

  it("confirms unlink and calls onUnlink with item id", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderRelation({ items: ITEMS, onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onUnlink).toHaveBeenCalledWith("1");
  });

  it("cancels unlink dialog without calling onUnlink", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    renderRelation({ items: ITEMS, onUnlink });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("shows 'Unlinking...' text when isUnlinking is true", async () => {
    const user = userEvent.setup();
    renderRelation({ items: ITEMS, onUnlink: vi.fn(), isUnlinking: true });
    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    expect(screen.getByRole("button", { name: "Unlinking..." })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Label derivation
// ---------------------------------------------------------------------------
describe("RelationSection — getItemLabel", () => {
  it("uses item.id as label when all displayable data fields are null", () => {
    const itemWithNullFields: RelationItem = {
      id: "id-only-123",
      data: { name: null, code: null },
    };
    renderRelation({ items: [itemWithNullFields] });
    // id appears in both the name and meta divs when all fields are null
    expect(screen.getAllByText("id-only-123").length).toBeGreaterThan(0);
  });

  it("skips fields starting with _ in label resolution", () => {
    renderRelation({
      items: [{ id: "1", data: { _internal: "skip", name: "ShowMe" } }],
    });
    expect(screen.getByText("ShowMe")).toBeInTheDocument();
    expect(screen.queryByText("skip")).not.toBeInTheDocument();
  });
});
