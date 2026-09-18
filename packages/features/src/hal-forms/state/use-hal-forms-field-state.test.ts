import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type HalFormsProperty, resolveTemplate } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";
import { useHalFormsFieldState } from "./use-hal-forms-field-state";

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const nameField: HalFormsField = {
  name: "name",
  label: "Name",
  required: true,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

const emailField: HalFormsField = {
  name: "email",
  label: "Email",
  required: false,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

describe("useHalFormsFieldState", () => {
  it("shows a live client error for a touched, empty required field with no network call", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField] }));

    act(() => result.current.touchField("name"));

    expect(result.current.fieldState.name?.errors).toEqual([
      { source: "client", message: "Name is required" },
    ]);
  });

  it("does not show a required error before the field is touched", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField] }));
    expect(result.current.fieldState.name).toBeUndefined();
  });

  it("shows an externally-injected server error anchored to its field", () => {
    const { result } = renderHook(() =>
      useHalFormsFieldState({
        fields: [emailField],
        externalErrors: { email: [{ source: "server", message: "Email already in use" }] },
      }),
    );

    expect(result.current.fieldState.email?.errors).toEqual([
      { source: "server", message: "Email already in use" },
    ]);
  });

  it("runs a caller-supplied validation function against the current value", () => {
    const { result } = renderHook(() =>
      useHalFormsFieldState({
        fields: [emailField],
        fieldValidators: { email: (value) => (value === "bad" ? "Invalid email" : undefined) },
      }),
    );

    act(() => result.current.setValue("email", "bad"));
    act(() => result.current.touchField("email"));

    expect(result.current.fieldState.email?.errors).toEqual([
      { source: "client", message: "Invalid email" },
    ]);
  });

  it("clears a field's error once its value becomes valid", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField] }));

    act(() => result.current.touchField("name"));
    expect(result.current.fieldState.name).toBeDefined();

    act(() => result.current.setValue("name", "Acme"));
    expect(result.current.fieldState.name).toBeUndefined();
  });

  it("dismisses a field's external error once the user edits that field", () => {
    const { result } = renderHook(() =>
      useHalFormsFieldState({
        fields: [emailField],
        externalErrors: { email: [{ source: "server", message: "Email already in use" }] },
      }),
    );

    act(() => result.current.setValue("email", "new@example.com"));

    expect(result.current.fieldState.email).toBeUndefined();
  });

  it("is not dirty until a value changes from its initial value", () => {
    const { result } = renderHook(() =>
      useHalFormsFieldState({ fields: [nameField], initialValues: { name: "Acme" } }),
    );
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.setValue("name", "Acme Corp"));
    expect(result.current.isDirty).toBe(true);
  });

  it("applies several values at once via setValues", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField, emailField] }));

    act(() => result.current.setValues({ name: "Acme", email: "a@b.com" }));

    expect(result.current.values).toEqual({ name: "Acme", email: "a@b.com" });
  });

  it("resets values, touched state, and isDirty back to the initial values", () => {
    const { result } = renderHook(() =>
      useHalFormsFieldState({ fields: [nameField], initialValues: { name: "Acme" } }),
    );

    act(() => result.current.setValue("name", "Changed"));
    act(() => result.current.touchField("name"));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.reset());

    expect(result.current.values.name).toBe("Acme");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.fieldState.name?.errors).toBeUndefined();
  });
});

describe("useHalFormsFieldState.buildValues", () => {
  const templateJson = {
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
        ],
      },
    },
  };
  const template = resolveTemplate(
    templateJson as unknown as Parameters<typeof resolveTemplate>[0],
    "create-form",
  )!;

  const totalField: HalFormsField = {
    name: "total",
    label: "Total",
    required: false,
    readOnly: false,
    kind: "number",
    property: DUMMY_PROPERTY,
  };

  it("encodes only the fields that have a value", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField, totalField] }));
    act(() => result.current.setValue("name", "Acme"));

    expect(result.current.buildValues(template).valueMap).toEqual({ name: "Acme" });
  });

  it("omits an empty-string value", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [nameField, totalField] }));
    act(() => result.current.setValue("name", "Acme"));
    act(() => result.current.setValue("total", ""));

    expect(result.current.buildValues(template).valueMap).toEqual({ name: "Acme" });
  });
});
