import { useQueries } from "@tanstack/react-query";
import { createValues } from "@contentgrid/hal-forms/values";
import { ProfileAttributeSearchType } from "../../accessors/attribute-profile";
import { EntityItem } from "../../accessors/entity-item";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useProfileEntities } from "../profile/use-profile-entity";
import { useDebouncedValue } from "../use-debounced-value";
import { extractSuggestions, resolveTypeaheadTarget } from "./use-typeahead";

/**
 * One matching value from ONE contributing attribute, before any cross-attribute budget/cap is
 * applied (that's `applySuggestionBudget` in `@contentgrid/features/entity-search-bar`'s `util/`
 * — this hook deliberately returns raw, unbudgeted candidates only, per its contract).
 */
export interface SearchTermSuggestionCandidate {
  /** `SearchHalFormTemplateProperty.groupKey` — buckets candidates per attribute for the budget step. */
  readonly attributeGroupKey: string;
  readonly attributeLabel: string;
  /** Present only when the source property is a relation traversal. */
  readonly relationLabel?: string;
  /** The raw HAL-FORMS search property name — what gets set as the filter key on selection. */
  readonly propertyName: string;
  readonly value: string;
}

export interface UseEntitySearchSuggestionsOptions {
  readonly profileEntity: ProfileEntity;
  readonly query: string;
  /** Minimum query length before any fetch fires. Defaults to 2, matching `useTypeahead`. */
  readonly minLength?: number;
  /** Includes relation-traversal properties (e.g. `vendor.name~prefix`) as contributing
   * attributes when true. Defaults to false — relation search is opt-in, driven by a UI
   * toggle, since fanning out across related entities is a heavier request pattern. */
  readonly includeRelationSearch?: boolean;
}

export interface UseEntitySearchSuggestionsResult {
  readonly searchTermSuggestions: readonly SearchTermSuggestionCandidate[];
  /**
   * Records of `profileEntity`'s OWN entity type only — even a candidate matched via a
   * relation-traversal property is fetched from `profileEntity`'s own collection (research D2),
   * never the related entity's. Unbudgeted and un-deduplicated across attributes; the caller
   * applies `selectEffectiveMatches` before rendering.
   */
  readonly effectiveMatchCandidates: readonly EntityItem[];
  /** True when the entity has at least one relation-traversal string-searchable property —
   * lets the caller decide whether to offer the relation-search toggle at all. Independent of
   * `includeRelationSearch`: reflects what the profile OFFERS, not what's currently enabled. */
  readonly hasRelationSearchableProperty: boolean;
  /** True while any per-attribute request is still in flight. */
  readonly isLoading: boolean;
  /** True only once every request has settled and NONE of them produced a usable result. */
  readonly isError: boolean;
  /** Re-fires every per-attribute request. */
  readonly refetch: () => void;
}

/** Same predicate `resolveHalFormsFields`'s `isStringSearchable` uses — only a prefix-match or
 * full-text property accepts a raw query string via `withValue()` without the codec throwing. */
function isStringSearchable(sp: SearchHalFormTemplateProperty): boolean {
  return (
    sp.searchType === ProfileAttributeSearchType.prefixMatch ||
    sp.searchType === ProfileAttributeSearchType.fullText
  );
}

function labelFor(sp: SearchHalFormTemplateProperty): {
  attributeLabel: string;
  relationLabel: string | undefined;
} {
  return {
    attributeLabel: sp.property.prompt ?? sp.profileAttribute?.title ?? sp.groupKey,
    relationLabel: sp.isOverRelation ? sp.profileRelation?.title : undefined,
  };
}

/**
 * Fans out one value-suggestion request and one effective-match request per contributing
 * attribute (research D1 — no server-side capability matches a term across several attributes
 * in one request), via `useQueries` — the same "one query per item in a dynamically-sized list"
 * pattern `useProfileEntities` already establishes, rather than calling `useTypeahead` in a
 * loop (a hook called a variable number of times per render is a Rules-of-Hooks violation).
 *
 * A relation-traversal contributing property still resolves its VALUE suggestions from the
 * related entity's own collection (reusing `resolveTypeaheadTarget`, exactly like `useTypeahead`
 * already does for a single property) — but its EFFECTIVE-MATCH candidates always come from
 * `profileEntity`'s own collection, filtered by that same relation-traversal property name,
 * which is itself a valid query parameter on the current entity's collection endpoint. This is
 * what keeps every effective match the same entity type as the collection being searched,
 * without any special-casing.
 */
