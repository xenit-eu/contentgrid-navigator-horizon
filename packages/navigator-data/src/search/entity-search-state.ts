/**
 * Generic URL search state for entity routes — a string-only key/value bag.
 * `cursor` is the only field in use today, but this isn't typed to that one
 * field: future URL-state params (sort, filters, ...) ride the same bag
 * without needing a new type or a new validator.
 */
export type EntitySearchState = Record<string, string | undefined>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  const result: EntitySearchState = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

export function extractCursorFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href).searchParams.get("_cursor") ?? undefined;
  } catch {
    return undefined;
  }
}
