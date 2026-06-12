/** A single filterable search parameter, as returned from the HAL-Forms profile. */
export interface SearchProperty {
  /** Parameter name; may use `field~op` (e.g. "created~greater-than") or `field.~op` (range-pair, e.g. "created.~from") format */
  name: string;
  /** Optional human-readable label */
  prompt?: string;
  /** Data type, e.g. "string", "date", "datetime" */
  type: string;
  /** True when this property supports prefix-match typeahead. Set by the data layer; not derived here. */
  prefixSearchable?: boolean;
  /** Available values for enum-like fields */
  options?: { inline?: string[]; link?: { href: string } };
}

const UPPERCASE_WORDS: Record<string, string> = {
  id: "ID",
  url: "URL",
  uri: "URI",
  api: "API",
  uuid: "UUID",
};

export function formatWords(text: string): string {
  return text
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => UPPERCASE_WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extract base field name and operator from `field~op` (legacy) or `field.~op` (range-pair) patterns.
 * Legacy: op is the bare operator name, e.g. "greater-than".
 * Range-pair: op includes the leading tilde, e.g. "~from" — SEARCH_TYPE_LABELS keys reflect this.
 */
export function parseName(name: string): { base: string; op: string | null } {
  const dotTildeIdx = name.indexOf(".~");
  if (dotTildeIdx !== -1) {
    return { base: name.slice(0, dotTildeIdx), op: name.slice(dotTildeIdx + 1) };
  }
  const tildeIdx = name.indexOf("~");
  if (tildeIdx !== -1) {
    return { base: name.slice(0, tildeIdx), op: name.slice(tildeIdx + 1) };
  }
  return { base: name, op: null };
}

export function formatFieldLabel(prop: SearchProperty): string {
  if (prop.prompt) return prop.prompt;
  return formatWords(parseName(prop.name).base);
}

export const SEARCH_TYPE_LABELS: Record<string, string> = {
  "prefix-match": "prefix",
  "exact-match": "exact",
  "full-text": "contains",
  "greater-than": "after",
  "greater-than-or-equal": "from",
  "less-than": "before",
  "less-than-or-equal": "until",
  // Range-pair operators (dot-prefixed, used with `field.~op` key format)
  "~from": "from",
  "~until": "until",
  "~gte": "from",
  "~lte": "until",
};

/** Raw operator keys whose translated label should be suppressed in chip display. */
export const IMPLICIT_OPS = new Set(["prefix-match", "exact-match"]);

const DATE_FIELD_TYPES = new Set(["date", "datetime", "datetime-local", "time"]);
const DATE_SUFFIXES = [
  "~greater-than",
  "~greater-than-or-equal",
  "~less-than",
  "~less-than-or-equal",
  ".~from",
  ".~until",
];

/** True when a search property's value is a date that may arrive as an ISO string. */
export function isDateProperty(name: string, type: string): boolean {
  if (DATE_FIELD_TYPES.has(type)) return true;
  return DATE_SUFFIXES.some((s) => name.endsWith(s));
}
