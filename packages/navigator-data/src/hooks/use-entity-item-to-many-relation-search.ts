import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { SearchRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

export interface UseEntityItemToManyRelationSearchOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
}

/**
 * Fetches a relation-scoped search result for a to-many relation.
 *
 * **Workaround** — the server does not yet emit scoping params in the search
 * template itself. This hook first fetches the base relation collection (which
 * typically hits the TanStack Query cache populated by `useEntityItemToManyRelation`),
 * extracts `internalRelationParams` from the resolved URL, patches them into the
 * target entity's search template as hidden properties, and then runs the user's
 * search values against that scoped template.
 *
 * When the server adds native relation-scoped search support, replace the base
 * fetch with a template-driven approach.
 *
 * The query is disabled until:
 * - The target profile is resolved.
 * - The base collection result (and thus `internalRelationParams`) is available.
 * - `searchValues` is provided (undefined disables the query).
 *
 * @param relation     - The to-many relation to search within
 * @param searchValues - Values built from `targetProfile.searchTemplate.template`;
 *                       `undefined` disables the query
 * @param options      - Optional TanStack Query overrides
 */
export function useEntityItemToManyRelationSearch(
  relation: EntityItemToManyRelation,
  searchValues: HalFormValues<SearchRequestSpec> | undefined,
  options?: UseEntityItemToManyRelationSearchOptions,
): UseQueryResult<EntityItemCollection, Error> {
  const { apiFetch } = useNavigatorData();

  // Always call unconditionally — Rules of Hooks.
  const profileResults = useProfileEntities();
  const targetProfile = relation.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  // Step 1: fetch base collection to extract internalRelationParams.
  // Uses the same query key as useEntityItemToManyRelation so this hits the cache
  // when that hook is also running in the same component tree.
  const baseQuery = useQuery({
    ...(targetProfile
      ? EntityItemToManyRelation.fetchQuery(
          apiFetch,
          relation.link.href,
          targetProfile,
          relation.name,
        )
      : {
          queryKey: ["ToManyRelation", relation.name, null] as const,
          queryFn: () => Promise.resolve(null as unknown as EntityItemCollection),
        }),
    enabled: !!targetProfile,
  });

  const internalRelationParams = baseQuery.data?.internalRelationParams;

  // Step 2: build the scoped search URL by patching internalRelationParams into the
  // search template as hidden properties, then encoding the user's searchValues.
  let searchUrl: string | undefined;
  if (targetProfile && searchValues && internalRelationParams) {
    const scopedTemplate = targetProfile.searchTemplate?.withHiddenParams(internalRelationParams);
    if (scopedTemplate) {
      try {
        const codec = halFormCodecs.requireCodecFor(scopedTemplate.template);
        searchUrl = codec.encode(searchValues).url;
      } catch {
        // codec not found for this template — search disabled
      }
    }
  }

  // Step 3: run the scoped search as a dependent query.
  return useQuery({
    ...(targetProfile && searchUrl
      ? {
          ...EntityItemCollection.fetchByUrlQuery(apiFetch, searchUrl, targetProfile),
          // Override key to toManyRelation namespace so relation invalidation catches it.
          queryKey: queryKeys.toManyRelation.byUrl(relation.name, searchUrl),
        }
      : {
          queryKey: ["ToManyRelation", relation.name, "search", null] as const,
          queryFn: () => Promise.resolve(null as unknown as EntityItemCollection),
        }),
    enabled:
      !!targetProfile && !!searchValues && internalRelationParams !== undefined && !!searchUrl,
    ...options?.queryOptionsOverride,
  });
}
