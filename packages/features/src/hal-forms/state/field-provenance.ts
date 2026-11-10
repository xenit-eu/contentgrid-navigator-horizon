/**
 * FR-012: an external value write must not silently overwrite a field the user is actively
 * editing — the user's in-progress edit wins. `isFieldFocused` reflects whatever the caller
 * currently considers "being edited" (see `useHalFormsFieldState`'s `focusField`/`blurField`).
 */
export function canApplyExternalValue(isFieldFocused: boolean): boolean {
  return !isFieldFocused;
}
