import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { createValues } from "@contentgrid/hal-forms/values";
import {
  type CollectionTotalCount,
  EntityItemCollection,
} from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";
import type { SearchRequestSpec } from "../../api/requests";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { useLoadedProfileEntities } from "../profile/use-profile-entity";
import { useDebouncedValue } from "../use-debounced-value";
import {
  extractAttributeSuggestions,
  resolveRelationSearchTarget,
} from "./search-suggestion-helpers";

export interface SearchParamSuggestionRequest {
  /** A parameter from `profileEntity.searchTemplate` (prefix, full-text or allowed values). */
  readonly searchProperty: SearchHalFormTemplateProperty;
  /** `false` fetches only the count (e.g. allowed values, whose suggestions are known up front). */
  readonly withSuggestions: boolean;
}

export interface UseSearchParamSuggestionsOptions {
  readonly profileEntity: ProfileEntity;
  readonly requests: readonly SearchParamSuggestionRequest[];
  /** The raw input; trimmed and debounced (250 ms) inside. */
  readonly query: string;
  /**
   * The collection's active filters (and sort), built from `profileEntity.searchTemplate`.
   * Every count request applies the parameter ON TOP of these, so a count answers "how many
   * items of this list would match". `undefined` starts from the template's own empty values.
   */
  readonly searchValues: HalFormValues<SearchRequestSpec> | undefined;
  /** Minimum trimmed query length before anything is requested. Defaults to 1. */
  readonly minLength?: number;
  /** Maximum suggestions per parameter. Defaults to 10. */
  readonly limit?: number;
}

export type SearchParamSuggestionStatus = "idle" | "loading" | "error" | "success";

export interface SearchParamSuggestionResult {
  /** `searchProperty.property.name` of the request. */
  readonly name: string;
  readonly status: SearchParamSuggestionStatus;
  readonly suggestions: readonly string[];
  /** Total of the CURRENT collection with this parameter applied. */
  readonly totalItems: CollectionTotalCount | undefined;
  readonly error: Error | null;
  readonly refetch: () => void;
}

const DEBOUNCE_MS = 250;
const NO_SUGGESTIONS: readonly string[] = [];

/** One planned request: the count on the current entity, plus an optional relation-target fetch. */
interface Plan {
  readonly name: string;
  readonly withSuggestions: boolean;
  readonly countUrl: string | undefined;
  readonly attributeName: string | undefined;
  readonly target?: {
    readonly profile: ProfileEntity;
    readonly url: string;
    readonly attributeName: string | undefined;
  };
}

/**
 * Suggestions and result counts for several search parameters at once, for one shared input —
 * the single search bar's "All" mode (spec 003, FR-014–FR-016, FR-022).
 *
 * Per request:
 * - **count**: one search on the CURRENT entity with `searchValues` plus `param = query`; its
 *   `totalItems` is the count. For a direct parameter, that same page also yields the
 *   suggestions (distinct values of the attribute, in the collection's own order).
 * - **relation parameter suggestions**: one extra search on the relation's target entity with
 *   only its local parameter set — the parent's items don't embed related fields.
 *
 * A query that cannot be coerced for a number-typed parameter leaves that result `idle` with no
 * request. While the debounce is pending every active result reports `loading`, so a result for
 * an older input is never presented as the answer to a newer one; responses are keyed by URL and
 * no placeholder data is carried across inputs.
 */
