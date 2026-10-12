import type { SearchParamSuggestionResult } from "@contentgrid/navigator-data";
import { filterOptionsByPrefix } from "@contentgrid/ui";
import type { CountState, SearchParamDescriptor, SelectorMode } from "./types";

export const MAX_SUGGESTIONS_PER_PARAM = 10;

export interface ParamChipModel {
  readonly descriptor: SearchParamDescriptor;
  readonly count: CountState;
}

export interface SuggestionItemModel {
  /** The value applied when picked (an allowed value's token, or the suggested text). */
  readonly value: string;
  readonly label: string;
}

export interface SuggestionGroupModel {
  readonly descriptor: SearchParamDescriptor;
  readonly count: CountState;
  readonly status: "loading" | "empty" | "error" | "ready";
  readonly items: readonly SuggestionItemModel[];
  /** Retries the group's requests; set for searched parameters. */
  readonly retry?: () => void;
}

/** A parameter whose suggestions come from real searches (FR-016). */
export function isSearchedParam(descriptor: SearchParamDescriptor): boolean {
  return descriptor.mode === "prefix" || descriptor.mode === "full-text";
}

/**
 * The parameters the suggestions hook must request for the current mode (research R3):
 * every prefix / full-text parameter in "All" modes (relations dropped in "All except
 * relations"); the selected parameter alone in parameter mode — searched with suggestions when
 * it is prefix / full-text, or for its count only when it holds allowed values.
 */
export function suggestionRequestsFor(
  descriptors: readonly SearchParamDescriptor[],
  mode: SelectorMode,
): { descriptor: SearchParamDescriptor; withSuggestions: boolean }[] {
  if (mode.kind === "param") {
    const selected = descriptors.find((d) => d.name === mode.name);
    if (!selected) return [];
    if (isSearchedParam(selected)) return [{ descriptor: selected, withSuggestions: true }];
    if (selected.valueKind === "allowed-values")
      return [{ descriptor: selected, withSuggestions: false }];
    return [];
  }
  return descriptors
    .filter((d) => isSearchedParam(d) && !(mode.kind === "all-direct" && d.relation))
    .map((descriptor) => ({ descriptor, withSuggestions: true }));
}

/**
 * Turns the suggestion hook's results into the popover's chip and group models
 * (data-model.md §5):
 * - every chip carries a count: known for a searched parameter, "?" (`unknown`) otherwise;
 * - one group per searched parameter, plus one per allowed-values parameter whose options match
 *   the input (filtered client-side, no request), each capped at 10 items;
 * - in "All" modes, groups without matches are left out as long as some group still has
 *   something to show (results, loading or an error), so the list stays readable; when every
 *   group came back empty they all stay, each saying "No matches".
 */
export function buildSuggestionModels({
  descriptors,
  chipDescriptors,
  results,
  query,
  mode,
}: {
  readonly descriptors: readonly SearchParamDescriptor[];
  readonly chipDescriptors: readonly SearchParamDescriptor[];
  readonly results: readonly SearchParamSuggestionResult[];
  readonly query: string;
  readonly mode: SelectorMode;
}): { chips: ParamChipModel[]; groups: SuggestionGroupModel[] } {
  const resultByName = new Map(results.map((r) => [r.name, r]));
  const countOf = (descriptor: SearchParamDescriptor): CountState =>
    toCountState(resultByName.get(descriptor.name));

  const chips = chipDescriptors.map((descriptor) => ({ descriptor, count: countOf(descriptor) }));

  const groupDescriptors =
    mode.kind === "param"
      ? descriptors.filter((d) => d.name === mode.name)
      : descriptors.filter(
          (d) =>
            (isSearchedParam(d) || d.valueKind === "allowed-values") &&
            !(mode.kind === "all-direct" && d.relation),
        );

  const groups: SuggestionGroupModel[] = [];
  for (const descriptor of groupDescriptors) {
    if (isSearchedParam(descriptor)) {
      const result = resultByName.get(descriptor.name);
      if (!result || result.status === "idle") continue;
      const items = result.suggestions
        .slice(0, MAX_SUGGESTIONS_PER_PARAM)
        .map((value) => ({ value, label: value }));
      groups.push({
        descriptor,
        count: toCountState(result),
        status: groupStatus(result.status, items.length),
        items,
        retry: result.refetch,
      });
    } else if (descriptor.valueKind === "allowed-values") {
      const items = filterOptionsByPrefix(
        descriptor.options ?? [],
        query,
        MAX_SUGGESTIONS_PER_PARAM,
      ).map((option) => ({ value: option.value, label: option.label }));
      if (items.length === 0 && mode.kind !== "param") continue;
      groups.push({
        descriptor,
        count: countOf(descriptor),
        status: items.length > 0 ? "ready" : "empty",
        items,
      });
    }
  }

  if (mode.kind !== "param" && groups.some((g) => g.status !== "empty")) {
    return { chips, groups: groups.filter((g) => g.status !== "empty") };
  }
  return { chips, groups };
}

function groupStatus(
  status: SearchParamSuggestionResult["status"],
  itemCount: number,
): SuggestionGroupModel["status"] {
  if (status === "loading") return "loading";
  if (status === "error") return "error";
  return itemCount > 0 ? "ready" : "empty";
}

function toCountState(result: SearchParamSuggestionResult | undefined): CountState {
  switch (result?.status) {
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error" };
    case "success":
      return result.totalItems
        ? {
            status: "known",
            count: result.totalItems.count,
            isEstimated: result.totalItems.isEstimated,
          }
        : { status: "unknown" };
    default:
      return { status: "unknown" };
  }
}
