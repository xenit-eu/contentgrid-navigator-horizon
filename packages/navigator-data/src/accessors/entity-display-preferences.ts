import { z } from "zod/v4";

/**
 * Growable schema: adding a new field here is the only change needed to support a new
 * preference kind end-to-end — the merge in `useEntityDisplayPreferences`
 * (packages/features/src/preferences) is field-name-agnostic (uses `deepMerge`, not a
 * per-field switch), so no other plumbing changes are required.
 *
 * `nameAttribute` holds the attribute NAME (not a resolved `ProfileAttribute`) because the
 * backend-defaults and user-override layers only ever know attribute names — resolving to a
 * `ProfileAttribute` happens once, after merging, in the composed hook.
 */
export const entityDisplayPreferencesSchema = z.object({
  nameAttribute: z.string().optional(),
  visibleColumns: z.array(z.string()).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  cardStyle: z.string().optional(),
});

export type EntityDisplayPreferences = z.infer<typeof entityDisplayPreferencesSchema>;

/** Per-entity-name map, as returned by the backend display-defaults endpoint. */
export const entityDisplayPreferencesMapSchema = z.record(
  z.string(),
  entityDisplayPreferencesSchema,
);

export type EntityDisplayPreferencesMap = z.infer<typeof entityDisplayPreferencesMapSchema>;

export function validateEntityDisplayPreferencesMap(
  data: unknown,
): { success: true; data: EntityDisplayPreferencesMap } | { success: false; error: string } {
  const result = entityDisplayPreferencesMapSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: z.prettifyError(result.error) };
}
