import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { EntityItemCollection } from "../accessors/entity-item-collection";
import { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { SearchRequestSpec } from "../api/requests";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { useProfileEntities } from "./use-profile-entity";

/**
 * Fetch a specific page from a prior base-collection or search result.
 * Use `collection.nextHref` / `collection.prevHref`. The URL already carries
 * `_internal_*` scoping params from the server — no re-encoding needed.
 */
export interface RelationCollectionByUrl {
  readonly url: string;
}

/**
 * Perform a relation-scoped search.
 * Pass `searchValues` built from `targetProfile.searchTemplate.template`.
 * `undefined` disables the query (useful while prerequisites are loading).
 */
export interface RelationCollectionBySearch {
  readonly searchValues: HalFormValues<SearchRequestSpec> | undefined;
}

/** Discriminated union; omit to fetch the relation's default first page. */
export type RelationCollectionParams = RelationCollectionByUrl | RelationCollectionBySearch;

export interface UseEntityItemToManyRelationOptions {
  readonly queryOptionsOverride?: Readonly<QueryOptionsOverride<EntityItemCollection, Error>>;
}

function isByUrl(params: RelationCollectionParams | undefined): params is RelationCollectionByUrl {
  return params !== undefined && "url" in params;
}

function isBySearch(
  params: RelationCollectionParams | undefined,
): params is RelationCollectionBySearch {
  return params !== undefined && "searchValues" in params;
}

const PLACEHOLDER = {
  queryKey: ["ToManyRelation", "__placeholder__"] as const,
  queryFn: () => Promise.resolve(null as unknown as EntityItemCollection),
} as const;

/**
 * Fetches the target entity collection for a to-many relation.
 *
 * Supports three modes via the `params` discriminated union:
 *
 * - **Default** (`params` omitted): fetches the relation's first page via
 *   `relation.link.href`.
 * - **By URL** (`{ url }`): fetches a specific page. Use `collection.nextHref` /
 *   `collection.prevHref` for pagination of either the base collection or a
 *   search result.
 * - **By search** (`{ searchValues }`): performs a relation-scoped search.
 *   Internally fetches the base collection first (typically a TanStack Query
 *   cache hit from a co-mounted default-mode call) to extract the
 *   `_internal_*` scoping params, injects them into the search template as
 *   hidden properties, and encodes the scoped search URL. `searchValues`
 *   `undefined` disables the query.
 *
 *   **Workaround** — the server does not yet emit scoping params in the search
 *   template itself. When native support is added, replace the base-fetch step
 *   with a template-driven approach.
 *
 * @param relation - The to-many relation from `entityItem.getToManyRelation(name)`
 * @param params   - Optional mode selector; omit for default first-page fetch
 * @param options  - Optional TanStack Query overrides
 */
export function useEntityItemToManyRelation(
  relation: EntityItemToManyRelation,
  params?: RelationCollectionParams,
  options?: UseEntityItemToManyRelationOptions,
): UseQueryResult<EntityItemCollection, Error> {
  const { apiFetch } = useNavigatorData();

  // Always call unconditionally — Rules of Hooks.
  const profileResults = useProfileEntities();
  const targetProfile = relation.profileRelation.getTargetProfile(
    profileResults.flatMap((r) => r.data ?? []),
  );

  const searchMode = isBySearch(params);
  const searchValues = searchMode ? params.searchValues : undefined;

  // Base query — only active in search mode to extract internalRelationParams.
  // Uses the same cache key as the default-mode call (relation.link.href) so it
  // is a cache hit when both modes are mounted in the same component tree.
  const baseQuery = useQuery({
    ...(targetProfile
      ? EntityItemToManyRelation.fetchQuery(
          apiFetch,
          relation.link.href,
          targetProfile,
          relation.name,
        )
      : PLACEHOLDER),
    enabled: !!targetProfile && searchMode && !!searchValues,
  });

  const internalRelationParams = baseQuery.data?.internalRelationParams;

  // Resolve the main query URL.
  let mainUrl: string | undefined;
  if (isByUrl(params)) {
    mainUrl = params.url;
  } else if (searchMode && searchValues && targetProfile && internalRelationParams) {
    const scopedTemplate = targetProfile.searchTemplate?.withHiddenParams(internalRelationParams);
    if (scopedTemplate) {
      try {
        const codec = halFormCodecs.requireCodecFor(scopedTemplate.template);
        const scopedValues = createValues(scopedTemplate.template).withValues(
          searchValues.valueMap,
        );
        mainUrl = codec.encode(scopedValues).url;
      } catch {
        // codec not found or encoding failed; mainUrl stays undefined → query disabled
      }
    }
  } else if (!searchMode) {
    mainUrl = relation.link.href;
  }

  const mainEnabled =
    !!targetProfile &&
    !!mainUrl &&
    (!searchMode || (!!searchValues && internalRelationParams !== undefined));

  return useQuery({
    ...(targetProfile && mainUrl
      ? EntityItemToManyRelation.fetchQuery(apiFetch, mainUrl, targetProfile, relation.name)
      : PLACEHOLDER),
    enabled: mainEnabled,
    ...options?.queryOptionsOverride,
  });
}
