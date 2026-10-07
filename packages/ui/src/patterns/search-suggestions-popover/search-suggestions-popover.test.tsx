import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../../primitives/input";
import {
  SearchSuggestionsPopover,
  type SearchSuggestionsPopoverProps,
  type SuggestionChip,
  type SuggestionGroup,
} from "./search-suggestions-popover";

const chips: SuggestionChip[] = [
  { id: "title", label: "Title", count: { count: 12 } },
  { id: "reference", label: "Reference", count: { count: null } },
];

const groups: SuggestionGroup[] = [
  {
    id: "title",
    label: "Title",
    count: { count: 12, isEstimated: true },
    status: "ready",
    items: [
      { id: "Alpha", label: "Alpha" },
      { id: "Alpine", label: "Alpine" },
    ],
  },
  {
    id: "notes",
    label: "Notes",
    count: { count: 0 },
    status: "ready",
    items: [{ id: "Almost", label: "Almost" }],
  },
];

function Harness(props: Partial<SearchSuggestionsPopoverProps>) {
  const [open, setOpen] = useState(true);
  return (
    <SearchSuggestionsPopover
      open={open}
      onOpenChange={setOpen}
      chips={chips}
      groups={groups}
      onSelectChip={vi.fn()}
      onSelectItem={vi.fn()}
      renderAnchor={(comboboxProps) => <Input aria-label="Search" {...comboboxProps} />}
      {...props}
    />
  );
}

const region = () => screen.getByRole("region", { name: "Suggestions" });
const input = () => screen.getByRole("combobox", { name: "Search" });

describe("SearchSuggestionsPopover", () => {
  it("renders the chips with their counts and the groups with headers", () => {
    render(<Harness />);
    const chipRow = within(region()).getByRole("listbox", { name: "Search in" });
    expect(
      within(chipRow)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Title1212 results", "Reference?unknown number of results"]);
    const titleGroup = within(region()).getByRole("listbox", { name: /^Title/ });
    expect(
      within(titleGroup)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Alpha", "Alpine"]);
    expect(within(region()).getByText("12~")).toBeInTheDocument();
  });

  it("wires the input as a combobox controlling every listbox", () => {
    render(<Harness />);
    expect(input()).toHaveAttribute("aria-expanded", "true");
    const ids = screen.getAllByRole("listbox").map((l) => l.id);
    expect(ids).toHaveLength(3);
    expect(input().getAttribute("aria-controls")?.split(" ")).toEqual(ids);
    expect(input()).not.toHaveAttribute("aria-activedescendant");
  });

  it("shows per-group loading, no-matches and error states while other groups still render", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Harness
        chips={[]}
        groups={[
          {
            id: "a",
            label: "Loading group",
            count: { count: null, isLoading: true },
            status: "loading",
            items: [],
          },
          { id: "b", label: "Empty group", count: { count: 0 }, status: "empty", items: [] },
          {
            id: "c",
            label: "Broken group",
            count: { count: null },
            status: "error",
            items: [],
            onRetry,
          },
          groups[0]!,
        ]}
      />,
    );
    expect(
      screen.getByText("Loading group").closest("[data-slot='suggestion-group']"),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.getByText("Could not load suggestions")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("walks chips then items with the arrow keys, wrapping, and moves within chips sideways", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(input());
    const active = () =>
      document.getElementById(input().getAttribute("aria-activedescendant") ?? "")?.textContent;

    await user.keyboard("{ArrowDown}");
    expect(active()).toBe("Title1212 results");
    await user.keyboard("{ArrowRight}");
    expect(active()).toBe("Reference?unknown number of results");
    await user.keyboard("{ArrowRight}");
    expect(active()).toBe("Title1212 results");
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe("Alpha");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toBe("Almost");
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe("Title1212 results");
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe("Almost");
  });

  it("selects the highlighted chip or item with Enter", async () => {
    const user = userEvent.setup();
    const onSelectChip = vi.fn();
    const onSelectItem = vi.fn();
    render(<Harness onSelectChip={onSelectChip} onSelectItem={onSelectItem} />);
    await user.click(input());

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectChip).toHaveBeenCalledWith("title");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectItem).toHaveBeenCalledWith("title", "Alpha");
  });

  it("leaves Enter with nothing highlighted to the caller", async () => {
    const user = userEvent.setup();
    const onUnhandledKeyDown = vi.fn();
    render(<Harness onUnhandledKeyDown={onUnhandledKeyDown} />);
    await user.click(input());
    await user.keyboard("{Enter}");
    expect(onUnhandledKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }));
  });

  it("selects an item on click", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(<Harness onSelectItem={onSelectItem} />);
    await user.click(screen.getByRole("option", { name: "Almost" }));
    expect(onSelectItem).toHaveBeenCalledWith("notes", "Almost");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(input());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Suggestions" })).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("never puts status text inside a listbox", () => {
    render(
      <Harness
        chips={[]}
        groups={[{ id: "a", label: "Broken", count: { count: null }, status: "error", items: [] }]}
      />,
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("Could not load suggestions")).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-controls", region().id);
  });

  it("renders no popover when there is nothing to show", () => {
    render(<Harness chips={[]} groups={[]} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });
});
