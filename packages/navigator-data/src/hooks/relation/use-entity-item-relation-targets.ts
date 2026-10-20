import { useQueries } from "@tanstack/react-query";
import type { EntityItem } from "../../accessors/entity-item";
import type { EntityItemCollection } from "../../accessors/entity-item-collection";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import type ProfileEntity from "../../accessors/entity-profile";
import { useNavigatorData } from "../context";
import { useProfileEntities } from "../profile/use-profile-entity";

type RelationTargetsStatus = "pending" | "error" | "success";

interface RelationTargetsBase {
  /** Target entity profile; `undefined` while the profile list is still loading. */
  readonly targetProfile: ProfileEntity | undefined;
  readonly status: RelationTargetsStatus;
  readonly error: Error | null;
  /** Re-fetch this one relation (e.g. a per-relation "Retry" button). */
  readonly refetch: () => void;
}

/** A to-one relation of the item and its (optional) target. */
export interface ToOneRelationTargets extends RelationTargetsBase {
  readonly kind: "to-one";
  readonly relation: EntityItemToOneRelation;
  /** `null` = the relation slot is empty; `undefined` = not loaded (yet). */
  readonly target: EntityItem | null | undefined;
}

/** A to-many relation of the item and the first page of its targets. */
export interface ToManyRelationTargets extends RelationTargetsBase {
  readonly kind: "to-many";
  readonly relation: EntityItemToManyRelation;
  /** First page at the server's default page size — never sliced by this hook. */
  readonly collection: EntityItemCollection | undefined;
}

export type RelationTargets = ToOneRelationTargets | ToManyRelationTargets;

export interface UseEntityItemRelationTargetsOptions {
  /** Set `false` to suspend every relation query (default `true`). */
  readonly enabled?: boolean;
}

export interface UseEntityItemRelationTargetsResult {
  /** One entry per relation the item exposes: to-one relations first, then to-many (profile order). */
  readonly relations: readonly RelationTargets[];
  /** `true` while the item is undefined or any relation is still pending. */
  readonly isPending: boolean;
}

/**
 * Loads the targets of **every** relation an entity item exposes, in parallel.
 *
 * Relations come from `entityItem.toOneRelations` / `toManyRelations`, so a relation whose
 * `cg:relation` link is absent (ABAC-hidden) never appears. Each relation is fetched with its
 * accessor's own `fetchQuery` factory — i.e. the exact same query keys as
 * `useEntityItemToOneRelation` / `useEntityItemToManyRelation` — so the results share cache with
 * the item detail view and are refreshed by the existing relation mutation hooks' invalidation.
 *
 * - to-one: `target` is `null` when the slot is empty (404), per the factory's behaviour.
 * - to-many: `collection` is the first page only, at the server's default page size. Callers that
 *   want to display fewer targets slice client-side; there is no template-driven page size.
 *
 * Rules-of-Hooks safe: passing `undefined` returns `{ relations: [], isPending: true }`.
 *
 * @param entityItem - The item whose relations to load
 * @param options    - Optional `enabled` switch
 */
export function useEntityItemRelationTargets(
  entityItem: EntityItem | undefined,
  options?: UseEntityItemRelationTargetsOptions,
): UseEntityItemRelationTargetsResult {
  const { apiFetch } = useNavigatorData();
  const enabled = options?.enabled ?? true;

  // Always call unconditionally — Rules of Hooks. Profiles are cached.
  const profileResults = useProfileEntities();
  const profiles = profileResults.flatMap((r) => r.data ?? []);

  const toOne = entityItem?.toOneRelations ?? [];
  const toMany = entityItem?.toManyRelations ?? [];
  const toOneTargets = toOne.map((r) => r.profileRelation.getTargetProfile(profiles));
  const toManyTargets = toMany.map((r) => r.profileRelation.getTargetProfile(profiles));

  const results = useQueries({
    queries: [
      ...toOne.map((relation, i) => {
        const targetProfile = toOneTargets[i];
        return {
          ...(targetProfile
            ? relation.fetchQuery(apiFetch, targetProfile)
            : {
                queryKey: ["ToOneRelation", relation.name, null] as const,
                queryFn: () => Promise.resolve(null),
              }),
          enabled: enabled && !!targetProfile,
        };
      }),
      ...toMany.map((relation, i) => {
        const targetProfile = toManyTargets[i];
        return {
          ...(targetProfile
            ? relation.fetchQuery(apiFetch, targetProfile)
            : {
                queryKey: ["ToManyRelation", relation.name, null] as const,
                queryFn: () => Promise.resolve(undefined as unknown as EntityItemCollection),
              }),
          enabled: enabled && !!targetProfile,
        };
      }),
    ],
  });

  const relations: RelationTargets[] = [
    ...toOne.map((relation, i): ToOneRelationTargets => {
      const result = results[i]!;
      return {
        kind: "to-one",
        relation,
        targetProfile: toOneTargets[i],
        status: result.status,
        error: result.error,
        target: result.data as EntityItem | null | undefined,
        refetch: () => void result.refetch(),
      };
    }),
    ...toMany.map((relation, i): ToManyRelationTargets => {
      const result = results[toOne.length + i]!;
      return {
        kind: "to-many",
        relation,
        targetProfile: toManyTargets[i],
        status: result.status,
        error: result.error,
        collection: result.data as EntityItemCollection | undefined,
        refetch: () => void result.refetch(),
      };
    }),
  ];

  return {
    relations,
    isPending: entityItem === undefined || relations.some((r) => r.status === "pending"),
  };
}
