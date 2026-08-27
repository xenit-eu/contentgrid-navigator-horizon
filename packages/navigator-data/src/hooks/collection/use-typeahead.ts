import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { createValues } from "@contentgrid/hal-forms/values";
import { ProfileAttributeSearchType } from "../../accessors/attribute-profile";
import { AttributeKind } from "../../accessors/entity-item";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type {
  SearchHalFormTemplate,
  SearchHalFormTemplateProperty,
} from "../../accessors/extended-forms/search-form";
import type { SearchRequestSpec } from "../../api/requests";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useProfileEntities } from "../profile/use-profile-entity";
import { useDebouncedValue } from "../use-debounced-value";

export interface UseTypeaheadOptions {
  /**
   * The profile entity whose search template `searchProperty` was obtained from (the
   * profile passed to `profileEntity.searchTemplate.getSearchPropertyByName(...)`).
   *
   * For a relation-traversal property (e.g. "customer.name~prefix"), this is still the
   * PARENT entity's profile — the hook resolves the related entity's own profile internally
   * via `searchProperty.profileRelation.getTargetProfile()` and queries ITS collection with
   * ITS own local property name, because the parent entity's items don't embed related-entity
   * fields inline; suggestions have to come from the related entity's own data.
   */
  profileEntity: ProfileEntity;
  /**
   * A search property from `profileEntity.searchTemplate`.
   * Provides the filter parameter name and the attribute to extract from each result.
   * Obtain via `searchTemplate.getSearchPropertiesByType(...)` or `getSearchPropertyByName(...)`.
   * When undefined (e.g. no field is active yet), the hook returns empty results without fetching.
   *
   * Must be a string-typed property (e.g. prefix-match or full-text) — the query text is
   * passed to `withValue()` as a raw string, which the HAL-FORMS codec rejects for
   * number/checkbox/datetime-typed properties. Enforced via `enabled`: a property whose
   * `searchType` isn't `prefixMatch`/`fullText` disables the hook rather than firing a
   * request the codec would reject.
   */
  searchProperty?: SearchHalFormTemplateProperty;
  /** Minimum query length before a fetch fires. Defaults to 2. */
  minLength?: number;
  /**
   * Existing search values to include in each typeahead query.
   * The typeahead prefix filter is merged on top of these values so
   * suggestions are scoped to the current active filters.
   * Build from `searchTemplate.template` via `createValues(...).withValue(...)`.
   *
   * Only applies to direct (non-relation) properties — for a relation-traversal property the
   * hook queries the related entity's own collection, which the parent's search values (built
   * against the parent's template) cannot filter, so they're ignored in that case.
   */
  searchValues?: HalFormValues<SearchRequestSpec>;
}

interface ResolvedTarget {
  profile: ProfileEntity | undefined;
  property: SearchHalFormTemplateProperty | undefined;
}

/**
 * Resolves the profile and search property to actually query against.
 *
 * Direct (non-relation) properties: the given profile/property, unchanged.
 *
 * Relation-traversal properties (e.g. "customer.name~prefix"): resolves the relation's target
 * profile via `profileRelation.getTargetProfile()`, then looks up the LOCAL (un-prefixed)
 * property name on THAT profile's own search template — relation-traversal filter params live
 * on the target entity's own template under their local name (e.g. "customer.first_name~prefix"
 * on the invoice's template corresponds to "first_name~prefix" on the customer's own template).
 */
function resolveTarget(
  searchProperty: SearchHalFormTemplateProperty | undefined,
  profileEntity: ProfileEntity,
  allProfiles: readonly ProfileEntity[],
): ResolvedTarget {
  if (!searchProperty) return { profile: profileEntity, property: undefined };
  if (!searchProperty.isOverRelation) return { profile: profileEntity, property: searchProperty };

  const relation = searchProperty.profileRelation;
  const profile = relation?.getTargetProfile(allProfiles);
  const localName = relation
    ? searchProperty.property.name.slice(relation.name.length + 1)
    : undefined;
  const property = localName
    ? profile?.searchTemplate?.getSearchPropertyByName(localName)
    : undefined;
  return { profile, property };
}

/**
 * `searchValues` here is already resolved by the caller to `undefined` in relation mode — the
 * parent's searchValues are encoded against the parent's template and don't apply to the
 * related entity's own collection, so relation mode always starts fresh regardless of what
 * the caller passed in.
 */
function computeBaseSearchValues(
  enabled: boolean,
  targetSearchTemplate: SearchHalFormTemplate | null | undefined,
  searchValues: HalFormValues<SearchRequestSpec> | undefined,
): HalFormValues<SearchRequestSpec> | undefined {
  if (!enabled || !targetSearchTemplate) return undefined;
  return searchValues ?? createValues(targetSearchTemplate.template);
}

/**
 * Non-empty plain string values of `attributeName` across the collection's items, with
 * duplicate occurrences counted rather than collapsed.
 */
