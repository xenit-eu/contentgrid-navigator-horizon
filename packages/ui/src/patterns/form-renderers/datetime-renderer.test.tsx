import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateTimeRenderer, formatPlaceholder, parseDateInput } from "./datetime-renderer";
import { datetimeField } from "./test-fixtures";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

describe("formatPlaceholder", () => {
  it("maps the en-GB format parts", () => {
    expect(formatPlaceholder(false, "en-GB")).toBe("dd mmm yyyy");
    expect(formatPlaceholder(true, "en-GB")).toBe("dd mmm yyyy, hh:mm");
  });

  it("maps the en-US format parts", () => {
    expect(formatPlaceholder(false, "en-US")).toBe("mmm dd, yyyy");
    expect(formatPlaceholder(true, "en-US")).toBe("mmm dd, yyyy, hh:mm am/pm");
  });
});

describe("parseDateInput", () => {
  const ymd = (date: Date | undefined) =>
    date && [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  it.each([
    ["14/02/1996"],
    ["14-02-1996"],
    ["14.02.1996"],
    ["14 Feb 1996"],
    ["14 February 1996"],
    ["  14/2/1996  "],
  ])("reads en-GB %s", (text) => {
    expect(ymd(parseDateInput(text, false, "en-GB"))).toEqual([1996, 2, 14]);
  });

  it.each([["02/14/1996"], ["Feb 14, 1996"], ["February 14 1996"], ["Feb. 14, 1996"]])(
    "reads en-US %s",
    (text) => {
      expect(ymd(parseDateInput(text, false, "en-US"))).toEqual([1996, 2, 14]);
    },
  );

  it("reads numeric order for other locales", () => {
    expect(ymd(parseDateInput("14.02.1996", false, "de"))).toEqual([1996, 2, 14]);
    expect(ymd(parseDateInput("1996/02/14", false, "ja"))).toEqual([1996, 2, 14]);
    expect(ymd(parseDateInput("14. Februar 1996", false, "de"))).toEqual([1996, 2, 14]);
  });

  it.each([["en-GB"], ["en-US"], ["de"]])("reads ISO in %s", (locale) => {
    expect(ymd(parseDateInput("1996-02-14", false, locale))).toEqual([1996, 2, 14]);
    expect(ymd(parseDateInput("1996/02/14", false, locale))).toEqual([1996, 2, 14]);
  });

  it.each([
    ["31/02/1996"],
    ["14/02/96"],
    ["abc"],
    ["13/13/2020"],
    [""],
    ["14/02"],
    ["14 Feb"],
    ["Feb 1996 1997"],
    ["Feb 14 x"],
    ["14/02/0999"],
    ["14/02/1996/1"],
    ["123/02/1996"],
    ["9999/99/99"],
  ])("rejects %j", (text) => {
    expect(parseDateInput(text, false, "en-GB")).toBeUndefined();
  });

  it("reads a time for date-times", () => {
    const morning = parseDateInput("14/02/1996 09:30", true, "en-GB");
    expect(morning).toEqual(new Date(1996, 1, 14, 9, 30));
    expect(parseDateInput("14/02/1996, 9:30 pm", true, "en-GB")).toEqual(
      new Date(1996, 1, 14, 21, 30),
    );
    expect(parseDateInput("14/02/1996 12:05 a.m.", true, "en-GB")).toEqual(
      new Date(1996, 1, 14, 0, 5),
    );
    expect(parseDateInput("14/02/1996 12:05PM", true, "en-GB")).toEqual(
      new Date(1996, 1, 14, 12, 5),
    );
    expect(parseDateInput("14/02/1996\u202f09:30", true, "en-GB")).toEqual(
      new Date(1996, 1, 14, 9, 30),
    );
    expect(parseDateInput("14/02/1996", true, "en-GB")).toEqual(new Date(1996, 1, 14));
  });

  it.each([
    ["14/02/1996 25:00"],
    ["14/02/1996 10:60"],
    ["14/02/1996 13:00 pm"],
    ["14/02/1996 0:30 am"],
  ])("rejects the time in %j", (text) => {
    expect(parseDateInput(text, true, "en-GB")).toBeUndefined();
  });

  it("rejects a time when the field has none", () => {
    expect(parseDateInput("14/02/1996 09:30", false, "en-GB")).toBeUndefined();
  });
});

describe("DateTimeRenderer", () => {
  const input = () => screen.getByLabelText("Due date");
  const calendarButton = () => screen.getByRole("button", { name: "Choose date" });

  it("renders a labelled text input with the date placeholder and a calendar button", () => {
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} />);
    expect(input().tagName).toBe("INPUT");
    expect(input()).toHaveAttribute("placeholder", formatPlaceholder(false));
    expect(input()).toHaveValue("");
    expect(calendarButton().querySelector("svg")).not.toBeNull();
  });

  it("sizes the input to its placeholder or text, whichever is longer", async () => {
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} />);
    expect(input()).toHaveAttribute(
      "size",
      String(Math.ceil(formatPlaceholder(false).length * 1.1)),
    );
    await userEvent.type(input(), "a much longer typed text than the placeholder");
    expect(input()).toHaveAttribute("size", "50");
  });

  it("shows the date-time placeholder when includesTime is true", () => {
    render(
      <DateTimeRenderer {...datetimeField({ includesTime: true })} value="" onChange={vi.fn()} />,
    );
    expect(input()).toHaveAttribute("placeholder", formatPlaceholder(true));
  });

  it("formats a Date value in the browser locale", () => {
    const value = new Date(2024, 2, 15);
    render(<DateTimeRenderer {...datetimeField()} value={value} onChange={vi.fn()} />);
    expect(input()).toHaveValue(dateFormat.format(value));
  });

  it("reads a bare yyyy-MM-dd string as a local calendar day", () => {
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={vi.fn()} />);
    expect(input()).toHaveValue(dateFormat.format(new Date(2024, 2, 15)));
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
    expect(input()).toHaveValue(dateTimeFormat.format(value));
  });

  it("calls onChange with the raw yyyy-MM-dd string for a date-only field", async () => {
    // `@contentgrid/hal-forms/values` only accepts a `Date` instance for the datetime wire
    // type; a bare "date" property must stay a plain string (HalFormsValuesImpl.isValidTypeValue).
    const onChange = vi.fn();
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
    await userEvent.click(calendarButton());
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
    await userEvent.click(calendarButton());
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
    await userEvent.click(calendarButton());
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "14:45" } });
    expect(onChange).toHaveBeenCalledWith(new Date(2024, 2, 15, 14, 45));
  });

  it("calls onChange with an empty string when cleared", async () => {
    const onChange = vi.fn();
    render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
    await userEvent.click(calendarButton());
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
    await userEvent.click(calendarButton());
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  describe("typing", () => {
    it("commits a typed date-only value on blur as a yyyy-MM-dd string and reformats it", async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <DateTimeRenderer {...datetimeField()} value="" onChange={onChange} />,
      );
      await userEvent.type(input(), "1996-02-14");
      expect(onChange).not.toHaveBeenCalled();
      await userEvent.tab();
      expect(onChange).toHaveBeenCalledExactlyOnceWith("1996-02-14");
      rerender(<DateTimeRenderer {...datetimeField()} value="1996-02-14" onChange={onChange} />);
      expect(input()).toHaveValue(dateFormat.format(new Date(1996, 1, 14)));
    });

    it("commits a typed date-time value as a local Date", async () => {
      const onChange = vi.fn();
      render(
        <DateTimeRenderer
          {...datetimeField({ includesTime: true })}
          value=""
          onChange={onChange}
        />,
      );
      await userEvent.type(input(), "1996-02-14");
      await userEvent.tab();
      expect(onChange).toHaveBeenCalledWith(new Date(1996, 1, 14, 0, 0));
    });

    it("keeps the current time when the typed date-time text has none", async () => {
      const onChange = vi.fn();
      render(
        <DateTimeRenderer
          {...datetimeField({ includesTime: true })}
          value={new Date(2024, 2, 15, 10, 30)}
          onChange={onChange}
        />,
      );
      await userEvent.clear(input());
      await userEvent.type(input(), "1996-02-14");
      await userEvent.tab();
      expect(onChange).toHaveBeenCalledWith(new Date(1996, 1, 14, 10, 30));
    });

    it("uses the typed time of a date-time value", async () => {
      const onChange = vi.fn();
      render(
        <DateTimeRenderer
          {...datetimeField({ includesTime: true })}
          value={new Date(2024, 2, 15, 10, 30)}
          onChange={onChange}
        />,
      );
      await userEvent.clear(input());
      await userEvent.type(input(), "1996-02-14 21:05");
      await userEvent.tab();
      expect(onChange).toHaveBeenCalledWith(new Date(1996, 1, 14, 21, 5));
    });

    it("commits on Enter", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="" onChange={onChange} />);
      await userEvent.type(input(), "1996-02-14{Enter}");
      expect(onChange).toHaveBeenCalledWith("1996-02-14");
    });

    it("shows an error for text that is not a date and does not call onChange", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="" onChange={onChange} />);
      await userEvent.type(input(), "31/02/1996");
      await userEvent.tab();
      expect(onChange).not.toHaveBeenCalled();
      expect(input()).toHaveValue("31/02/1996");
      expect(input()).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText(/^Enter a date like /)).toBeInTheDocument();

      // editing clears the local error again
      await userEvent.type(input(), "x");
      expect(input()).toHaveAttribute("aria-invalid", "false");
    });

    it("prefers the error prop to the local error", async () => {
      render(
        <DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} error="Required" />,
      );
      await userEvent.type(input(), "nope");
      await userEvent.tab();
      expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("reverts the draft and the error on Escape", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
      await userEvent.clear(input());
      await userEvent.type(input(), "garbage");
      await userEvent.tab();
      expect(input()).toHaveAttribute("aria-invalid", "true");
      await userEvent.click(input());
      await userEvent.keyboard("{Escape}");
      expect(input()).toHaveValue(dateFormat.format(new Date(2024, 2, 15)));
      expect(input()).toHaveAttribute("aria-invalid", "false");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("reverts a plain draft on Escape without calling onChange", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
      await userEvent.type(input(), "{Escape}");
      expect(onChange).not.toHaveBeenCalled();
      await userEvent.type(input(), "1{Escape}");
      expect(input()).toHaveValue(dateFormat.format(new Date(2024, 2, 15)));
    });

    it("calls onChange with an empty string when the text is cleared", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
      await userEvent.clear(input());
      await userEvent.tab();
      expect(onChange).toHaveBeenCalledWith("");
    });

    it("does nothing on blur when nothing was typed", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
      await userEvent.click(input());
      await userEvent.tab();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("drops a pending draft when a day is picked in the calendar", async () => {
      const onChange = vi.fn();
      render(<DateTimeRenderer {...datetimeField()} value="2024-03-15" onChange={onChange} />);
      await userEvent.clear(input());
      await userEvent.type(input(), "garbage");
      await userEvent.click(calendarButton());
      await userEvent.click(screen.getByRole("button", { name: /March 20th, 2024/ }));
      expect(onChange).toHaveBeenCalledWith("2024-03-20");
      expect(screen.queryByText(/^Enter a date like /)).not.toBeInTheDocument();
    });
  });

  it("makes the input read-only and disables the calendar button", async () => {
    render(
      <DateTimeRenderer
        {...datetimeField({ readOnly: true })}
        value="2024-03-15"
        onChange={vi.fn()}
      />,
    );
    expect(input()).toHaveAttribute("readonly");
    expect(calendarButton()).toBeDisabled();
    await userEvent.click(calendarButton());
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("marks the input required", () => {
    render(<DateTimeRenderer {...datetimeField({ required: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Due date/)).toHaveAttribute("aria-required", "true");
  });

  it("marks the input invalid and links the error", () => {
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} error="Required" />);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAttribute("aria-describedby", "dueDate-error");
  });

  it("calls onFocus when focus enters the field, not when it moves within it", async () => {
    const onFocus = vi.fn();
    render(<DateTimeRenderer {...datetimeField()} value="" onChange={vi.fn()} onFocus={onFocus} />);
    await userEvent.click(input());
    expect(onFocus).toHaveBeenCalledTimes(1);
    await userEvent.tab({ shift: true });
    expect(onFocus).toHaveBeenCalledTimes(1);
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
    await userEvent.click(calendarButton());
    await userEvent.click(
      screen.getAllByRole("button", { name: /\w+ \d{1,2}(st|nd|rd|th), \d{4}/ })[10]!,
    );
    expect(onBlur).not.toHaveBeenCalled();

    // popover closed after the pick; focus is back on the calendar button. Tabbing to the
    // input stays inside the field, tabbing again leaves it.
    await userEvent.tab();
    expect(onBlur).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("commits the typed text before reporting blur", async () => {
    const calls: string[] = [];
    render(
      <DateTimeRenderer
        {...datetimeField()}
        value=""
        onChange={() => calls.push("change")}
        onBlur={() => calls.push("blur")}
      />,
    );
    await userEvent.type(input(), "1996-02-14");
    await userEvent.tab();
    expect(calls).toEqual(["change", "blur"]);
  });
});
