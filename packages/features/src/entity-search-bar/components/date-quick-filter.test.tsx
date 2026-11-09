import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WithOpenState } from "../test-utils";
import type { DateQuickFilter as Model } from "../util/build-quick-filters";
import { DateQuickFilter } from "./date-quick-filter";

const dueDate: Model = {
  kind: "date",
  groupKey: "due_date",
  label: "Due date",
  paramNames: ["due_date~from", "due_date~until"],
  isActive: false,
  tone: "idle",
  includesTime: false,
  lower: "due_date~from",
  lowerInclusive: true,
  upper: "due_date~until",
  upperInclusive: true,
};

const receivedAt: Model = {
  ...dueDate,
  groupKey: "received_at",
  label: "Received at",
  paramNames: ["received_at~from", "received_at~until"],
  includesTime: true,
  lower: "received_at~from",
  lowerInclusive: true,
  upper: "received_at~until",
  upperInclusive: true,
};

function renderFilter(quickFilter: Model, filters: Record<string, string> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  render(
    <WithOpenState>
      {(openState) => (
        <DateQuickFilter
          {...openState}
          quickFilter={{ ...quickFilter, isActive: Object.keys(filters).length > 0 }}
          filters={filters}
          onApply={onApply}
          onClear={onClear}
        />
      )}
    </WithOpenState>,
  );
  return { onApply, onClear };
}

describe("DateQuickFilter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies a preset, evaluated when Apply is clicked, at the attribute's date precision", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0, 0));
    const user = userEvent.setup();
    const { onApply } = renderFilter(dueDate);

    await user.click(screen.getByRole("button", { name: "Due date" }));
    await user.click(screen.getByRole("button", { name: "Last week" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith("due_date", {
      "due_date~from": "2026-09-30",
      "due_date~until": "2026-10-07",
    });
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("leaves an untouched filter as it is on Apply, instead of rounding it to whole days", async () => {
    const user = userEvent.setup();
    const filters = {
      "received_at~from": "2026-09-30T10:15:00.000Z",
      "received_at~until": "2026-10-07T10:15:00.000Z",
    };
    const { onApply } = renderFilter(receivedAt, filters);

    await user.click(screen.getByRole("button", { name: "Received at" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("clears the filter from inside the popover", async () => {
    const user = userEvent.setup();
    const { onClear } = renderFilter(dueDate, { "due_date~from": "2026-10-01" });

    await user.click(screen.getByRole("button", { name: "Due date" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onClear).toHaveBeenCalledWith("due_date");
  });
});
