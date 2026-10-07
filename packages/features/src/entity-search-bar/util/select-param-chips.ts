import type { InputClass, SearchParamDescriptor, SelectorMode } from "./types";

const TEXT_KINDS = new Set(["text", "allowed-values"]);
const SELECTABLE_MODES = new Set(["prefix", "full-text", "exact", "allowed-values"]);

/**
 * Whether a parameter can be chosen in the selector and offered as a popover chip (FR-007):
 * text (prefix, full-text, exact), allowed values, and exact integer / decimal parameters.
 * Ranges, dates and booleans are quick filters instead.
 */
export function isSelectableParam(descriptor: SearchParamDescriptor): boolean {
  return (
    SELECTABLE_MODES.has(descriptor.mode) &&
    (TEXT_KINDS.has(descriptor.valueKind) ||
      descriptor.valueKind === "integer" ||
      descriptor.valueKind === "decimal")
  );
}

/**
 * The parameter chips of the popover's top row, in display order (data-model.md §4, FR-013,
 * FR-021): text input hides number parameters; a number lists number parameters first (a
 * decimal only the decimal ones) and keeps every text parameter after them. Only in "All" /
 * "All except relations" mode — a selected parameter has no chip row.
 */
export function selectParamChips(
  descriptors: readonly SearchParamDescriptor[],
  inputClass: InputClass,
  mode: SelectorMode,
): SearchParamDescriptor[] {
  if (mode.kind === "param" || inputClass === "empty") return [];
  const eligible = descriptors.filter(
    (d) => isSelectableParam(d) && !(mode.kind === "all-direct" && d.relation),
  );
  const text = eligible.filter((d) => TEXT_KINDS.has(d.valueKind));
  switch (inputClass) {
    case "text":
      return text;
    case "integer":
      return [
        ...eligible.filter((d) => d.valueKind === "integer" || d.valueKind === "decimal"),
        ...text,
      ];
    case "decimal":
      return [...eligible.filter((d) => d.valueKind === "decimal"), ...text];
  }
}