export function useSearchParamSuggestions({
  profileEntity,
  requests,
  query,
  searchValues,
  minLength = 1,
  limit = 10,
}: UseSearchParamSuggestionsOptions): {
  readonly results: readonly SearchParamSuggestionResult[];
  readonly debouncedQuery: string;
} {
  const { apiFetch } = useNavigatorData();
  // Always called (Rules of Hooks); only consulted for relation parameters. Cached.
  const { profiles } = useLoadedProfileEntities();

  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const active = trimmed.length >= minLength && debouncedQuery.length >= minLength;
  const debouncePending = trimmed !== debouncedQuery;

  const plans: readonly Plan[] = useMemo(
    () =>
      requests.map((request) =>
        planRequest(
          request,
          profileEntity,
          profiles,
          searchValues,
          active ? debouncedQuery : undefined,
        ),
      ),
    [requests, profileEntity, profiles, searchValues, active, debouncedQuery],
  );

  const requestQuery = (profile: ProfileEntity, url: string | undefined) => ({
    ...EntityItemCollection.fetchByUrlQuery(apiFetch, url ?? "", profile),
    queryKey: queryKeys.searchParamSuggestions.byUrl(profile, url ?? ""),
    enabled: url !== undefined,
    placeholderData: undefined,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 0,
  });

  const queries = useQueries({
    queries: plans.flatMap((plan) => [
      requestQuery(profileEntity, plan.countUrl),
      ...(plan.target ? [requestQuery(plan.target.profile, plan.target.url)] : []),
    ]),
  });

  let cursor = 0;
  const results = plans.map((plan): SearchParamSuggestionResult => {
    const count = queries[cursor++]!;
    const target = plan.target ? queries[cursor++] : undefined;
    const parts = target ? [count, target] : [count];
    const refetch = () => {
      for (const part of parts) void part.refetch();
    };

    if (plan.countUrl === undefined) {
      return {
        name: plan.name,
        status: "idle",
        suggestions: NO_SUGGESTIONS,
        totalItems: undefined,
        error: null,
        refetch,
      };
    }
    const failed = parts.find((part) => part.isError);
    const status: SearchParamSuggestionStatus = debouncePending
      ? "loading"
      : failed
        ? "error"
        : parts.some((part) => part.isPending)
          ? "loading"
          : "success";

    const suggestions =
      !plan.withSuggestions || status !== "success"
        ? NO_SUGGESTIONS
        : plan.target
          ? extractAttributeSuggestions(target?.data, plan.target.attributeName, limit)
          : extractAttributeSuggestions(count.data, plan.attributeName, limit);

    return {
      name: plan.name,
      status,
      suggestions,
      totalItems: status === "success" ? count.data?.totalItems : undefined,
      error: failed?.error ?? null,
      refetch,
    };
  });

  return { results, debouncedQuery };
}

function planRequest(
  { searchProperty, withSuggestions }: SearchParamSuggestionRequest,
  profileEntity: ProfileEntity,
  profiles: readonly ProfileEntity[],
  searchValues: HalFormValues<SearchRequestSpec> | undefined,
  query: string | undefined,
): Plan {
  const name = searchProperty.property.name;
  const value = query === undefined ? undefined : coerceQuery(searchProperty, query);
  const searchTemplate = profileEntity.searchTemplate;
  const idle: Plan = { name, withSuggestions, countUrl: undefined, attributeName: undefined };
  if (value === undefined || !searchTemplate) return idle;

  const base = searchValues ?? createValues(searchTemplate.template);
  const countUrl = profileEntity.searchEntityRequest(base.withValue(name, value)).url;

  if (!searchProperty.isOverRelation) {
    return {
      name,
      withSuggestions,
      countUrl,
      attributeName: searchProperty.profileAttribute?.name,
    };
  }
  if (!withSuggestions) return { name, withSuggestions, countUrl, attributeName: undefined };

  // Relation parameter: suggestions come from the target entity's own collection.
  const target = resolveRelationSearchTarget(searchProperty, profiles);
  const targetTemplate = target?.targetProfile.searchTemplate;
  if (!target || !targetTemplate)
    return { name, withSuggestions, countUrl, attributeName: undefined };
  const targetUrl = target.targetProfile.searchEntityRequest(
    createValues(targetTemplate.template).withValue(
      target.targetSearchProperty.property.name,
      value,
    ),
  ).url;
  return {
    name,
    withSuggestions,
    countUrl,
    attributeName: undefined,
    target: {
      profile: target.targetProfile,
      url: targetUrl,
      attributeName: target.targetAttribute?.name,
    },
  };
}

/**
 * The query as the parameter's wire type expects it: a finite number for a number-typed
 * parameter (else `undefined` — no request), the string otherwise. Locale decimal commas are
 * accepted.
 */
function coerceQuery(
  searchProperty: SearchHalFormTemplateProperty,
  query: string,
): string | number | undefined {
  const type = searchProperty.property.type;
  if (type === "number" || type === "range") {
    const parsed = Number(query.replace(",", "."));
    return query !== "" && Number.isFinite(parsed) ? parsed : undefined;
  }
  return query;
}
