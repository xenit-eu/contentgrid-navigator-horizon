import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { EntityItem } from "../accessors/entity-item";
import type ProfileEntity from "../accessors/entity-profile";
import { addIfMatchHeader, fetchHal, fetchVoid } from "../api/hal-client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import { useNavigatorData } from "./context";

/**
 * The operation to perform on a relation.
 *
 * - `set` — Replace a to-one relation (PUT text/uri-list with one href).
 * - `add` — Add to a to-many relation (POST text/uri-list with one or more hrefs).
 * - `clear` — Clear a relation (DELETE, no body).
 */
export type RelationOp = "set" | "add" | "clear";

/**
 * Variables passed to the relation mutation function.
 */
export type RelationMutationVariables = {
  /** The entity item whose relation is being modified. Provides template, ETag, and self href. */
  readonly entityItem: EntityItem;
  /** The name of the relation to modify (e.g. "supplier", "lineItems"). */
  readonly relationName: string;
  /** The operation to perform. */
  readonly op: RelationOp;
  /**
   * Target entity item hrefs.
   * - For `set`: exactly one href (to-one relation).
   * - For `add`: one or more hrefs (to-many relation).
   * - For `clear`: omit entirely (no body).
   */
  readonly targetHrefs?: readonly string[];
};

/**
 * Options for the `useRelationMutation` hook.
 */
export type UseRelationMutationOptions = {
  /**
   * When provided, invalidates the target entity's collection query on success.
   * Use this when the relation change affects the target entity's collection view.
   */
  readonly targetProfileEntity?: ProfileEntity;
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem, Error, RelationMutationVariables>,
    "mutationFn"
  >;
};

/**
 * Mutation hook for modifying entity relations (set, add, clear).
 *
 * Driven by the entity item's `_templates` (`set-<rel>`, `add-<rel>`, `clear-<rel>`).
 * All three operations encode the request body as `text/uri-list` via the default
 * HAL-FORMS codec (one URL per line). Clear encodes an empty body via DELETE.
 *
 * Attaches `If-Match` with the current ETag to prevent concurrent update conflicts
 * (RFC 9110). On success, re-fetches the parent entity item to get the fresh state
 * and ETag, then populates the item cache and invalidates collection queries.
 *
 * On HTTP 412 (ETag mismatch / unsatisfied-version) or 409 (blind-relation-overwrite),
 * the error surfaces as `ProblemDetailError` to the caller — the hook does NOT
 * auto-retry. Callers must handle these at the call site.
 *
 * Permission denial (missing template) is detected before any network call —
 * the hook throws immediately without calling `apiFetch`.
 *
 * Cache behaviour on success:
 * - `setQueryData` on `entityItem.byUrl` with the re-fetched item (fresh ETag).
 * - `invalidateQueries` on `entityItemCollection.forEntity(profileEntity)`.
 * - If `targetProfileEntity` provided: `invalidateQueries` on `entityItemCollection.forEntity(targetProfileEntity)`.
 * - Caller's `onSuccess` runs after cache is consistent.
 *
 * @param profileEntity - The entity profile (used for cache key scoping)
 * @param options - Optional hook options (targetProfileEntity, mutationOptions)
 * @returns TanStack mutation result; `data` is the updated `EntityItem` (re-fetched)
 */
export function useRelationMutation(
  profileEntity: ProfileEntity,
  options?: UseRelationMutationOptions,
) {
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async ({
      entityItem,
      relationName,
      op,
      targetHrefs,
    }: RelationMutationVariables) => {
      // Build template-driven Request — method/URL/Content-Type all from the template.
      // Template absence means ABAC denied — throw before calling apiFetch.
      let baseReq: Request;
      if (op === "set") {
        const href = targetHrefs?.[0];
        if (!href) {
          throw new Error(`useRelationMutation: 'set' op requires exactly one targetHref`);
        }
        baseReq = entityItem.setRelationRequest(relationName, href);
      } else if (op === "add") {
        if (!targetHrefs || targetHrefs.length === 0) {
          throw new Error(`useRelationMutation: 'add' op requires at least one targetHref`);
        }
        baseReq = entityItem.addRelationRequest(relationName, targetHrefs);
      } else {
        // clear — no body
        baseReq = entityItem.clearRelationRequest(relationName);
      }

      // Attach If-Match from the item ETag (conditional request per RFC 9110).
      const req = addIfMatchHeader(baseReq, entityItem.etag);

      // Execute mutation — 204 No Content, no body.
      await fetchVoid(apiFetch, req);

      // Re-fetch parent item to get fresh state + new ETag.
      const { object, etag } = await fetchHal<EntityItemShape>(
        apiFetch,
        new Request(entityItem.selfLink.href),
      );
      return new EntityItem(object, profileEntity, etag);
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      // Populate item cache with fresh data + ETag.
      queryClient.setQueryData(queryKeys.entityItem.byUrl(profileEntity, item.selfLink.href), item);

      // Invalidate entity collections so lists reflect the change.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });

      // Optionally invalidate the target entity's collections (e.g. relation back-link changed).
      if (options?.targetProfileEntity) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entityItemCollection.forEntity(options.targetProfileEntity),
        });
      }

      // Compose caller's onSuccess LAST — after cache is consistent.
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
