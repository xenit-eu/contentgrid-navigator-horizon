import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeSearchBarProfiles,
  searchBarHandlers,
} from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { server } from "../../test-setup";
import { EntitySearchBar } from "./entity-search-bar";
import { makeSearchBarWrapper } from "./test-utils";

const { searchBar } = makeSearchBarProfiles();

function renderBar(filters: Record<string, string> = {}, actions?: ReactNode) {
  const onFiltersChange = vi.fn();
  const Wrapper = makeSearchBarWrapper();
  render(
    <Wrapper>
      <EntitySearchBar
        profileEntity={searchBar}
        filters={filters}
        onFiltersChange={onFiltersChange}
        actions={actions}
      />
    </Wrapper>,
  );
  return { onFiltersChange };
}

const quickFilters = () => screen.getByRole("toolbar", { name: "Quick filters" });
const toneOf = (button: HTMLElement) =>
  button.closest("[data-slot='filter-button']")?.getAttribute("data-tone");

describe("EntitySearchBar", () => {
  beforeEach(() => {
    server.use(...searchBarHandlers());
  });

  it("renders the three rows: chips, selector + input, quick filters", () => {
    renderBar({ "title~prefix": "Al" });
    expect(screen.getByRole("list", { name: "Active filters" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search in" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search" })).toBeInTheDocument();
    expect(quickFilters()).toBeInTheDocument();
  });

  it("takes no space for the chip row when nothing is filtered", () => {
    renderBar();
    expect(screen.queryByRole("list", { name: "Active filters" })).not.toBeInTheDocument();
  });

  it("shows a filter set elsewhere (e.g. the advanced dialog) as an active quick filter with an ×", async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar({ "received_at~after": "2026-10-01T00:00:00.000Z" });

    const receivedAt = within(quickFilters()).getByRole("button", { name: "Received at" });
    expect(toneOf(receivedAt)).toBe("active");

    await user.click(
      within(quickFilters()).getByRole("button", { name: "Clear Received at filter" }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith({});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    [{ "quantity~gte": "3" }, "Quantity"],
    [{ status: "approved" }, "Status: approved"],
  ])("marks the quick filter active for %j", (filters, name) => {
    renderBar(filters);
    expect(toneOf(within(quickFilters()).getByRole("button", { name }))).toBe("active");
  });

  it("keeps the boolean quick filter's green / red tone instead of blue", () => {
    renderBar({ urgent: "false" });
    expect(toneOf(within(quickFilters()).getByRole("button", { name: /Urgent: false/ }))).toBe(
      "negative",
    );
  });

  it("removes a filter at once when its chip is closed", async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar({ "title~prefix": "Al", urgent: "true" });
    await user.click(screen.getByRole("button", { name: "Remove filter Title starts with Al" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ urgent: "true" });
  });

  it("closes a range chip by clearing both bounds", async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar({
      "quantity~gte": "3",
      "quantity~lte": "9",
      urgent: "true",
    });
    await user.click(screen.getByRole("button", { name: /Remove filter Quantity between/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({ urgent: "true" });
  });

  it("applies a suggestion picked from the popover", async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderBar();
    await user.type(screen.getByRole("combobox", { name: "Search" }), "Al");
    const option = await screen.findByRole("option", { name: "Alpha invoice" }, { timeout: 3000 });
    await user.click(option);
    await waitFor(() =>
      expect(onFiltersChange).toHaveBeenCalledWith({ "title~prefix": "Alpha invoice" }),
    );
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("");
  });

  it("puts the page's actions right of the quick filters, outside the scrolling toolbar", () => {
    renderBar({}, <button type="button">Columns</button>);
    const columns = screen.getByRole("button", { name: "Columns" });
    expect(
      within(quickFilters()).queryByRole("button", { name: "Columns" }),
    ).not.toBeInTheDocument();
    expect(quickFilters()).toHaveClass("overflow-x-auto");
    expect(columns.closest("[data-slot='quick-filter-row']")).toBe(
      quickFilters().closest("[data-slot='quick-filter-row']"),
    );
  });
});
