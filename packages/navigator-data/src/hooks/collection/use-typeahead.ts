import { useState } from "react";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { createValues } from "@contentgrid/hal-forms/values";
import { AttributeKind } from "../../accessors/entity-item";
import type { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type {
  SearchHalFormTemplate,
  SearchHalFormTemplateProperty,
} from "../../accessors/extended-forms/search-form";
import type { SearchRequestSpec } from "../../api/requests";
import { useProfileEntities } from "../profile/use-profile-entity";
import { useDebouncedValue } from "../use-debounced-value";
import { useEntityItemCollection } from "./use-entity-item-collection";

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
   * number/checkbox/datetime-typed properties. Not enforced here; callers currently only
   * wire this to text-kind FilterSidebar fields.
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

/** The relation's target profile in relation mode; the source profile itself otherwise. */
function resolveTargetProfile(
  isRelation: boolean,
  searchProperty: SearchHalFormTemplateProperty | undefined,
  profileEntity: ProfileEntity,
  allProfiles: readonly ProfileEntity[],
): ProfileEntity | undefined {
  if (!isRelation) return profileEntity;
  return searchProperty?.profileRelation?.getTargetProfile(allProfiles);
}

/**
 * Relation-traversal filter params live on the TARGET entity's own search template under
 * their local (un-prefixed) name — e.g. "customer.first_name~prefix" on the invoice's
 * template corresponds to "first_name~prefix" on the customer's own template.
 */
function resolveLocalPropertyName(
  isRelation: boolean,
  searchProperty: SearchHalFormTemplateProperty | undefined,
  relationName: string | undefined,
): string | undefined {
  if (!isRelation || !searchProperty || !relationName) return searchProperty?.property.name;
  return searchProperty.property.name.slice(relationName.length + 1);
}

/** The search property to actually query with — resolved against the target entity's own template in relation mode. */
function resolveTargetSearchProperty(
  isRelation: boolean,
  localPropertyName: string | undefined,
  targetSearchTemplate: SearchHalFormTemplate | null | undefined,
  searchProperty: SearchHalFormTemplateProperty | undefined,
): SearchHalFormTemplateProperty | undefined {
  if (!isRelation) return searchProperty;
  if (!localPropertyName) return undefined;
  return targetSearchTemplate?.getSearchPropertyByName(localPropertyName);
}

/**
 * Relation mode starts fresh: the parent's searchValues are encoded against the parent's
 * template and don't apply to the related entity's own collection.
 */
function computeBaseSearchValues(
  enabled: boolean,
  targetSearchTemplate: SearchHalFormTemplate | null | undefined,
  isRelation: boolean,
  searchValues: HalFormValues<SearchRequestSpec> | undefined,
): HalFormValues<SearchRequestSpec> | undefined {
  if (!enabled || !targetSearchTemplate) return undefined;
  if (isRelation) return createValues(targetSearchTemplate.template);
  return searchValues ?? createValues(targetSearchTemplate.template);
}

/** Unique, non-empty plain string values of `attributeName` across the collection's items. */
function extractSuggestions(
  collection: EntityItemCollection | undefined,
  attributeName: string | undefined,
): string[] {
  if (!collection || !attributeName) return [];
  const found = new Set<string>();
  for (const item of collection.items) {
    const attribute = item.attributes.find((attr) => attr.value.name === attributeName);
    if (attribute?.value.kind !== AttributeKind.PLAIN) continue;
    const { value } = attribute.value;
    if (typeof value === "string" && value.length > 0) found.add(value);
  }
  return [...found];
}

export function useTypeahead({
  profileEntity,
  searchProperty,
  minLength = 2,
  searchValues,
}: UseTypeaheadOptions) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  // Always call unconditionally — Rules of Hooks. Only consulted for relation-traversal
  // properties; cached, so resolving a direct property costs nothing extra.
  const profileResults = useProfileEntities();

  const isRelation = !!searchProperty?.isOverRelation;
  const relationName = searchProperty?.profileRelation?.name;

  const targetProfile = resolveTargetProfile(
    isRelation,
    searchProperty,
    profileEntity,
    profileResults.flatMap((r) => r.data ?? []),
  );
  const localPropertyName = resolveLocalPropertyName(isRelation, searchProperty, relationName);
  const targetSearchTemplate = targetProfile?.searchTemplate;
  const targetSearchProperty = resolveTargetSearchProperty(
    isRelation,
    localPropertyName,
    targetSearchTemplate,
    searchProperty,
  );

  // Both must meet minLength: query clears results instantly on empty; debouncedQuery gates the fetch.
  // Also disabled until a target property has resolved (relation mode: also needs targetProfile).
  const enabled =
    !!targetSearchProperty &&
    !!targetSearchTemplate &&
    query.length >= minLength &&
    debouncedQuery.length >= minLength;

  const baseSearchValues = computeBaseSearchValues(
    enabled,
    targetSearchTemplate,
    isRelation,
    searchValues,
  );
  const collectionSearchValues =
    baseSearchValues && targetSearchProperty
      ? baseSearchValues.withValue(targetSearchProperty.property.name, debouncedQuery)
      : undefined;

  const {
    data: entityItemCollection,
    isFetching,
    isError,
    error,
  } = useEntityItemCollection(
    { profileEntity: targetProfile ?? profileEntity, searchValues: collectionSearchValues },
    {
      queryOptionsOverride: {
        // staleTime: identical prefixes typed within 30s (e.g. backspace-then-retype) reuse the
        // cached page instead of refetching. gcTime: keep it around briefly after the field
        // blurs, in case the user comes right back. retry: 0 — a suggestions popover shouldn't
        // hang retrying on a transient error; isError surfaces immediately and the user can just
        // keep typing.
        staleTime: 30_000,
        gcTime: 60_000,
        retry: 0,
      },
    },
  );

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