function extractSuggestions(
  collection: EntityItemCollection | undefined,
  attributeName: string | undefined,
): { value: string; count: number }[] {
  if (!collection || !attributeName) return [];
  const counts = new Map<string, number>();
  for (const item of collection.items) {
    const attribute = item.findAttribute(attributeName);
    if (attribute?.value.kind !== AttributeKind.PLAIN) continue;
    const { value } = attribute.value;
    if (typeof value === "string" && value.length > 0) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

export function useTypeahead({
  profileEntity,
  searchProperty,
  minLength = 2,
  searchValues,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const { apiFetch } = useNavigatorData();

  // Always call unconditionally — Rules of Hooks. Only consulted for relation-traversal
  // properties; cached, so resolving a direct property costs nothing extra.
  const profileResults = useProfileEntities();

  const isRelation = !!searchProperty?.isOverRelation;

  const { profile: targetProfile, property: targetSearchProperty } = resolveTarget(
    searchProperty,
    profileEntity,
    profileResults.flatMap((r) => r.data ?? []),
  );
  const targetSearchTemplate = targetProfile?.searchTemplate;
  const targetProfileEntity = targetProfile ?? profileEntity;

  // Only a string-searchable property accepts a raw query string via withValue() — anything
  // else (exact-match, numeric/date range operators, etc.) would throw HalFormValueTypeError
  // deep in the codec. Disabled rather than allowed to fail at request time.
  //
  // Checked on the caller-supplied `searchProperty`, not `targetSearchProperty` — for a
  // relation-traversal property, `targetSearchProperty` is re-resolved against the TARGET
  // entity's own template (see resolveTarget), which relies on that target's own
  // `blueprint:search-param` embeds and can disagree with the parent's suffix-based
  // resolution when those embeds are absent or incomplete for the same logical property.
  // `searchProperty` is exactly what the caller (FilterSidebar, via buildFilterProperties'
  // computeSearchOperator on the PARENT template) already validated as prefix/full-text —
  // re-deriving the answer from the target's template can produce a false negative for a
  // property that genuinely is string-searchable.
  const isStringSearchable =
    searchProperty?.searchType === ProfileAttributeSearchType.prefixMatch ||
    searchProperty?.searchType === ProfileAttributeSearchType.fullText;

  // Both must meet minLength: query clears results instantly on empty; debouncedQuery gates the fetch.
  // Also disabled until a target property has resolved (relation mode: also needs targetProfile).
  const enabled =
    !!targetSearchProperty &&
    !!targetSearchTemplate &&
    isStringSearchable &&
    query.length >= minLength &&
    debouncedQuery.length >= minLength;

  // Relation mode ignores the caller's searchValues — they're encoded against the parent's
  // template, not the related entity's own — so resolve that here, once, rather than passing
  // isRelation into computeBaseSearchValues as a second decision point.
  const baseSearchValues = computeBaseSearchValues(
    enabled,
    targetSearchTemplate,
    isRelation ? undefined : searchValues,
  );
  const collectionSearchValues =
    baseSearchValues && targetSearchProperty
      ? baseSearchValues.withValue(targetSearchProperty.property.name, debouncedQuery)
      : undefined;

  const request = collectionSearchValues
    ? targetProfileEntity.searchEntityRequest(collectionSearchValues)
    : null;
  const url = request?.url ?? "";

  /**
   * Bypasses `useEntityItemCollection` and calls `useQuery` directly so this can be keyed
   * under `queryKeys.typeaheadSuggestions.byUrl` instead of `queryKeys.entityItemCollection.byUrl`
   * — `useEntityItemCollection`'s `queryOptionsOverride` deliberately can't override `queryKey`
   * (see `QueryOptionsOverride`), and reusing the collection's own key here is exactly what
   * caused this query and the table's own collection query to collide on an identical encoded
   * URL (e.g. re-typing a value already committed for this field) with two different
   * retry/staleTime/gcTime option sets fighting over one cache entry. A dedicated root makes
   * that collision impossible regardless of whether the two URLs happen to match. Trade-off:
   * see the doc comment on `queryKeys.typeaheadSuggestions` — this is NOT invalidated by
   * `entityItemCollection.forEntity(...)` on mutations, unlike the table's own query.
   */
  const {
    data: entityItemCollection,
    isFetching,
    isError,
    error,
  } = useQuery({
    ...EntityItemCollection.fetchByUrlQuery(apiFetch, url, targetProfileEntity),
    queryKey: queryKeys.typeaheadSuggestions.byUrl(targetProfileEntity, url),
    enabled: enabled && !!request,
    // staleTime: identical prefixes typed within 30s (e.g. backspace-then-retype) reuse the
    // cached page instead of refetching. gcTime: keep it around briefly after the field blurs,
    // in case the user comes right back. retry: 0 — a suggestions popover shouldn't hang
    // retrying on a transient error; isError surfaces immediately and the user can just keep
    // typing.
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 0,
  });

  const attributeName = targetSearchProperty?.profileAttribute?.name;
  const suggestions = extractSuggestions(entityItemCollection, attributeName);

  return {
    results: enabled ? suggestions : [],
    isLoading: enabled && isFetching, // isFetching stays true during background refetches; isLoading would not
    isError,
    error,
    setQuery,
  };
}
