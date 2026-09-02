import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { ProfileEntityShape } from "../shapes";
import type { RenderFieldDescriptor } from "./render-field-descriptor";
import { type UseFormFieldsOptions, useFormFields } from "./use-form-fields";

const nameField: RenderFieldDescriptor = {
  name: "name",
  label: "Name",
  required: true,
  readOnly: false,
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
  type: "number",
};

const activeField: RenderFieldDescriptor = {
  name: "active",
  label: "Active",
  required: false,
  readOnly: false,
  type: "boolean",
};

const tagsField: RenderFieldDescriptor = {
  name: "tags",
  label: "Tags",
  required: false,
  readOnly: false,
  type: "enum-multi",
  optionsSource: { kind: "inline", options: [] },
};

const attachmentField: RenderFieldDescriptor = {
  name: "attachment",
  label: "Attachment",
  required: false,
  readOnly: false,
  type: "file",
  multiple: false,
};

describe("useFormFields — initial values", () => {
  it("seeds a type-appropriate default when no initial value is given", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField, totalField, activeField, tagsField, attachmentField] }),
    );
    expect(result.current.values).toEqual({
      name: "",
      total: "",
      active: undefined,
      tags: [],
      attachment: undefined,
    });
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

describe("useFormFields — setValues (bulk)", () => {
  it("applies several values in one call", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField, totalField, activeField] }),
    );
    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.values).toMatchObject({ name: "Acme", total: 42 });
  });

  it("leaves fields not present in the partial untouched", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, totalField] }));
    act(() => result.current.setValue("total", 7));
    act(() => result.current.setValues({ name: "Acme" }));
    expect(result.current.values).toMatchObject({ name: "Acme", total: 7 });
  });

  it("clears client errors for every field included in the partial", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField, { ...totalField, required: true }] }),
    );
    act(() => result.current.validate());
    expect(result.current.errors.name).toBeDefined();
    expect(result.current.errors.total).toBeDefined();

    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.total).toBeUndefined();
  });

  it("marks the form dirty", () => {
    const { result } = renderHook(() => useFormFields({ fields: [nameField, totalField] }));
    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.isDirty).toBe(true);
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

  it("dismisses a field's server error as soon as the user edits that field", () => {
    const { result } = renderHook(() =>
      useFormFields({ fields: [nameField], serverErrors: { name: "Already taken" } }),
    );
    expect(result.current.errors.name).toBe("Already taken");

    act(() => result.current.setValue("name", "A different name"));
    expect(result.current.errors.name).toBeUndefined();
  });

  it("dismisses every field touched by a bulk setValues call", () => {
    const { result } = renderHook(() =>
      useFormFields({
        fields: [nameField, totalField],
        serverErrors: { name: "Already taken", total: "Out of range" },
      }),
    );
    act(() => result.current.setValues({ name: "Acme", total: 1 }));
    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.total).toBeUndefined();
  });

  it("makes a dismissed server error visible again after the next submit, even with the same message", () => {
    const { result, rerender } = renderHook((props: UseFormFieldsOptions) => useFormFields(props), {
      initialProps: {
        fields: [nameField],
        serverErrors: { name: "Already taken" },
      } as UseFormFieldsOptions,
    });
    act(() => result.current.setValue("name", "A different name"));
    expect(result.current.errors.name).toBeUndefined();

    // Mirrors CreateEntityItemFormFields.handleSubmit: serverErrors is cleared to {} at the
    // start of every submit attempt, then repopulated in onError. The dismissal reset relies
    // on that intermediate empty state — content comparison alone can't otherwise distinguish
    // "still the same pending result" from "a new attempt landed the same message."
    rerender({ fields: [nameField], serverErrors: {} });
    rerender({ fields: [nameField], serverErrors: { name: "Already taken" } });
    expect(result.current.errors.name).toBe("Already taken");
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
