import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type FilterChipItem, FilterChips } from "./filter-chips";

const chips: FilterChipItem[] = [
  { id: "title~prefix", field: "Title", mode: "starts with", value: "Alpha" },
  { id: "received_at", field: "Received at", mode: "between", value: "1 Oct 2026 – 7 Oct 2026" },
];

describe("FilterChips", () => {
  it("renders one list item per chip with field, mode and value", () => {
    render(<FilterChips chips={chips} onRemove={vi.fn()} />);
    const items = within(screen.getByRole("list", { name: "Active filters" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Title: starts withAlpha");
  });

  it("calls onRemove with the chip id", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<FilterChips chips={chips} onRemove={onRemove} />);
    await user.click(
      screen.getByRole("button", {
        name: "Remove filter Received at between 1 Oct 2026 – 7 Oct 2026",
      }),
    );
    expect(onRemove).toHaveBeenCalledWith("received_at");
  });

  it("shows a chip whose filter is not applied in the warning tone, with its explanation", () => {
    render(
      <FilterChips
        chips={[
          ...chips,
          { id: "foo", field: "foo", mode: "is", value: "bar", warning: "Not applied" },
        ]}
        onRemove={vi.fn()}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Active filters" })).getAllByRole(
      "listitem",
    );
    const chip = items[2]!.querySelector("[data-slot='chip']");
    expect(chip).toHaveAttribute("data-tone", "warning");
    expect(chip).toHaveAttribute("title", "Not applied");
    expect(items[2]).toHaveTextContent("Not applied");
    expect(items[2]!.querySelector("[data-slot='chip-mode'] svg")).not.toBeNull();
    expect(items[0]!.querySelector("[data-slot='chip']")).toHaveAttribute("data-tone", "applied");
  });

  it("renders nothing for no chips", () => {
    const { container } = render(<FilterChips chips={[]} onRemove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("wraps in a horizontally scrolling container", () => {
    const { container } = render(<FilterChips chips={chips} onRemove={vi.fn()} />);
    expect(container.querySelector("[data-slot='filter-chips']")).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("list")).toHaveClass("flex-wrap");
  });

  it("stays on one line when maxLines is 1", () => {
    render(<FilterChips chips={chips} onRemove={vi.fn()} maxLines={1} />);
    expect(screen.getByRole("list")).toHaveClass("flex-nowrap");
  });

  it("scrolls a focused chip into view", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    render(<FilterChips chips={chips} onRemove={vi.fn()} />);
    await user.tab();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    scrollIntoView.mockRestore();
  });

  it("calls onSelect only for selectable chips", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FilterChips
        chips={[{ ...chips[0]!, selectable: true }, chips[1]!]}
        onRemove={vi.fn()}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit filter Title starts with Alpha" }));
    expect(onSelect).toHaveBeenCalledWith("title~prefix");
    expect(screen.queryByRole("button", { name: /^Edit filter Received at/ })).toBeNull();
  });

  it("sizes the list from the chips' natural widths so they fit on two lines", () => {
    const widths = [600, 350, 600, 350, 600];
    const many = widths.map((_, i) => ({ id: `c${i}`, field: "F", mode: "is", value: `v${i}` }));
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
        const width = this.tagName === "LI" ? (widths[index] ?? 0) : 0;
        return { width } as DOMRect;
      });
    const client = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);

    render(<FilterChips chips={many} onRemove={vi.fn()} />);
    // Half the total (2500 + 5 gaps of 8) plus the widest chip (600 + 8).
    expect(screen.getByRole("list")).toHaveStyle({ width: `${Math.ceil(2540 / 2 + 608)}px` });

    rect.mockRestore();
    client.mockRestore();
  });
});
