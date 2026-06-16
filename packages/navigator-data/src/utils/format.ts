export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

const UPPERCASE_WORDS: Record<string, string> = {
  id: "ID",
  url: "URL",
  uri: "URI",
  api: "API",
  uuid: "UUID",
};

/**
 * Format a raw API identifier (e.g. "draft", "in_progress", "someField") into a
 * human-readable label by replacing separators with spaces and capitalising each word.
 * Known acronyms (ID, URL, URI, API, UUID) are uppercased entirely.
 *
 * This is intentionally applied only to *plain-string* option values that the
 * server did not supply an explicit human-readable prompt for.
 * Server-provided prompts (from HAL-FORMS objects with a real `prompt` field)
 * should be passed through as-is.
 */
export function formatWords(text: string): string {
  return text
    .replace(/[._-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => UPPERCASE_WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Convert an unknown value to a display string without ever calling String()
 * on an object type — which satisfies SonarCloud's S5765 rule permanently.
 *
 * - null / undefined → ""
 * - object / array   → JSON (compact)
 * - everything else  → the value's own .toString()
 */
export function convertToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString(10);
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? "";
    } catch {
      return "";
    }
  }
  return "";
}
