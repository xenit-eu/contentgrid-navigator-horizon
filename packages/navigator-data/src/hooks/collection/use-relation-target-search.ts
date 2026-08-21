import { useState } from "react";
import { type HalFormValues, createValues } from "@contentgrid/hal-forms/values";
import { ProfileAttributeSearchType } from "../../accessors/attribute-profile";
import type { EntityItem } from "../../accessors/entity-item";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchRequestSpec } from "../../api/requests";
import { useDebouncedValue } from "../use-debounced-value";
import { useEntityItemCollection } from "./use-entity-item-collection";

export interface UseRelationTargetSearchOptions {
  /** The relation's target entity — always resolved by the caller before this is called. */
  readonly targetProfile: ProfileEntity;
}

export interface UseRelationTargetSearchResult {
  readonly items: readonly EntityItem[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly goToNextPage: () => void;
  readonly goToPreviousPage: () => void;
}

/**
 * Search a relation's target entity collection for candidates to link — the
 * data behind a relation field's picker. Mirrors the debounce/search-property
 * pattern in use-typeahead.ts, but returns full `EntityItem`s with pagination
 * instead of extracted attribute suggestions.
 */
export function useRelationTargetSearch({
  targetProfile,
}: UseRelationTargetSearchOptions): UseRelationTargetSearchResult {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);

  const searchTemplate = targetProfile.searchTemplate;
  const searchProperty =
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.prefixMatch)[0] ??
    searchTemplate?.getSearchPropertiesByType(ProfileAttributeSearchType.fullText)[0];

  // A typed query with no matching search property must disable the query rather than fall
  // back to the template's default (unfiltered) values — otherwise the user's query is
  // silently ignored and the full, unfiltered collection is returned in its place.
  let searchValues: HalFormValues<SearchRequestSpec> | undefined;
  if (searchTemplate && !debouncedQuery) {
    searchValues = createValues(searchTemplate.template);
  } else if (searchTemplate && debouncedQuery && searchProperty) {
    searchValues = createValues(searchTemplate.template).withValue(
      searchProperty.property.name,
      debouncedQuery,
    );
  }

  const collection = useEntityItemCollection(
    pageUrl
      ? { url: pageUrl, profileEntity: targetProfile }
      : { profileEntity: targetProfile, searchValues },
  );

  function setSearchQuery(next: string) {
    setQuery(next);
    setPageUrl(undefined);
  }

  return {
    items: collection.data?.items ?? [],
    isLoading: collection.isPending,
    isError: collection.isError,
    error: collection.error,
    searchQuery: query,
    setSearchQuery,
    hasNextPage: collection.data?.hasNext ?? false,
    hasPreviousPage: collection.data?.hasPrevious ?? false,
    goToNextPage: () => {
      if (collection.data?.nextHref) setPageUrl(collection.data.nextHref);
    },
    goToPreviousPage: () => {
      if (collection.data?.prevHref) setPageUrl(collection.data.prevHref);
    },
  };
}
