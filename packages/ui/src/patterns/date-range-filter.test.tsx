import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateRangeFilter, type DateRangeFilterProps } from "./date-range-filter";

const presets = [
  { id: "last-day", label: "Last day" },
  { id: "last-week", label: "Last week" },
];

function renderFilter(props: Partial<DateRangeFilterProps> = {}) {
  const handlers = {
    onValueChange: vi.fn(),
    onPresetSelect: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
  };
  render(
    <DateRangeFilter
      value={{ from: new Date(2026, 9, 1), to: new Date(2026, 9, 3) }}
      presets={presets}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("DateRangeFilter", () => {
  it("reports a day picked on the calendar as a one-day range", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderFilter({ value: {} });
    const grid = screen.getByRole("grid");
    const firstDay = within(grid)
      .getAllByRole("button")
      .find((b) => b.textContent?.trim() === "15")!;
    await user.click(firstDay);
    const picked = onValueChange.mock.calls[0]?.[0];
    expect(picked.from.getDate()).toBe(15);
    expect(picked.to).toEqual(picked.from);
  });

  it("selects a preset and marks the active one", async () => {
    const user = userEvent.setup();
    const { onPresetSelect } = renderFilter({ activePresetId: "last-week" });
    expect(screen.getByRole("button", { name: "Last week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Last day" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Last day" }));
    expect(onPresetSelect).toHaveBeenCalledWith("last-day");
  });

  it("applies and clears", async () => {
    const user = userEvent.setup();
    const { onApply, onClear } = renderFilter();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("cannot apply an empty range", () => {
    renderFilter({ value: {} });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("stacks calendar and presets on narrow screens", () => {
    renderFilter();
    expect(screen.getByRole("group", { name: "Presets" }).parentElement).toHaveClass(
      "flex-col",
      "sm:flex-row",
    );
  });
});
