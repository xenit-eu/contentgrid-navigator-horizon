import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type ProfileEntity,
  type SearchParamSuggestionRequest,
  useLoadedProfileEntities,
  useSearchParamSuggestions,
} from "@contentgrid/navigator-data";
import { type HalFormsField, resolveHalFormsFields } from "../hal-forms";
import { useSearchAttributeInclusion } from "../preferences/use-search-attribute-inclusion";
import { buildCollectionSearchValues } from "../search/filter-field-values";
import { applyParamPatch } from "./util/apply-param-patch";
import { applySearchInclusion } from "./util/apply-search-inclusion";
import { buildActiveFilterChips } from "./util/build-active-filter-chips";
import { buildQuickFilters } from "./util/build-quick-filters";
import { buildSearchParamDescriptors } from "./util/build-search-param-descriptors";
import { buildSelectorGroups } from "./util/build-selector-groups";
import {
  buildSuggestionModels,
  isSearchedParam,
  suggestionRequestsFor,
} from "./util/build-suggestion-models";
import { classifySearchInput } from "./util/classify-search-input";
import { selectParamChips } from "./util/select-param-chips";
import type { SearchParamDescriptor, SelectorMode } from "./util/types";
import { validateParamValue } from "./util/validate-param-value";

export interface EntitySearchBarProps {
  readonly profileEntity: ProfileEntity;
  /** The collection's active filters (URL state), keyed by search property name. */
  readonly filters: Readonly<Record<string, string>>;
  /** Receives the complete next filters map. */
  readonly onFiltersChange: (next: Record<string, string>) => void;
  /** The collection's sort, so suggestion pages follow the list's own order. */
  readonly currentSort?: string;
  readonly className?: string;
  /**
   * The page's own controls (e.g. Columns, Filters), shown right-aligned on the quick-filter
   * row; only the quick filters scroll.
   */
  readonly actions?: ReactNode;
}

const ALL: SelectorMode = { kind: "all" };

/**
 * View model of the entity search bar (contracts/features.md §1): derives every row's model
 * from the profile's search form, the active `filters` and the user's input, and turns user
 * actions into a single `onFiltersChange` call each. Orchestration only — the reshaping lives in
 * `./util`.
 */
