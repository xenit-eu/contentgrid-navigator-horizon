import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveTemplate } from "@contentgrid/navigator-data";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { FieldDescriptor } from "../model/field-descriptor";
import {
  type UseEntityItemCreateFormStateOptions,
  useEntityItemCreateFormState,
} from "./use-entity-item-create-form-state";

/** `use-entity-item-create-form-state.ts` never reads `.property` itself — every field it cares about
 * (`kind`, `label`, `required`, ...) is a typed sibling on the descriptor — so a dummy stand-in
 * is enough here, mirroring the DUMMY_LINK pattern in
 * packages/ui/src/patterns/form-renderers/test-fixtures.ts. */
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

const activeField: FieldDescriptor = {
  name: "active",
  label: "Active",
  required: false,
  readOnly: false,
  kind: "boolean",
  property: DUMMY_PROPERTY,
};

const tagsField: FieldDescriptor = {
  name: "tags",
  label: "Tags",
  required: false,
  readOnly: false,
  kind: "enum",
  options: [],
  multiValue: true,
  property: DUMMY_PROPERTY,
};

const attachmentField: FieldDescriptor = {
  name: "attachment",
  label: "Attachment",
  required: false,
  readOnly: false,
  kind: "file",
  multiple: false,
  property: DUMMY_PROPERTY,
};

describe("useEntityItemCreateFormState — initial values", () => {
  it("seeds a type-appropriate default when no initial value is given", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({
        fields: [nameField, totalField, activeField, tagsField, attachmentField],
      }),
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
      useEntityItemCreateFormState({ fields: [nameField], initialValues: { name: "Acme" } }),
    );
    expect(result.current.values.name).toBe("Acme");
  });
});

describe("useEntityItemCreateFormState — setValue and isDirty", () => {
  it("updates the named value", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.values.name).toBe("Acme");
  });

  it("is not dirty before any change", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    expect(result.current.isDirty).toBe(false);
  });

  it("is dirty after a value changes", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.isDirty).toBe(true);
  });

  it("clears an internal error on the field being edited", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.validate());
    expect(result.current.fieldState.name?.errors).toBeDefined();
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });
});

describe("useEntityItemCreateFormState — setValues (bulk)", () => {
  it("applies several values in one call", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField, activeField] }),
    );
    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.values).toMatchObject({ name: "Acme", total: 42 });
  });

  it("leaves fields not present in the partial untouched", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    act(() => result.current.setValue("total", 7));
    act(() => result.current.setValues({ name: "Acme" }));
    expect(result.current.values).toMatchObject({ name: "Acme", total: 7 });
  });

  it("clears internal errors for every field included in the partial", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, { ...totalField, required: true }] }),
    );
    act(() => result.current.validate());
    expect(result.current.fieldState.name?.errors).toBeDefined();
    expect(result.current.fieldState.total?.errors).toBeDefined();

    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
    expect(result.current.fieldState.total?.errors).toBeUndefined();
  });

  it("marks the form dirty", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    act(() => result.current.setValues({ name: "Acme", total: 42 }));
    expect(result.current.isDirty).toBe(true);
  });
});

describe("useEntityItemCreateFormState — touchField", () => {
  it("shows a required field's error as soon as it's touched empty, without calling validate", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    expect(result.current.fieldState.name?.errors).toBeUndefined();

    act(() => result.current.touchField("name"));
    expect(result.current.fieldState.name?.errors).toEqual([
      { source: "internal", message: "Name is required" },
    ]);
  });

  it("shows nothing for a touched non-required field left empty", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [totalField] }));
    act(() => result.current.touchField("total"));
    expect(result.current.fieldState.total?.errors).toBeUndefined();
  });

  it("clears the touched error live once the field is filled in", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.touchField("name"));
    expect(result.current.fieldState.name?.errors).toBeDefined();

    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });

  it("re-shows the error if a touched field is cleared back out again", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.touchField("name"));
    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();

    act(() => result.current.setValue("name", ""));
    expect(result.current.fieldState.name?.errors).toBeDefined();
  });

  it("does not flag an untouched required field before any submit attempt", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    act(() => result.current.touchField("total"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });
});

