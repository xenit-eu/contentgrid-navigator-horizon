/**
 * useEntityCapabilities
 *
 * Derives RBAC-aware capability flags from HAL-FORMS template presence.
 *
 * Under ContentGrid ABAC the platform silently omits HAL-FORMS templates for
 * operations the current user is not permitted to perform:
 *   - `create-form` on the entity profile  → user may create items
 *   - `default` on an entity item          → user may update that item
 *   - `delete` on an entity item           → user may delete that item
 *   - `set-<rel>` / `add-<rel>` / `clear-<rel>` on an item → relation ops
 *
 * This hook composes useEntitySchema + useEntityDetail and returns a small
 * capabilities object the UI gates affordances on.
 *
 * Hook point for HZN-7.4: extend EntityCapabilities here as more operations
 * are implemented.
 *
 * Fallback: when capability data is unavailable (hooks loading or errored)
 * all capability flags default to `true` so a real backend that DOES expose
 * templates can drive hiding.  The fallback being permissive means the UI
 * shows affordances until the platform actively denies them.
 */
import { useEntityDetail } from "./use-entity-detail";
import { useEntitySchema } from "./use-entity-schema";

export interface EntityCapabilities {
  /**
   * Whether the current user may create new items of this entity type.
   * Derived from the presence of a `create-form` template in the entity profile.
   */
  canCreate: boolean;
  /**
   * Whether the current user may update the current item.
   * Derived from the presence of a `default` template on the item.
   * `undefined` when no itemId is provided (collection-level context).
   */
  canEdit: boolean | undefined;
  /**
   * Whether the current user may delete the current item.
   * Derived from the presence of a `delete` template on the item.
   * `undefined` when no itemId is provided (collection-level context).
   */
  canDelete: boolean | undefined;
  /**
   * Returns whether the current user may perform link/unlink for a named
   * relation.  Checks for any of: `set-<rel>`, `add-<rel>`, `clear-<rel>`.
   * Returns `undefined` when no itemId is provided.
   */
  canLinkRelation: (relationName: string) => boolean | undefined;
}

/**
 * Returns RBAC capabilities for the given entity collection.
 *
 * When `itemId` is supplied the item-level templates are also inspected.
 * Omit `itemId` (or pass `undefined`) for collection-level contexts where
 * only `canCreate` is relevant.
 */
export function useEntityCapabilities(entityName: string, itemId?: string): EntityCapabilities {
  const schema = useEntitySchema(entityName);
  const detail = useEntityDetail(entityName, itemId ?? "");

  // Schema-level: create allowed ⇔ create-form template present.
  // Fallback to true so affordances show when schema is still loading.
  const canCreate: boolean = schema.data ? schema.data.canCreate : true;

  if (!itemId) {
    // Collection-level context — item caps are not applicable.
    return {
      canCreate,
      canEdit: undefined,
      canDelete: undefined,
      canLinkRelation: () => undefined,
    };
  }

  // Item-level: template presence in availableTemplates.
  // Fallback to true while the item is loading.
  const templates = detail.data?.availableTemplates;

  const canEdit: boolean = templates ? templates.has("default") : true;
  const canDelete: boolean = templates ? templates.has("delete") : true;

  function canLinkRelation(relationName: string): boolean {
    if (!templates) return true;
    return (
      templates.has(`set-${relationName}`) ||
      templates.has(`add-${relationName}`) ||
      templates.has(`clear-${relationName}`)
    );
  }

  return { canCreate, canEdit, canDelete, canLinkRelation };
}
