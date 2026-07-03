import { z } from "zod";

const entitySearchStateSchema = z.object({
  "s.cursor": z.string().optional().catch(undefined),
});

export type EntitySearchState = z.infer<typeof entitySearchStateSchema>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  // Per-field .catch(undefined) coerces an invalid s.cursor to absent instead
  // of failing the whole parse and wiping sibling params. Because of that,
  // .parse() here can never throw — every field has a fallback.
  return entitySearchStateSchema.parse(search);
}
