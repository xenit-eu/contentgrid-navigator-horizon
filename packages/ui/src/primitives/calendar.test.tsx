import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";

// CalendarDayButton sets data-day from `day.date.toLocaleDateString()`; using
// the same call here locates a specific day cell unambiguously (unlike
// querying by visible day-number text, which collides with outside-month
// days that show the same number, e.g. day "1" also appearing for the
// following month's first days rendered in the same grid).
function getDayButton(container: HTMLElement, date: Date) {
  return container.querySelector<HTMLElement>(`[data-day="${date.toLocaleDateString()}"]`);
}

describe("Calendar", () => {
  it("renders without throwing", () => {
    const { container } = render(<Calendar />);
    expect(container.querySelector("[data-slot='calendar']")).toBeInTheDocument();
  });

  it("renders the day grid for the displayed month", () => {
    const { container } = render(<Calendar mode="single" defaultMonth={new Date(2024, 0, 1)} />);

    expect(getDayButton(container, new Date(2024, 0, 1))).toHaveTextContent("1");
    expect(getDayButton(container, new Date(2024, 0, 15))).toHaveTextContent("15");
    expect(getDayButton(container, new Date(2024, 0, 31))).toHaveTextContent("31");
  });

  it("reflects a selected date in the DOM", () => {
    const { container } = render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2024, 0, 1)}
        selected={new Date(2024, 0, 15)}
      />,
    );

    const selectedDayButton = getDayButton(container, new Date(2024, 0, 15));
    expect(selectedDayButton).toHaveAttribute("data-selected-single", "true");
    expect(selectedDayButton?.closest("td")).toHaveAttribute("aria-selected", "true");

    const unselectedDayButton = getDayButton(container, new Date(2024, 0, 10));
    expect(unselectedDayButton?.getAttribute("data-selected-single")).not.toBe("true");
    expect(unselectedDayButton?.closest("td")).not.toHaveAttribute("aria-selected", "true");
  });

  it("clicking a day invokes onSelect with that date", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <Calendar mode="single" defaultMonth={new Date(2024, 0, 1)} onSelect={onSelect} />,
    );

    const dayButton = getDayButton(container, new Date(2024, 0, 15));
    expect(dayButton).not.toBeNull();
    await user.click(dayButton as HTMLElement);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0]).toEqual(new Date(2024, 0, 15));
  });

  it("navigating to the next month updates the rendered month and day grid", async () => {
    const user = userEvent.setup();
    render(<Calendar mode="single" defaultMonth={new Date(2024, 0, 1)} />);
    expect(screen.getByText("January 2024")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));

    expect(screen.getByText("February 2024")).toBeInTheDocument();
    expect(screen.queryByText("January 2024")).not.toBeInTheDocument();
  });

  it("renders with captionLayout=dropdown-years without throwing", () => {
    const { container } = render(<Calendar captionLayout="dropdown-years" />);
    expect(container.querySelector("[data-slot='calendar']")).toBeInTheDocument();
  });
});