describe("useEntityItemCreateFormState — validate", () => {
  it("flags empty required fields", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    let isValid = true;
    act(() => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(result.current.fieldState.name?.errors).toEqual([
      { source: "internal", message: "Name is required" },
    ]);
    expect(result.current.fieldState.total?.errors).toBeUndefined();
  });

  it("passes when every required field is filled", () => {
    const { result } = renderHook(() => useEntityItemCreateFormState({ fields: [nameField] }));
    act(() => result.current.setValue("name", "Acme"));
    let isValid = false;
    act(() => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(true);
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });
});

describe("useEntityItemCreateFormState — error precedence", () => {
  const alreadyTaken = [{ source: "external", message: "Already taken" }] as const;

  it("merges external errors in", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField], externalErrors: { name: alreadyTaken } }),
    );
    expect(result.current.fieldState.name?.errors).toEqual(alreadyTaken);
  });

  it("internal errors override external errors for the same field", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField], externalErrors: { name: alreadyTaken } }),
    );
    act(() => result.current.validate());
    expect(result.current.fieldState.name?.errors).toEqual([
      { source: "internal", message: "Name is required" },
    ]);
  });

  it("dismisses a field's external error as soon as the user edits that field", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField], externalErrors: { name: alreadyTaken } }),
    );
    expect(result.current.fieldState.name?.errors).toEqual(alreadyTaken);

    act(() => result.current.setValue("name", "A different name"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });

  it("dismisses every field touched by a bulk setValues call", () => {
    const outOfRange = [{ source: "external" as const, message: "Out of range" }];
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({
        fields: [nameField, totalField],
        externalErrors: { name: alreadyTaken, total: outOfRange },
      }),
    );
    act(() => result.current.setValues({ name: "Acme", total: 1 }));
    expect(result.current.fieldState.name?.errors).toBeUndefined();
    expect(result.current.fieldState.total?.errors).toBeUndefined();
  });

  it("makes a dismissed external error visible again after the next submit, even with the same message", () => {
    const { result, rerender } = renderHook(
      (props: UseEntityItemCreateFormStateOptions) => useEntityItemCreateFormState(props),
      {
        initialProps: {
          fields: [nameField],
          externalErrors: { name: alreadyTaken },
        } as UseEntityItemCreateFormStateOptions,
      },
    );
    act(() => result.current.setValue("name", "A different name"));
    expect(result.current.fieldState.name?.errors).toBeUndefined();

    // Mirrors CreateEntityItemContainer.handleSubmit: externalErrors is cleared to {} at the
    // start of every submit attempt, then repopulated in onError. The dismissal reset relies
    // on that intermediate empty state — content comparison alone can't otherwise distinguish
    // "still the same pending result" from "a new attempt landed the same message."
    rerender({ fields: [nameField], externalErrors: {} });
    rerender({ fields: [nameField], externalErrors: { name: alreadyTaken } });
    expect(result.current.fieldState.name?.errors).toEqual(alreadyTaken);
  });
});

describe("useEntityItemCreateFormState — reset", () => {
  it("restores the initial values and clears internal errors", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField], initialValues: { name: "Acme" } }),
    );
    act(() => result.current.setValue("name", "Changed"));
    act(() => result.current.validate());
    act(() => result.current.reset());
    expect(result.current.values.name).toBe("Acme");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });
});

describe("useEntityItemCreateFormState — buildValues", () => {
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
  const template = resolveTemplate(
    profileJson as unknown as Parameters<typeof resolveTemplate>[0],
    "create-form",
  )!;

  it("encodes only the fields that have a value", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    act(() => result.current.setValue("name", "Acme"));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("omits an empty-string value", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, totalField] }),
    );
    act(() => result.current.setValue("name", "Acme"));
    act(() => result.current.setValue("total", ""));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("omits an untouched multi-value enum/to-many-relation field's empty-array default", () => {
    // Regression: the HAL-FORMS codec rejects an empty list for a multi-value property
    // outright, so an untouched tags field (default `[]`) must never reach `withValue` — it
    // previously crashed every submit that included one.
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, tagsField] }),
    );
    act(() => result.current.setValue("name", "Acme"));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme" });
  });

  it("encodes a non-empty multi-value enum field", () => {
    const { result } = renderHook(() =>
      useEntityItemCreateFormState({ fields: [nameField, tagsField] }),
    );
    act(() => result.current.setValue("name", "Acme"));
    act(() => result.current.setValue("tags", ["a", "b"]));
    const values = result.current.buildValues(template);
    expect(values.valueMap).toEqual({ name: "Acme", tags: ["a", "b"] });
  });
});
