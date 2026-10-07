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
});
