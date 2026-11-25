import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateTimeRenderer } from "./datetime-renderer";
import { datetimeField } from "./test-fixtures";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

describe("DateTimeRenderer", () => {
  it("renders a labelled trigger button with the date placeholder when empty", () => {
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} />);
    const trigger = screen.getByLabelText("Due date");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent("dd mmm yyyy");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("shows the date-time placeholder when includesTime is true", () => {
    render(
      <DateTimeRenderer {...datetimeField({ includesTime: true })} value="" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Due date")).toHaveTextContent("dd mmm yyyy, hh:mm");
  });

  it("formats a Date value in the browser locale", () => {
    const value = new Date(2024, 2, 15);
    render(<DateTimeRenderer {...datetimeField()} value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Due date")).toHaveTextContent(dateFormat.format(value));
  });

  it("reads a bare yyyy-MM-dd string as a local calendar day", () => {
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Due date")).toHaveTextContent(
      dateFormat.format(new Date(2024, 2, 15)),
    );
  });

  it("formats a Date value with the time when includesTime is true", () => {
    const value = new Date(2024, 2, 15, 9, 12);
    render(
      <DateTimeRenderer
        {...datetimeField({ includesTime: true })}
        value={value}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Due date")).toHaveTextContent(dateTimeFormat.format(value));
  });

  it("calls onChange with the raw yyyy-MM-dd string for a date-only field", async () => {
    // `@contentgrid/hal-forms/values` only accepts a `Date` instance for the datetime wire
    // type; a bare "date" property must stay a plain string (HalFormValuesImpl.isValidTypeValue).
    const onChange = vi.fn();
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Due date"));
    await userEvent.click(screen.getByRole("button", { name: /March 20th, 2024/ }));
    expect(onChange).toHaveBeenCalledWith("2024-03-20");
  });

  it("calls onChange with a local Date, keeping the time, for a date-time field", async () => {
    const onChange = vi.fn();
    render(
      <DateTimeRenderer
        {...datetimeField({ includesTime: true })}
        value={new Date(2024, 2, 15, 10, 30)}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText("Due date"));
    await userEvent.click(screen.getByRole("button", { name: /March 20th, 2024/ }));
    expect(onChange).toHaveBeenCalledWith(new Date(2024, 2, 20, 10, 30));
  });

  it("calls onChange with a Date when the time changes", async () => {
    const onChange = vi.fn();
    render(
      <DateTimeRenderer
        {...datetimeField({ includesTime: true })}
        value={new Date(2024, 2, 15, 10, 30)}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText("Due date"));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "14:45" } });
    expect(onChange).toHaveBeenCalledWith(new Date(2024, 2, 15, 14, 45));
  });

  it("calls onChange with an empty string when cleared", async () => {
    const onChange = vi.fn();
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Due date"));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no Clear button for a required field", async () => {
    render(
      <DateTimeRenderer
        {...datetimeField({ required: true })}
        value="2024-03-15"
        onChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/Due date/));
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("does not open the picker when read-only", async () => {
    render(
      <DateTimeRenderer
        {...datetimeField({ readOnly: true })}
        value="2024-03-15"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Due date")).toHaveAttribute("aria-readonly", "true");
    await userEvent.click(screen.getByLabelText("Due date"));
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("marks the trigger invalid and links the error", () => {
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} error="Required" />);
    const trigger = screen.getByLabelText("Due date");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "dueDate-error");
  });

  it("does not call onBlur while focus moves into the popover, and once when the field is left", async () => {
    const onBlur = vi.fn();
    render(
      <>
        <DateTimeRenderer
          {...datetimeField({ required: true })}
          value=""
          onChange={vi.fn()}
          onBlur={onBlur}
        />
        <button type="button">next</button>
      </>,
    );
    await userEvent.click(screen.getByLabelText(/Due date/));
    await userEvent.click(
      screen.getAllByRole("button", { name: /\w+ \d{1,2}(st|nd|rd|th), \d{4}/ })[10]!,
    );
    expect(onBlur).not.toHaveBeenCalled();

    // popover closed after the pick; focus is back on the trigger. Tabbing away leaves the field.
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
