import type { FieldValue } from "@contentgrid/navigator-data";

/**
 * Narrows the form layer's `FieldValue` to the plain value type each `@contentgrid/ui` form
 * renderer takes. The renderers deliberately don't know `FieldValue` (so `packages/ui` has no
 * `@contentgrid/navigator-data` dependency and its renderers can ship through the shadcn
 * registry on their own) — this is the one place the two shapes meet. A value of an unexpected
 * type narrows to `undefined`, which every renderer shows as empty, same as it did when each
 * renderer narrowed `FieldValue` itself.
 */
export function asString(value: FieldValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumberOrString(value: FieldValue): number | string | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

export function asBoolean(value: FieldValue): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asDateOrString(value: FieldValue): Date | string | undefined {
  return value instanceof Date || typeof value === "string" ? value : undefined;
}

export function asStringArray(value: FieldValue): readonly string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}
