import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import { FormContainer } from "./form-container";

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const nameField: FieldDescriptor = {
  name: "name",
  label: "Name",
  required: true,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

const totalField: FieldDescriptor = {
  name: "total",
  label: "Total",
  required: false,
  readOnly: false,
  kind: "number",
  property: DUMMY_PROPERTY,
};

describe("FormContainer", () => {
  it("renders one FieldRenderer per field name in layout order", () => {
    render(
      <FormContainer
        fields={[nameField, totalField]}
        layout={{ groups: [{ fieldNames: ["name", "total"] }] }}
        values={{ name: "Acme", total: 5 }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.getByLabelText(/Name/)).toHaveValue("Acme");
    expect(screen.getByLabelText(/Total/)).toHaveValue(5);
  });

  it("skips a layout field name absent from the resolved fields, without throwing", () => {
    render(
      <FormContainer
        fields={[nameField]}
        layout={{ groups: [{ fieldNames: ["name", "ghost"] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });

  it("passes the matching field's errors down to FieldRenderer", () => {
    render(
      <FormContainer
        fields={[nameField]}
        layout={{ groups: [{ fieldNames: ["name"] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{ name: { errors: [{ source: "internal", message: "Name is required" }] } }}
      />,
    );
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("calls onChange with the field's name and the new value", () => {
    const onChange = vi.fn();
    render(
      <FormContainer
        fields={[nameField]}
        layout={{ groups: [{ fieldNames: ["name"] }] }}
        values={{ name: "" }}
        onChange={onChange}
        fieldState={{}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Acme" } });
    expect(onChange).toHaveBeenCalledWith("name", "Acme");
  });
});
