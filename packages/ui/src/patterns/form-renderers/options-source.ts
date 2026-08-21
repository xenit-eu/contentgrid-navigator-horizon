import type { FieldOption, FieldOptionsSource } from "@contentgrid/navigator-data/schema";

/**
 * `EnumRenderer` and `EnumMultiRenderer` only render inline options — resolving
 * a `"remote"` source's link is a data-fetching concern that belongs in
 * `packages/navigator-data`, not here (see packages/ui/CLAUDE.md's "remote
 * option fetching stays out of packages/ui" rule).
 */
export function resolveInlineOptions(source: FieldOptionsSource): readonly FieldOption[] {
  return source.kind === "inline" ? source.options : [];
}
