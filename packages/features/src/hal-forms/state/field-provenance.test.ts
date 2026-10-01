import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";
import { canApplyExternalValue } from "./field-provenance";
import { useHalFormsFieldState } from "./use-hal-forms-field-state";

describe("canApplyExternalValue", () => {
  it("allows an external write when the field is not focused", () => {
    expect(canApplyExternalValue(false)).toBe(true);
  });

  it("blocks an external write when the field is focused", () => {
    expect(canApplyExternalValue(true)).toBe(false);
  });
});

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const emailField: HalFormsField = {
  name: "email",
  label: "Email",
  required: false,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

describe("useHalFormsFieldState.setExternalValue", () => {
  it("updates value and provenance on an unfocused field", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [emailField] }));

    act(() => result.current.setExternalValue("email", "a@b.com", "filled by automation X"));

    expect(result.current.values.email).toBe("a@b.com");
    expect(result.current.fieldState.email?.provenance).toBe("filled by automation X");
  });

  it("is a no-op on the value while the field is focused", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [emailField] }));

    act(() => result.current.focusField("email"));
    act(() => result.current.setExternalValue("email", "a@b.com", "filled by automation X"));

    expect(result.current.values.email).toBe("");
    expect(result.current.fieldState.email).toBeUndefined();
  });

  it("applies once the field is blurred again", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [emailField] }));

    act(() => result.current.focusField("email"));
    act(() => result.current.setExternalValue("email", "a@b.com", "filled by automation X"));
    act(() => result.current.blurField("email"));
    act(() => result.current.setExternalValue("email", "a@b.com", "filled by automation X"));

    expect(result.current.values.email).toBe("a@b.com");
  });

  it("leaves a field's provenance unset when none is supplied", () => {
    const { result } = renderHook(() => useHalFormsFieldState({ fields: [emailField] }));

    expect(result.current.fieldState.email).toBeUndefined();
  });
});