export function useEntitySearchBar({
  profileEntity,
  filters,
  onFiltersChange,
  currentSort,
}: EntitySearchBarProps) {
  // `profileEntity.searchTemplate` builds a new object on every access; resolve it once per
  // profile so everything memoised on it stays stable across renders.
  const searchTemplate = useMemo(() => profileEntity.searchTemplate ?? undefined, [profileEntity]);
  const fields = useMemo(
    () => (searchTemplate ? resolveHalFormsFields(searchTemplate).fields : []),
    [searchTemplate],
  );

  // Relation parameters are typed through their target profile (integer vs decimal, labels).
  const profiles = useStableArray(useLoadedProfileEntities().profiles);
  const descriptors: readonly SearchParamDescriptor[] = useMemo(
    () => (searchTemplate ? buildSearchParamDescriptors(fields, searchTemplate, profiles) : []),
    [fields, searchTemplate, profiles],
  );

  // What the selector, the suggestions and the quick filters offer: the attributes the
  // configuration / user preference includes, plus every relation parameter (FR-034–FR-036).
  const { isIncluded } = useSearchAttributeInclusion(profileEntity);
  const includedDescriptors = useMemo(
    () => applySearchInclusion(descriptors, isIncluded),
    [descriptors, isIncluded],
  );

  const setParams = useCallback(
    (patch: Readonly<Record<string, string | undefined>>) =>
      onFiltersChange(applyParamPatch(filters, patch)),
    [filters, onFiltersChange],
  );

  // ---- Active-filter chips ----

  // Built from every parameter — not only the included ones — so a filter on an attribute the
  // user excluded from search, arriving through the link or the advanced dialog, still shows.
  const chips = useMemo(() => buildActiveFilterChips(descriptors, filters), [descriptors, filters]);

  /** Removes a chip's filter at once (FR-004): every parameter it stands for. */
  const removeChip = useCallback(
    (id: string) => {
      const chip = chips.find((c) => c.id === id);
      if (chip) setParams(Object.fromEntries(chip.paramNames.map((name) => [name, undefined])));
    },
    [chips, setParams],
  );

  // ---- Main bar: selector, input and suggestions popover ----

  const [mode, setModeState] = useState<SelectorMode>(ALL);
  const [inputValue, setInputValue] = useState("");
  const [popoverRequested, setPopoverRequested] = useState(false);
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  const selectorGroups = useMemo(
    () => buildSelectorGroups(includedDescriptors, profileEntity.title),
    [includedDescriptors, profileEntity],
  );

  const selected =
    mode.kind === "param" ? includedDescriptors.find((d) => d.name === mode.name) : undefined;
  // A selected parameter that disappeared (profile or inclusion change) falls back to "All".
  const selectedMissing = mode.kind === "param" && !selected;
  const effectiveMode: SelectorMode = useMemo(
    () => (selectedMissing ? ALL : mode),
    [mode, selectedMissing],
  );

  const searchValues = useMemo(
    () =>
      searchTemplate
        ? buildCollectionSearchValues(searchTemplate, fields, filters, currentSort)
        : undefined,
    [searchTemplate, fields, filters, currentSort],
  );

  const requests: readonly SearchParamSuggestionRequest[] = useMemo(() => {
    if (!searchTemplate) return [];
    return suggestionRequestsFor(includedDescriptors, effectiveMode).flatMap(
      ({ descriptor, withSuggestions }) => {
        const searchProperty = searchTemplate.getSearchPropertyByName(descriptor.name);
        return searchProperty ? [{ searchProperty, withSuggestions }] : [];
      },
    );
  }, [searchTemplate, includedDescriptors, effectiveMode]);

  // A selected exact / number parameter has no suggestions, so no popover (FR-018).
  const modeHasPopover =
    effectiveMode.kind !== "param" ||
    (!!selected && (isSearchedParam(selected) || selected.valueKind === "allowed-values"));
  const query = inputValue.trim();
  const popoverOpen = popoverRequested && modeHasPopover && query.length > 0;

  const { results } = useSearchParamSuggestions({
    profileEntity,
    requests: popoverOpen ? requests : NO_REQUESTS,
    query,
    searchValues,
  });

  const { chips: paramChips, groups } = useMemo(
    () =>
      buildSuggestionModels({
        descriptors: includedDescriptors,
        chipDescriptors: selectParamChips(
          includedDescriptors,
          classifySearchInput(query),
          effectiveMode,
        ),
        results,
        query,
        mode: effectiveMode,
      }),
    [includedDescriptors, results, query, effectiveMode],
  );

  const changeInput = useCallback((value: string) => {
    setInputValue(value);
    setInputError(undefined);
    setPopoverRequested(value.trim().length > 0);
  }, []);

  const setMode = useCallback(
    (next: SelectorMode) => {
      setModeState(next);
      setInputError(undefined);
      setPopoverRequested(inputValue.trim().length > 0);
    },
    [inputValue],
  );

  const resetInput = useCallback(() => {
    setInputValue("");
    setModeState(ALL);
    setInputError(undefined);
    setPopoverRequested(false);
  }, []);

  /** Applies a picked suggestion and returns the bar to "All" (FR-019). */
  const applySuggestion = useCallback(
    (paramName: string, value: string) => {
      setParams({ [paramName]: value });
      resetInput();
    },
    [setParams, resetInput],
  );

  /** Narrows the popover to one parameter, from a chip in the popover's top row. */
  const selectParam = useCallback((name: string) => setMode({ kind: "param", name }), [setMode]);

  /**
   * Enter with no suggestion highlighted (FR-020): with a parameter selected, applies the typed
   * text as its value — or explains why it cannot; in "All" modes there is nothing to apply.
   */
  const submit = useCallback(() => {
    if (!selected || inputValue.trim() === "") return;
    const validation = validateParamValue(selected, inputValue);
    if (!validation.ok) {
      setInputError(validation.error);
      return;
    }
    setParams({ [selected.name]: validation.value });
    resetInput();
  }, [selected, inputValue, setParams, resetInput]);

  // ---- Quick filters ----

  const quickFilters = useMemo(
    () => buildQuickFilters(includedDescriptors, filters),
    [includedDescriptors, filters],
  );

  /** Sets the given params of one quick filter; keys outside that quick filter are ignored. */
  const applyQuickFilter = useCallback(
    (groupKey: string, values: Readonly<Record<string, string | undefined>>) => {
      const quickFilter = quickFilters.find((q) => q.groupKey === groupKey);
      if (!quickFilter) return;
      setParams(Object.fromEntries(quickFilter.paramNames.map((name) => [name, values[name]])));
    },
    [quickFilters, setParams],
  );

  /** Removes every param of one quick filter (its × button). */
  const clearQuickFilter = useCallback(
    (groupKey: string) => applyQuickFilter(groupKey, {}),
    [applyQuickFilter],
  );

  /** One click on a boolean quick filter: unset → true → false → unset (FR-028). */
  const cycleBoolean = useCallback(
    (groupKey: string) => {
      const quickFilter = quickFilters.find((q) => q.groupKey === groupKey);
      if (quickFilter?.kind !== "boolean") return;
      const next =
        quickFilter.value === undefined ? "true" : quickFilter.value ? "false" : undefined;
      setParams({ [quickFilter.param]: next });
    },
    [quickFilters, setParams],
  );

  /** Each attribute's resolved fields, in form order — stable while the profile is. */
  const fieldsByGroupKey = useMemo(() => {
    const map = new Map<string, HalFormsField[]>();
    for (const descriptor of descriptors) {
      const list = map.get(descriptor.groupKey) ?? [];
      list.push(descriptor.field);
      map.set(descriptor.groupKey, list);
    }
    return map;
  }, [descriptors]);

  const fieldsFor = useCallback(
    (groupKey: string): readonly HalFormsField[] => fieldsByGroupKey.get(groupKey) ?? NO_FIELDS,
    [fieldsByGroupKey],
  );

  return {
    searchTemplate,
    fields,
    fieldsFor,
    descriptors,
    setParams,
    chips,
    removeChip,
    selectorGroups,
    input: {
      value: inputValue,
      setValue: changeInput,
      error: inputError,
      mode: effectiveMode,
      setMode,
      resetMode: () => setMode(ALL),
      selected,
      popoverOpen,
      setPopoverOpen: setPopoverRequested,
      paramChips,
      groups,
      applySuggestion,
      selectParam,
      submit,
    },
    quickFilters,
    applyQuickFilter,
    clearQuickFilter,
    cycleBoolean,
  };
}

const NO_REQUESTS: readonly SearchParamSuggestionRequest[] = [];
const NO_FIELDS: readonly HalFormsField[] = [];

/** Keeps the previous array instance while its elements are the same instances, in order. */
function useStableArray<T>(next: readonly T[]): readonly T[] {
  const ref = useRef(next);
  const previous = ref.current;
  if (previous.length !== next.length || previous.some((item, i) => item !== next[i])) {
    ref.current = next;
  }
  return ref.current;
}
