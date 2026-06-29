import { z } from "zod";

export const entitySearchStateSchema = z.object({
  "s.cursor": z.string().optional(),
});

export type EntitySearchState = z.infer<typeof entitySearchStateSchema>;

export function entitySearchStateValidator(search: Record<string, unknown>): EntitySearchState {
  const result = entitySearchStateSchema.safeParse(search);
  return result.success ? result.data : {};
}
