import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { ProfileEntityShape } from "../shapes";
import type { RenderFieldDescriptor } from "./render-field-descriptor";
import { useFormFields } from "./use-form-fields";

const DUMMY_PROPERTY = {} as RenderFieldDescriptor["property"];

const nameField: RenderFieldDescriptor = {
  name: "name",
  label: "Name",
  required: true,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "text",
  regex: /.*/,
  minLength: 0,
  maxLength: 0,
};

const totalField: RenderFieldDescriptor = {
  name: "total",
  label: "Total",
  required: false,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "number",
};

const activeField: RenderFieldDescriptor = {
  name: "active",
  label: "Active",
  required: false,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "boolean",
};

const tagsField: RenderFieldDescriptor = {
  name: "tags",
  label: "Tags",
  required: false,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "enum-multi",
  optionsSource: { kind: "inline", options: [] },
};

const attachmentField: RenderFieldDescriptor = {
  name: "attachment",
  label: "Attachment",
  required: false,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "file",
  multiple: false,
};

const validityField: RenderFieldDescriptor = {
  name: "validity",
  label: "Validity",
  required: true,
  readOnly: false,
  property: DUMMY_PROPERTY,
  type: "date-range",
  from: { name: "valid_from", label: "Valid from" },
  until: { name: "valid_until", label: "Valid until" },
};

describe("useFormFields — initial values", () => {
  it("seeds a type-appropriate default when no initial value is given", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField, totalField, activeField, tagsField, attachmentField] }),
    );
    expect(result.current.values).toEqual({
      name: "",
      total: "",
      active: false,
      tags: [],
      attachment: undefined,
    });
  });

  it("seeds a date-range field's from/until sub-properties independently", () => {
    const { result } = renderHook(() => useFormFields({ fields: [validityField] }));
    expect(result.current.values).toEqual({ valid_from: "", valid_until: "" });
  });

  it("uses a supplied initial value over the type default", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField], initialValues: { name: "Acme" } }),
    );
    expect(result.current.values.name).toBe("Acme");
  });
});

describe("useFormFields — setValue and isDirty", () => {
  it("updates the named value", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.values.name).toBe("Acme");
  });

  it("is not dirty before any change", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField] }));
    expect(result.current.isDirty).toBe(false);
  });

  it("is dirty after a value changes", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.isDirty).toBe(true);
  });

  it("clears a client error on the field being edited", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField] }));
    act(() => result.current.validate());
    expect(result.current.errors.name).toBeDefined();
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.errors.name).toBeUndefined();
  });
});

describe("useFormFields — validate", () => {
  it("flags empty required fields", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, totalField] }));
    let isValid = true;
    act(() => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(result.current.errors.name).toBe("Name is required");
    expect(result.current.errors.total).toBeUndefined();
  });

  it("passes when every required field is filled", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    let isValid = false;
    act(() => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(true);
    expect(result.current.errors.name).toBeUndefined();
  });

  it("expands a required date-range field into its from/until sub-properties", () => {
    const { result } = renderHook(() => useFormFields({ fields: [validityField] }));
    act(() => result.current.validate());
    expect(result.current.errors.valid_from).toBe("Valid from is required");
    expect(result.current.errors.valid_until).toBe("Valid until is required");
  });
});

describe("useFormFields — error precedence", () => {
  it("merges server errors in", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField], serverErrors: { name: "Already taken" } }),
    );
    expect(result.current.errors.name).toBe("Already taken");
  });

  it("client errors override server errors for the same field", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField], serverErrors: { name: "Already taken" } }),
    );
    act(() => result.current.validate());
    expect(result.current.errors.name).toBe("Name is required");
  });
});

describe("useFormFields — reset", () => {
  it("restores the initial values and clears client errors", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField], initialValues: { name: "Acme" } }),
    );
    act(() => result.current.setValue("name", "Changed"));
    act(() => result.current.validate());
    act(() => result.current.reset());
    expect(result.current.values.name).toBe("Acme");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.errors.name).toBeUndefined();
  });
});

describe("useFormFields — buildValues", () => {
  const profileJson = {
    name: "invoice",
    description: "",
    _links: { self: { href: "https://example.com/profile/invoices" } },
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _templates: {
      "create-form": {
        method: "POST",
        target: "https://example.com/invoices",
        contentType: "application/json",
        properties: [
          { name: "name", type: "text", required: true },
          { name: "total", type: "number" },
          { name: "tags", type: "text", options: { maxItems: 5, inline: ["a", "b"] } },
        ],
      },
    },
  };
  const template = resolveTemplate(profileJson as unknown as ProfileEntityShape, "create-form")!;

  it("encodes only the fields that have a value", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, totalField] }));
    act(() => result.current.setValue("name", "Acme"));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("omits an empty-string value", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, totalField] }));
    act(() => result.current.setValue("name", "Acme"));
    act(() => result.current.setValue("total", ""));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("omits an untouched enum-multi/relation-to-many field's empty-array default", () => {
    // Regression: the HAL-FORMS codec rejects an empty list for a multi-value
    // property outright, so an untouched tags/enum-multi field (default `[]`)
    // must never reach `withValue` — it previously crashed every submit that
    // included one.
    const { result } = renderHook(() => useFormFields({ fields: [nameField, tagsField] }));
    act(() => result.current.setValue("name", "Acme"));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("encodes a non-empty enum-multi value", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, tagsField] }));
    act(() => result.current.setValue("name", "Acme"));
    act(() => result.current.setValue("tags", ["a", "b"]));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme", tags: ["a", "b"] });
  });
});
