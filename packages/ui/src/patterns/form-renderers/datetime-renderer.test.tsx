import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimeRenderer } from "./datetime-renderer";
import { datetimeField } from "./test-fixtures";

describe("DateTimeRenderer", () => {
  it("renders a date input for a date-only field", () => {
    render(<DateTimeRenderer field={datetimeField()} value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Due date");
    expect(input).toHaveAttribute("type", "date");
  });

  it("renders a datetime-local input when includesTime is true", () => {
    render(
      <DateTimeRenderer
        field={datetimeField({ includesTime: true })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Due date")).toHaveAttribute("type", "datetime-local");
  });

  it("formats a Date value as a date-input string", () => {
    render(
      <DateTimeRenderer
        field={datetimeField()}
        value={new Date("2024-03-15T00:00:00.000Z")}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Due date")).toHaveValue("2024-03-15");
  });

  it("calls onChange with the raw ISO date string for a date-only field", () => {
    // `@contentgrid/hal-forms/values` only accepts a `Date` instance for the
    // datetime/datetime-local wire types — a bare "date" property must stay a
    // plain string or encoding throws (HalFormValuesImpl.isValidTypeValue).
    const onChange = vi.fn();
    render(<DateTimeRenderer field={datetimeField()} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2024-03-15" } });
    expect(onChange).toHaveBeenCalledWith("2024-03-15");
  });

  it("calls onChange with a Date instance when includesTime is true", () => {
    const onChange = vi.fn();
    render(
      <DateTimeRenderer
        field={datetimeField({ includesTime: true })}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2024-03-15T10:30" } });
    expect(onChange).toHaveBeenCalledWith(new Date("2024-03-15T10:30"));
  });

  it("calls onChange with an empty string when cleared", () => {
    const onChange = vi.fn();
    render(<DateTimeRenderer field={datetimeField()} value="2024-03-15" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });
});
