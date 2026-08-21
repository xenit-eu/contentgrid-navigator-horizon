import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { textField } from "./test-fixtures";
import { TextRenderer } from "./text-renderer";

describe("TextRenderer", () => {
  it("renders label and value", () => {
    render(<TextRenderer field={textField()} value="Acme Corp" onChange={vi.fn()} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Acme Corp");
  });

  it("falls back to an empty string for a non-string value", () => {
    render(<TextRenderer field={textField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("calls onChange with the raw input string", () => {
    const onChange = vi.fn();
    render(<TextRenderer field={textField()} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme" } });
    expect(onChange).toHaveBeenCalledWith("Acme");
  });

  it("marks the input read-only when the field is read-only", () => {
    render(<TextRenderer field={textField({ readOnly: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  // Required-marker and description/error swap are FieldShell's own logic — see field-shell.test.tsx.
  it("marks the input aria-invalid when there is an error", () => {
    render(
      <TextRenderer field={textField()} value="" onChange={vi.fn()} error="Name is required" />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
