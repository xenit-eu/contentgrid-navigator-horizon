import type { InputClass } from "./types";

const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d*[.,]\d+$/;

/**
 * What the typed input looks like (data-model.md §4): empty, a whole number, a decimal number
 * (a `.` or `,` decimal separator), or text. Decides which parameters the popover offers.
 */
export function classifySearchInput(raw: string): InputClass {
  const input = raw.trim();
  if (input === "") return "empty";
  if (INTEGER.test(input)) return "integer";
  if (DECIMAL.test(input)) return "decimal";
  return "text";
}

/** A number typed with a decimal comma, normalised to the `.` the wire format expects. */
export function normaliseNumberInput(raw: string): string {
  return raw.trim().replace(",", ".");
}
