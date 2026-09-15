import { useCallback, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldValue, HalFormsProperty } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import { FormContainer } from "./form-container";

let numberRenderCount = 0;
vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    // Counts renders of the "total" field's underlying widget — the memoization fix under test
    // (`FieldRenderer` wrapped in `memo`, `FormField`'s per-field `useCallback` closures) is only
    // proven by an *unaffected* field's widget never re-rendering, not by the changed field's own
    // value showing up correctly (that's already covered above).
    NumberRenderer: (props: Parameters<typeof actual.NumberRenderer>[0]) => {
      numberRenderCount += 1;
      return <actual.NumberRenderer {...props} />;
    },
  };
});

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

  it("does not re-render an untouched field's widget when a sibling field's value changes", () => {
    function Harness() {
      const [values, setValues] = useState<{ name: string; total: FieldValue }>({
        name: "",
        total: 5,
      });
      // Stable across renders, like `formState.setValue` — see `use-entity-item-create-form-state.ts`.
      const onChange = useCallback((name: string, value: FieldValue) => {
        setValues((prev) => ({ ...prev, [name]: value }));
      }, []);
      return (
        <FormContainer
          fields={[nameField, totalField]}
          layout={{ groups: [{ fieldNames: ["name", "total"] }] }}
          values={values}
          onChange={onChange}
          fieldState={{}}
        />
      );
    }

    numberRenderCount = 0;
    render(<Harness />);
    expect(numberRenderCount).toBe(1);

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Ac" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Acme" } });

    expect(numberRenderCount).toBe(1);
  });
});
