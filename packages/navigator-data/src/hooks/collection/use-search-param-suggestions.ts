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
import { fetchHalSlice } from "../../api/hal-client";
import type { SearchRequestSpec } from "../../api/requests";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
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
const NOOP = () => {};
/** A plain decimal number, with a point or a (locale) comma as the decimal separator. */
const NUMBER_PATTERN = /^-?\d+([.,]\d+)?$/;

/** One planned request: the count on the current entity, plus an optional relation-target fetch. */
interface Plan {
  readonly name: string;
  readonly withSuggestions: boolean;
  readonly countUrl: string | undefined;
  readonly attributeName: string | undefined;
  /** A relation parameter whose target profile is not loaded yet. */
  readonly awaitingTarget?: boolean;
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
 * A query that cannot be coerced for a parameter (e.g. text for a number-typed one) leaves that
 * result `idle` with no request. While the debounce is pending every result the new input will
 * request reports `loading`, so a result for an older input is never presented as the answer to
 * a newer one; responses are keyed by URL, no placeholder data is carried across inputs, and a
 * superseded request is aborted.
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
  const { profiles, isLoading: profilesLoading } = useLoadedProfileEntities();

  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const active = trimmed.length >= minLength && debouncedQuery.length >= minLength;
  const debouncePending = trimmed !== debouncedQuery;
  /** Whether the current (not yet debounced) input will request this parameter. */
  const willRequest = (request: SearchParamSuggestionRequest) =>
    trimmed.length >= minLength && coerceQuery(request.searchProperty, trimmed) !== undefined;

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

  const requestQuery = (profile: ProfileEntity, url: string | undefined, name: string) => ({
    ...EntityItemCollection.fetchByUrlQuery(apiFetch, url ?? "", profile),
    // An idle entry still needs a key of its own: one shared key would make the observers collide.
    queryKey: queryKeys.searchParamSuggestions.byUrl(profile, url ?? `idle:${name}`),
    // Honour TanStack's abort signal, so a request for a superseded input is cancelled.
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const slice = await fetchHalSlice<EntityItemShape>(apiFetch, new Request(url!, { signal }));
      return new EntityItemCollection(slice, profile);
    },
    enabled: url !== undefined,
    placeholderData: undefined,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 0,
  });

  const queries = useQueries({
    queries: plans.flatMap((plan) => [
      requestQuery(profileEntity, plan.countUrl, plan.name),
      ...(plan.target ? [requestQuery(plan.target.profile, plan.target.url, plan.name)] : []),
    ]),
  });

  let cursor = 0;
  const results = plans.map((plan, index): SearchParamSuggestionResult => {
    const count = queries[cursor++]!;
    const target = plan.target ? queries[cursor++] : undefined;
    const parts = target ? [count, target] : [count];
    const refetch = () => {
      for (const part of parts) void part.refetch();
    };

    if (plan.countUrl === undefined) {
      // Nothing requested yet; the first keystroke still reads as loading until the debounce ends.
      const pending = debouncePending && willRequest(requests[index]!);
      return {
        name: plan.name,
        status: pending ? "loading" : "idle",
        suggestions: NO_SUGGESTIONS,
        totalItems: undefined,
        error: null,
        refetch: NOOP,
      };
    }
    const failed = parts.find((part) => part.isError);
    const status: SearchParamSuggestionStatus =
      debouncePending || (plan.awaitingTarget && profilesLoading)
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
  let countUrl: string;
  try {
    countUrl = profileEntity.searchEntityRequest(base.withValue(name, value)).url;
  } catch {
    // A parameter this hook does not support (e.g. a multi-valued one) is left idle rather than
    // breaking the caller's render.
    return idle;
  }

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
    return { name, withSuggestions, countUrl, attributeName: undefined, awaitingTarget: !target };
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
 * The query as the parameter's wire type expects it: a number for a number-typed parameter when
 * the query is a plain decimal (a locale decimal comma is accepted; "1e3", "0x1A" or "1,000.5"
 * are not) — else `undefined`, no request — and the string otherwise.
 */
function coerceQuery(
  searchProperty: SearchHalFormTemplateProperty,
  query: string,
): string | number | undefined {
  const type = searchProperty.property.type;
  if (type === "number" || type === "range") {
    return NUMBER_PATTERN.test(query) ? Number(query.replace(",", ".")) : undefined;
  }
  return query;
}
