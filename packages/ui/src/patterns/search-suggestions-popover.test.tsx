import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchSuggestionsPopover } from "./search-suggestions-popover";

/** Locates a Calendar day button by date — matches the `data-day` attribute the shared
 * `Calendar` primitive sets on each day (`day.date.toLocaleDateString()`). */
function findDayButton(date: Date): HTMLElement {
  const el = document.querySelector(`[data-day="${date.toLocaleDateString()}"]`);
  if (!el) throw new Error(`day button not found for ${date.toDateString()}`);
  return el as HTMLElement;
}

describe("SearchSuggestionsPopover", () => {
  it("calls onQueryChange with the typed text", () => {
    const onQueryChange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={onQueryChange}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ac" } });

    expect(onQueryChange).toHaveBeenLastCalledWith("ac");
  });

  it("renders search-term suggestions and calls onSelectSearchTermSuggestion when one is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
        ]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={onSelect}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByText("Acme Corp");
    await user.click(option);

    expect(onSelect).toHaveBeenCalledWith("title~prefix", "Acme Corp");
  });

  it("renders effective matches below search-term suggestions and calls onSelectEffectiveMatch when one is clicked", async () => {
    const user = userEvent.setup();
    const onSelectMatch = vi.fn();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
        ]}
        effectiveMatches={[{ id: "1", content: "Acme Corp Invoice" }]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={onSelectMatch}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const rows = await screen.findAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual(["Acme Corp", "Acme Corp Invoice"]);

    await user.click(screen.getByText("Acme Corp Invoice"));
    expect(onSelectMatch).toHaveBeenCalledWith("1");
  });

  it("shows the relation name alongside the attribute label for a relation-traversal suggestion", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          {
            propertyName: "vendor.name~prefix",
            value: "Acme Supplies",
            attributeLabel: "Name",
            relationLabel: "Vendor",
          },
        ]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Vendor: Name")).toBeInTheDocument();
  });

  it("groups interleaved search-term suggestions by attribute, each under its own header", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query="a"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
          { propertyName: "status", value: "active", attributeLabel: "Status" },
          { propertyName: "title~prefix", value: "Acme Industries", attributeLabel: "Title" },
        ]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    // Grouped by attribute — both "Title" values sit together under one "Title" header,
    // even though "status" was interleaved between them in the raw suggestion list. There is
    // exactly one "Title" header (not one per value) and it precedes both of its values, which
    // both precede the "Status" group that follows.
    const titleHeaders = await screen.findAllByText("Title");
    expect(titleHeaders).toHaveLength(1);
    const [titleHeader] = titleHeaders;
    const acmeCorp = screen.getByText("Acme Corp");
    const acmeIndustries = screen.getByText("Acme Industries");
    const statusHeader = screen.getByText("Status");
    const activeValue = screen.getByText("active");

    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(titleHeader, acmeCorp)).toBe(true);
    expect(precedes(acmeCorp, acmeIndustries)).toBe(true);
    expect(precedes(acmeIndustries, statusHeader)).toBe(true);
    expect(precedes(statusHeader, activeValue)).toBe(true);
  });

  it("does not open the popover when there are no suggestions or matches", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("selects the active item on Enter after navigating with the arrow keys", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
          { propertyName: "title~prefix", value: "Acme Industries", attributeLabel: "Title" },
        ]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={onSelect}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith("title~prefix", "Acme Industries");
  });

  it("calls onSubmitQuery on Enter when no suggestion is highlighted", async () => {
    const user = userEvent.setup();
    const onSubmitQuery = vi.fn();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[
          { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
        ]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        onSubmitQuery={onSubmitQuery}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Enter}");

    expect(onSubmitQuery).toHaveBeenCalledOnce();
  });

  it("shows a loading indicator instead of the list while isLoading is true", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        isLoading
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
  });

  it("shows a distinct error state with a retry action when isError is true, never the empty-results message", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        isError
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Couldn't load suggestions.")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows a 'no matches' state when nothing matched and there is no error or loading in flight", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query="ac"
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("does not show the relation-search toggle when onRelationSearchChange is omitted", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[{ value: "name,asc", label: "Name A→Z" }]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await screen.findByText("Sort");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the relation-search toggle next to the Sort chip and calls onRelationSearchChange when flipped", async () => {
    const user = userEvent.setup();
    const onRelationSearchChange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[{ value: "name,asc", label: "Name A→Z" }]}
        relationSearchEnabled={false}
        onRelationSearchChange={onRelationSearchChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const sortChip = await screen.findByText("Sort");
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    // "next to the Sort chip" — both sit in the same row.
    expect(sortChip.parentElement).toBe(toggle.closest("label")?.parentElement);

    await user.click(toggle);
    expect(onRelationSearchChange).toHaveBeenCalledWith(true);
  });

  it("shows an unset boolean shortcut with a neutral pill and cycles to true on click", async () => {
    const user = userEvent.setup();
    const onBooleanShortcutChange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        booleanShortcuts={[{ attributeGroupKey: "active", label: "Active" }]}
        onBooleanShortcutChange={onBooleanShortcutChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");

    await user.click(chip);
    expect(onBooleanShortcutChange).toHaveBeenCalledWith("active", true);
  });

  it("shows a false boolean shortcut as a plain chip with only the border colored, same shape as the other chips", async () => {
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[{ value: "name,asc", label: "Name A→Z" }]}
        booleanShortcuts={[{ attributeGroupKey: "active", label: "Active", value: false }]}
        onBooleanShortcutChange={vi.fn()}
      />,
    );

    await userEvent.setup().click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");

    // Only the border carries color — the chip itself is shaped exactly like the other chips
    // (Sort/date/relation-toggle), not a filled StatusPill badge.
    expect(chip).toHaveClass("rounded-full", "border", "px-2", "py-0.5", "text-xs");
    expect(chip).toHaveClass("border-destructive");
    expect(chip).not.toHaveClass("bg-[rgba(179,38,30,0.08)]");
    // The icon is still there.
    expect(chip.querySelector("svg")).toBeInTheDocument();
  });

  it("shows a true boolean shortcut with a green border", async () => {
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        booleanShortcuts={[{ attributeGroupKey: "active", label: "Active", value: true }]}
        onBooleanShortcutChange={vi.fn()}
      />,
    );

    await userEvent.setup().click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");

    expect(chip).toHaveClass("border-green-500");
  });

  it("shows an unset boolean shortcut with the default neutral border (no color override)", async () => {
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        booleanShortcuts={[{ attributeGroupKey: "active", label: "Active" }]}
        onBooleanShortcutChange={vi.fn()}
      />,
    );

    await userEvent.setup().click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");

    expect(chip).not.toHaveClass("border-green-500");
    expect(chip).not.toHaveClass("border-destructive");
  });

  it("cycles a boolean shortcut true → false → unset across successive clicks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function ControlledBooleanShortcut() {
      const [value, setValue] = useState<boolean | undefined>(true);
      function handleChange(attributeGroupKey: string, next: boolean | undefined) {
        onChange(attributeGroupKey, next);
        setValue(next);
      }
      return (
        <SearchSuggestionsPopover
          query=""
          onQueryChange={vi.fn()}
          searchTermSuggestions={[]}
          effectiveMatches={[]}
          onSelectSearchTermSuggestion={vi.fn()}
          onSelectEffectiveMatch={vi.fn()}
          booleanShortcuts={[{ attributeGroupKey: "active", label: "Active", value }]}
          onBooleanShortcutChange={handleChange}
        />
      );
    }

    render(<ControlledBooleanShortcut />);

    await user.click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");

    await user.click(chip);
    expect(onChange).toHaveBeenNthCalledWith(1, "active", false);

    await user.click(chip);
    expect(onChange).toHaveBeenNthCalledWith(2, "active", undefined);
  });

  it("opens on focus to show a Sort chip even with an empty query, without expanding the sort options", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[
          { value: "name,asc", label: "Name A→Z" },
          { value: "name,desc", label: "Name Z→A" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Sort")).toBeInTheDocument();
    expect(screen.queryByText("Name A→Z")).not.toBeInTheDocument();
  });

  it("expands the sort options panel when the Sort chip is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[
          { value: "name,asc", label: "Name A→Z" },
          { value: "name,desc", label: "Name Z→A" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Sort"));

    expect(await screen.findByText("Name A→Z")).toBeInTheDocument();
    expect(screen.getByText("Name Z→A")).toBeInTheDocument();
  });

  it("calls onSortChange with the picked option's value, and clears it when the active option is picked again", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        sortOptions={[{ value: "name,asc", label: "Name A→Z" }]}
        currentSort="name,asc"
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Sort: Name A→Z"));
    await user.click(await screen.findByText("Name A→Z"));

    expect(onSortChange).toHaveBeenCalledWith(undefined);
  });

  it("opens on focus to show a chip per date attribute even with an empty query, without expanding its config", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Created")).toBeInTheDocument();
    expect(screen.queryByText("Last week")).not.toBeInTheDocument();
  });

  it("shows a distinct border on a date chip that already has an applied range, even while collapsed", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[
          { attributeGroupKey: "created_date", label: "Created", hasActiveRange: true },
          { attributeGroupKey: "due_date", label: "Due" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Created")).toHaveClass("border-blue-500");
    expect(screen.getByText("Due")).not.toHaveClass("border-blue-500");
  });

  it("expands a date attribute's config panel when its chip is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));

    expect(await screen.findByText("Last week")).toBeInTheDocument();
  });

  it("moves the calendar's selection when a preset button is clicked, without applying immediately", async () => {
    const user = userEvent.setup();
    const onApplyDateRange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
        onApplyDateRange={onApplyDateRange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await user.click(await screen.findByText("Last week"));

    expect(onApplyDateRange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApplyDateRange).toHaveBeenCalledOnce();
    const [attributeGroupKey, from, to] = onApplyDateRange.mock.calls[0];
    expect(attributeGroupKey).toBe("created_date");
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 1);
  });

  it("calls onApplyDateRange with both dates when a range is picked directly on the calendar", async () => {
    const user = userEvent.setup();
    const onApplyDateRange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
        onApplyDateRange={onApplyDateRange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await screen.findByText("Last week");

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 2);
    await user.click(findDayButton(from));
    await user.click(findDayButton(to));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApplyDateRange).toHaveBeenCalledWith("created_date", from, to);
  });

  it("does not call onApplyDateRange when no range has been selected on the calendar yet", async () => {
    const user = userEvent.setup();
    const onApplyDateRange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
        onApplyDateRange={onApplyDateRange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await screen.findByText("Last week");

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApplyDateRange).not.toHaveBeenCalled();
  });

  it("resets the calendar's selection when Clear is clicked, so Apply then does nothing", async () => {
    const user = userEvent.setup();
    const onApplyDateRange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[{ attributeGroupKey: "created_date", label: "Created" }]}
        onApplyDateRange={onApplyDateRange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await screen.findByText("Last week");

    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), 1);
    await user.click(findDayButton(day));
    expect(findDayButton(day)).toHaveAttribute("data-range-start", "true");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(findDayButton(day)).not.toHaveAttribute("data-range-start");

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApplyDateRange).not.toHaveBeenCalled();
  });

  it("calls onClearDateRange with the attribute when Clear is clicked, to remove any already-applied filter", async () => {
    const user = userEvent.setup();
    const onClearDateRange = vi.fn();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[
          { attributeGroupKey: "created_date", label: "Created", hasActiveRange: true },
        ]}
        onClearDateRange={onClearDateRange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(onClearDateRange).toHaveBeenCalledWith("created_date");
  });

  it("only expands one date attribute's config panel at a time, with independent calendar state per chip", async () => {
    const user = userEvent.setup();
    render(
      <SearchSuggestionsPopover
        query=""
        onQueryChange={vi.fn()}
        searchTermSuggestions={[]}
        effectiveMatches={[]}
        onSelectSearchTermSuggestion={vi.fn()}
        onSelectEffectiveMatch={vi.fn()}
        dateShortcuts={[
          { attributeGroupKey: "created_date", label: "Created" },
          { attributeGroupKey: "due_date", label: "Due" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await screen.findByText("Last week");

    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), 1);
    await user.click(findDayButton(day));
    expect(findDayButton(day)).toHaveAttribute("data-range-start", "true");

    await user.click(screen.getByText("Due"));

    expect(findDayButton(day)).not.toHaveAttribute("data-range-start");
  });
});
