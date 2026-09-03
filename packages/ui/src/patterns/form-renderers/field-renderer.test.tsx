import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldRenderer } from "./field-renderer";
import {
  booleanField,
  datetimeField,
  enumField,
  enumMultiField,
  fileField,
  numberField,
  relationToOneField,
  textField,
} from "./test-fixtures";

describe("FieldRenderer", () => {
  it("dispatches a text field to a text input", () => {
    render(<FieldRenderer field={textField()} value="Acme" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("dispatches a number field to a numeric input", () => {
    render(<FieldRenderer field={numberField()} value={1} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("dispatches a boolean field to a checkbox", () => {
    render(<FieldRenderer field={booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("dispatches a datetime field to a date input", () => {
    render(<FieldRenderer field={datetimeField()} value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Due date")).toHaveAttribute("type", "date");
  });

  it("dispatches an enum field to a select", () => {
    render(<FieldRenderer field={enumField()} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("dispatches an enum-multi field to a checkbox list", () => {
    render(<FieldRenderer field={enumMultiField()} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("renders a not-yet-supported placeholder for a file field", () => {
    render(<FieldRenderer field={fileField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(screen.getByText(/not yet supported/)).toBeInTheDocument();
  });

  it("renders a not-yet-supported placeholder for a relation-to-one field", () => {
    render(<FieldRenderer field={relationToOneField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText(/not yet supported/)).toBeInTheDocument();
  });
});
