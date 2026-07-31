/** A single filterable search parameter, as returned from the HAL-Forms profile. */
export interface SearchProperty {
  /** Parameter name; suffixed with `~op` for a non-exact-match operator (e.g. "created~gt", "name~prefix"). Bare name (no suffix) means exact-match. */
  name: string;
  /** Optional human-readable label */
  prompt?: string;
  /** The HAL-FORMS property type (e.g. "text", "number", "datetime", "checkbox", "url", "file") — never a domain type like "string". */
  type: string;
  /** Available values for enum-like fields. Inline options here are always a flat string list (e.g. allowed-values) — the `_sort` property's richer object-array options are a distinct shape and are not expected to flow through this type. */
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
    .filter(Boolean)
    .map((w) => UPPERCASE_WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extract base field name and operator from the platform's `field~op` search-param naming
 * (e.g. "name~prefix", "long~gt", "datetime~after"). The operator is always a short suffix
 * after a single `~` — there is no dot-prefixed range-pair variant on this platform.
 * Bare names (no `~`) are exact-match and return `op: null`.
 */
export function parseName(name: string): { base: string; op: string | null } {
  const tildeIdx = name.indexOf("~");
  if (tildeIdx === -1) return { base: name, op: null };
  return { base: name.slice(0, tildeIdx), op: name.slice(tildeIdx + 1) };
}

export function formatFieldLabel(prop: SearchProperty): string {
  if (prop.prompt) return prop.prompt;
  return formatWords(parseName(prop.name).base);
}

/**
 * Operator suffix → human-readable label. Keys are the platform's actual `~op` search-param
 * suffixes (confirmed against the committed profile dump and `SearchHalFormTemplate.extractSearchType`
 * in `@contentgrid/navigator-data`) — NOT the long-form `blueprint:search-param[].type` vocabulary
 * (e.g. "greater-than"), which never appears in a property `name`.
 */
export const SEARCH_TYPE_LABELS: Record<string, string> = {
  prefix: "prefix",
  fts: "contains",
  gt: "after",
  gte: "from",
  lt: "before",
  lte: "until",
  after: "after",
  before: "before",
  from: "from",
  until: "until",
};

/** Raw operator keys whose translated label should be suppressed in chip display. */
export const IMPLICIT_OPS = new Set(["prefix"]);

const DATE_FIELD_TYPES = new Set(["date", "datetime", "datetime-local", "time"]);
/** Suffixes confirmed to be used only for datetime ranges — `~gt`/`~gte`/`~lt`/`~lte` are excluded
 * because the platform also uses them for plain numeric ranges (e.g. "long~gt"). */
const DATE_SUFFIXES = ["~after", "~before"];

/** True when a search property's value is a date that may arrive as an ISO string. */
export function isDateProperty(name: string, type: string): boolean {
  if (DATE_FIELD_TYPES.has(type)) return true;
  return DATE_SUFFIXES.some((s) => name.endsWith(s));
}
