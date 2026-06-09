export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
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
