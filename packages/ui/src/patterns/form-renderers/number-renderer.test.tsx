import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberRenderer } from "./number-renderer";
import { numberField } from "./test-fixtures";

describe("NumberRenderer", () => {
  it("renders a numeric input with the given value", () => {
    render(<NumberRenderer field={numberField()} value={5} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(5);
  });

  it("renders an empty input for an empty-string value", () => {
    render(<NumberRenderer field={numberField()} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(null);
  });

  it("calls onChange with a coerced number", () => {
    const onChange = vi.fn();
    render(<NumberRenderer field={numberField()} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("calls onChange with an empty string when cleared", () => {
    const onChange = vi.fn();
    render(<NumberRenderer field={numberField()} value={7} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  // Error/description display is FieldShell's own logic — see field-shell.test.tsx.
  it("marks the input aria-invalid when there is an error", () => {
    render(
      <NumberRenderer
        field={numberField()}
        value=""
        onChange={vi.fn()}
        error="Quantity is required"
      />,
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
  });
});
