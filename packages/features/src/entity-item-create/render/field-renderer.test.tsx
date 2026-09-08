import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import { FieldRenderer } from "./field-renderer";

/** `FieldRenderer` only reads `.property` for the `enum` case's remote-options check (via
 * `field.property.options?.isRemote()`) — a dummy stand-in with no `options` is enough for every
 * other kind, mirroring the DUMMY_LINK pattern in
 * packages/ui/src/patterns/form-renderers/test-fixtures.ts. */
const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

function textField(overrides: Partial<Extract<FieldDescriptor, { kind: "text" }>> = {}) {
  return {
    name: "name",
    label: "Name",
    required: false,
    readOnly: false,
    kind: "text",
    property: DUMMY_PROPERTY,
    ...overrides,
  } satisfies Extract<FieldDescriptor, { kind: "text" }>;
}

function numberField() {
  return {
    name: "quantity",
    label: "Quantity",
    required: false,
    readOnly: false,
    kind: "number",
    property: DUMMY_PROPERTY,
  } satisfies Extract<FieldDescriptor, { kind: "number" }>;
}

function booleanField() {
  return {
    name: "active",
    label: "Active",
    required: false,
    readOnly: false,
    kind: "boolean",
    property: DUMMY_PROPERTY,
  } satisfies Extract<FieldDescriptor, { kind: "boolean" }>;
}

function datetimeField() {
  return {
    name: "dueDate",
    label: "Due date",
    required: false,
    readOnly: false,
    kind: "datetime",
    includesTime: false,
    property: DUMMY_PROPERTY,
  } satisfies Extract<FieldDescriptor, { kind: "datetime" }>;
}

function enumField(overrides: Partial<Extract<FieldDescriptor, { kind: "enum" }>> = {}) {
  return {
    name: "status",
    label: "Status",
    required: false,
    readOnly: false,
    kind: "enum",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
    ],
    multiValue: false,
    property: DUMMY_PROPERTY,
    ...overrides,
  } satisfies Extract<FieldDescriptor, { kind: "enum" }>;
}

function fileField() {
  return {
    name: "attachment",
    label: "Attachment",
    required: false,
    readOnly: false,
    kind: "file",
    multiple: false,
    property: DUMMY_PROPERTY,
  } satisfies Extract<FieldDescriptor, { kind: "file" }>;
}

function relationField() {
  return {
    name: "supplier",
    label: "Supplier",
    required: false,
    readOnly: false,
    kind: "relation",
    cardinality: "to-one",
    targetHref: "https://api.example.com/suppliers",
    property: DUMMY_PROPERTY,
  } satisfies Extract<FieldDescriptor, { kind: "relation" }>;
}

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

  it("dispatches a non-multi enum field to a select", () => {
    render(<FieldRenderer field={enumField()} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("dispatches a multi-value enum field to a checkbox list", () => {
    render(<FieldRenderer field={enumField({ multiValue: true })} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("renders a not-yet-supported placeholder for a file field", () => {
    render(<FieldRenderer field={fileField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(screen.getByText(/not yet supported/)).toBeInTheDocument();
  });

  it("renders a profile-unavailable placeholder for a relation field with no relationFieldData", () => {
    render(<FieldRenderer field={relationField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText(/related entity profile unavailable/)).toBeInTheDocument();
  });

  it("shows the first error's message for a field with errors", () => {
    render(
      <FieldRenderer
        field={textField({ required: true })}
        value=""
        onChange={vi.fn()}
        fieldState={{ errors: [{ source: "internal", message: "Name is required" }] }}
      />,
    );
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  describe("renderBottomChildren", () => {
    it("renders the content returned for this field's name below the widget", () => {
      render(
        <FieldRenderer
          field={textField()}
          value="Acme"
          onChange={vi.fn()}
          renderBottomChildren={(fieldName) => `extra for ${fieldName}`}
        />,
      );
      expect(screen.getByText("extra for name")).toBeInTheDocument();
    });

    it("renders nothing extra when the callback returns null for this field", () => {
      render(
        <FieldRenderer
          field={textField()}
          value="Acme"
          onChange={vi.fn()}
          renderBottomChildren={(fieldName) => (fieldName === "other-field" ? "shown" : null)}
        />,
      );
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.queryByText("shown")).not.toBeInTheDocument();
    });
  });
});
