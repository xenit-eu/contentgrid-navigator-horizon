import { filterOptionsByPrefix } from "@contentgrid/ui";
import { classifySearchInput, normaliseNumberInput } from "./classify-search-input";
import type { SearchParamDescriptor } from "./types";

export type ParamValueValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

/**
 * The value to apply when the user presses Enter with a parameter selected (FR-020), or why it
 * cannot be applied:
 * - integer: a whole number; decimal: a plain decimal (a decimal comma is accepted), sent as typed
 *   (normalised to a `.` separator) — never rounded or written in exponent notation;
 * - allowed values: one of the options — matched on its label or token, or the single option
 *   the text narrows the list to;
 * - text: the typed text as is (a prefix parameter then searches by that prefix).
 */
export function validateParamValue(
  descriptor: SearchParamDescriptor,
  raw: string,
): ParamValueValidation {
  const input = raw.trim();
  switch (descriptor.valueKind) {
    case "integer":
    case "decimal": {
      // Validated as text and sent as typed: a round trip through a float would lose precision
      // on large integers and could produce exponent notation.
      const kind = classifySearchInput(input);
      if (kind === "empty" || kind === "text") return { ok: false, error: "Enter a number" };
      if (descriptor.valueKind === "integer" && kind === "decimal") {
        return { ok: false, error: "Enter a whole number" };
      }
      return { ok: true, value: normaliseNumberInput(input) };
    }
    case "allowed-values": {
      const options = descriptor.options ?? [];
      const lower = input.toLocaleLowerCase();
      const exact = options.find(
        (o) => o.label.toLocaleLowerCase() === lower || o.value.toLocaleLowerCase() === lower,
      );
      if (exact) return { ok: true, value: exact.value };
      const narrowed = filterOptionsByPrefix(options, input);
      if (narrowed.length === 1) return { ok: true, value: narrowed[0]!.value };
      return { ok: false, error: "Pick one of the allowed values" };
    }
    default:
      return { ok: true, value: input };
  }
}