export function useEntitySearchSuggestions({
  profileEntity,
  query,
  minLength = 2,
  includeRelationSearch = false,
}: UseEntitySearchSuggestionsOptions): UseEntitySearchSuggestionsResult {
  const { apiFetch } = useNavigatorData();
  const debouncedQuery = useDebouncedValue(query, 250);

  // Always called unconditionally — Rules of Hooks. Only consulted for relation-traversal
  // properties; cached, so resolving an entity with none costs nothing extra.
  const profileResults = useProfileEntities();
  const allProfiles = profileResults.flatMap((r) => r.data ?? []);

  const searchTemplate = profileEntity.searchTemplate;
  const stringSearchableProperties = (searchTemplate?.searchProperties ?? []).filter(
    isStringSearchable,
  );
  const hasRelationSearchableProperty = stringSearchableProperties.some((sp) => sp.isOverRelation);
  const contributingProperties = includeRelationSearch
    ? stringSearchableProperties
    : stringSearchableProperties.filter((sp) => !sp.isOverRelation);

  const enabled = query.length >= minLength && debouncedQuery.length >= minLength;

  const valueSuggestionResults = useQueries({
    queries: contributingProperties.map((sp) => {
      const { profile: targetProfile, property: targetProperty } = resolveTypeaheadTarget(
        sp,
        profileEntity,
        allProfiles,
      );
      const targetTemplate = targetProfile?.searchTemplate;
      const values =
        enabled && targetTemplate && targetProperty
          ? createValues(targetTemplate.template).withValue(
              targetProperty.property.name,
              debouncedQuery,
            )
          : undefined;
      const request = values && targetProfile ? targetProfile.searchEntityRequest(values) : null;
      const url = request?.url ?? "";
      const effectiveProfile = targetProfile ?? profileEntity;
      return {
        ...EntityItemCollection.fetchByUrlQuery(apiFetch, url, effectiveProfile),
        queryKey: queryKeys.entitySearchValueSuggestions.byUrl(
          effectiveProfile,
          sp.property.name,
          url,
        ),
        enabled: enabled && !!request,
        staleTime: 30_000,
        gcTime: 60_000,
        retry: 0,
      };
    }),
    combine: (results) => results,
  });

  const effectiveMatchResults = useQueries({
    queries: contributingProperties.map((sp) => {
      const values =
        enabled && searchTemplate
          ? createValues(searchTemplate.template).withValue(sp.property.name, debouncedQuery)
          : undefined;
      const request = values ? profileEntity.searchEntityRequest(values) : null;
      const url = request?.url ?? "";
      return {
        ...EntityItemCollection.fetchByUrlQuery(apiFetch, url, profileEntity),
        queryKey: queryKeys.entitySearchEffectiveMatches.byUrl(
          profileEntity,
          sp.property.name,
          url,
        ),
        enabled: enabled && !!request,
        staleTime: 30_000,
        gcTime: 60_000,
        retry: 0,
      };
    }),
    combine: (results) => results,
  });

  const searchTermSuggestions: SearchTermSuggestionCandidate[] = [];
  contributingProperties.forEach((sp, index) => {
    const result = valueSuggestionResults[index];
    const { attributeLabel, relationLabel } = labelFor(sp);
    const { property: targetProperty } = resolveTypeaheadTarget(sp, profileEntity, allProfiles);
    const attributeName = targetProperty?.profileAttribute?.name;
    for (const { value } of extractSuggestions(result?.data, attributeName)) {
      searchTermSuggestions.push({
        attributeGroupKey: sp.groupKey,
        attributeLabel,
        relationLabel,
        propertyName: sp.property.name,
        value,
      });
    }
  });

  const effectiveMatchCandidates: EntityItem[] = [];
  for (const result of effectiveMatchResults) {
    effectiveMatchCandidates.push(...(result?.data?.items ?? []));
  }

  const allResults = [...valueSuggestionResults, ...effectiveMatchResults];
  const isLoading = enabled && allResults.some((r) => r.isFetching);
  const hasUsableResult = searchTermSuggestions.length > 0 || effectiveMatchCandidates.length > 0;
  const isError = enabled && !isLoading && !hasUsableResult && allResults.some((r) => r.isError);

  function refetch() {
    for (const result of allResults) result.refetch();
  }

  return {
    searchTermSuggestions: enabled ? searchTermSuggestions : [],
    effectiveMatchCandidates: enabled ? effectiveMatchCandidates : [],
    hasRelationSearchableProperty,
    isLoading,
    isError,
    refetch,
  };
}
