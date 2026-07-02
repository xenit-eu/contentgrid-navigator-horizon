import { z } from "zod";

const entitySearchStateSchema = z.object({
  "s.cursor": z.string().optional().catch(undefined),
});

export type EntitySearchState = z.infer<typeof entitySearchStateSchema>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  // Per-field .catch(undefined) drops only the invalid field instead of
  // failing the whole safeParse and wiping sibling params.
  const result = entitySearchStateSchema.safeParse(search);
  return result.success ? result.data : {};
}
