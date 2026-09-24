import { useState } from "react";
import {
  type EntityItem,
  ProfileAttributeSearchType,
  type ProfileEntity,
  type SearchTermSuggestionCandidate,
  useEntitySearchSuggestions,
} from "@contentgrid/navigator-data";
import { SearchSuggestionsPopover } from "@contentgrid/ui";
import { EntityItemReference } from "../entity-item";
import { toRecordTableSortOptions } from "../entity-item-collection";
import { resolveHalFormsFields } from "../hal-forms";
import { selectEffectiveMatches } from "./util/effective-match-selection";
import { filterEnumOptions } from "./util/enum-quick-filter";
import { applySuggestionBudget } from "./util/suggestion-budget";

export interface EntitySearchBarProps {
  readonly profile: ProfileEntity;
  /**
   * Current raw typed term — controlled by the caller so it can round-trip through the URL's
   * `q` search-state key (FR-016) the same way `EntityItemCollectionView`'s `currentSort`/
   * `filters` already do for `sort`/`s.*`.
   */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** Current filter values, keyed by search property name — the SAME map
   * `EntityItemCollectionView`'s own `filters` prop already holds (FR-018: the two entry
   * points share one state, never a separate copy). */
  readonly filters: Record<string, string>;
  readonly onFiltersChange: (filters: Record<string, string>) => void;
  /** Fired when the user selects an effective-match record (FR-011). */
  readonly onEntityItemSelect: (item: EntityItem) => void;
  /**
   * Current sort value and change callback — the SAME `currentSort`/`onSortChange` pair
   * `EntityItemCollectionView` already takes, so this bar's sort shortcut (FR-020) reads and
   * writes the identical underlying sort state rather than introducing a second one. Omitted
   * entirely (or the entity has no sortable options) hides the sort section.
   */
  readonly currentSort?: string;
  readonly onSortChange?: (sort: string | undefined) => void;
}

function hasStringSearchableProperty(profile: ProfileEntity): boolean {
  return (profile.searchTemplate?.searchProperties ?? []).some(
    (sp) =>
      sp.searchType === ProfileAttributeSearchType.prefixMatch ||
      sp.searchType === ProfileAttributeSearchType.fullText,
  );
}

/**
 * User Story 4 / FR-019: constrained (allowed-values) fields don't go through
 * `useEntitySearchSuggestions` at all — their options are already fully resolved client-side,
 * so they're filtered instantly here and merged into the SAME suggestion list/budget as any
 * other search-term suggestion (contracts note these apply "the same way"), rather than the
 * popover needing a separate section for them. Skipped entirely for an empty query — otherwise
 * every allowed value would appear the instant the box gains focus, which isn't a "search".
 */
function enumSuggestionCandidates(
  profile: ProfileEntity,
  query: string,
): readonly SearchTermSuggestionCandidate[] {
  const searchTemplate = profile.searchTemplate;
  if (!searchTemplate || !query) return [];
  const { fields } = resolveHalFormsFields(searchTemplate);
  const candidates: SearchTermSuggestionCandidate[] = [];
  for (const field of fields) {
    if (field.kind !== "enum") continue;
    for (const option of filterEnumOptions(field.options, query)) {
      candidates.push({
        attributeGroupKey: field.name,
        attributeLabel: field.label,
        propertyName: field.property.name,
        value: option.value,
      });
    }
  }
  return candidates;
}

interface DateShortcutTarget {
  readonly attributeGroupKey: string;
  readonly label: string;
  readonly startPropertyName: string;
  readonly endPropertyName: string;
  /** True for a date-only attribute (wire type `"date"`, no time component) — the picked
   * range is encoded as a plain `YYYY-MM-DD` value rather than a full ISO datetime. */
  readonly isDateOnly: boolean;
}

const DATE_WIRE_TYPES = new Set(["date", "datetime", "datetime-local"]);

/** `YYYY-MM-DD` for the calendar day the user picked, using its own local date components —
 * never `toISOString().slice(0, 10)`, which can shift the day when the local offset is
 * negative (UTC midnight of the previous day). */
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * User Story 6 / FR-021–023: one target per date/datetime attribute that exposes BOTH a lower
 * and an upper bound property — the inclusive pair (`~from`/`~until`) when present, otherwise
 * the strict pair (`~after`/`~before`). An attribute with only one side (e.g. `~after` alone,
 * no `~before`) is skipped — there's no complete range to drive a shortcut for.
 */
function dateShortcutTargets(profile: ProfileEntity): readonly DateShortcutTarget[] {
  const searchTemplate = profile.searchTemplate;
  if (!searchTemplate) return [];

  const byGroup = new Map<string, (typeof searchTemplate.searchProperties)[number][]>();
  for (const sp of searchTemplate.searchProperties) {
    if (!DATE_WIRE_TYPES.has(sp.property.type)) continue;
    const existing = byGroup.get(sp.groupKey);
    if (existing) existing.push(sp);
    else byGroup.set(sp.groupKey, [sp]);
  }

  const targets: DateShortcutTarget[] = [];
  for (const [groupKey, siblings] of byGroup) {
    const start =
      siblings.find((sp) => sp.searchType === ProfileAttributeSearchType.greaterThanOrEqual) ??
      siblings.find((sp) => sp.searchType === ProfileAttributeSearchType.greaterThan);
    const end =
      siblings.find((sp) => sp.searchType === ProfileAttributeSearchType.lessThanOrEqual) ??
      siblings.find((sp) => sp.searchType === ProfileAttributeSearchType.lessThan);
    if (!start || !end) continue;
    targets.push({
      attributeGroupKey: groupKey,
      label: siblings[0].profileAttribute?.title ?? groupKey,
      startPropertyName: start.property.name,
      endPropertyName: end.property.name,
      isDateOnly: start.property.type === "date" && end.property.type === "date",
    });
  }
  return targets;
}

interface BooleanShortcutTarget {
  readonly attributeGroupKey: string;
  readonly label: string;
  readonly propertyName: string;
}

/** One target per boolean-searchable attribute (HAL-FORMS `checkbox` type, per
 * `resolveHalFormsFields`'s `"boolean"` field kind) — a boolean has exactly one search
 * property, no directional/range pair like dates. */
function booleanShortcutTargets(profile: ProfileEntity): readonly BooleanShortcutTarget[] {
  const searchTemplate = profile.searchTemplate;
  if (!searchTemplate) return [];
  const { fields } = resolveHalFormsFields(searchTemplate);
  return fields
    .filter((field) => field.kind === "boolean")
    .map((field) => ({
      attributeGroupKey: field.name,
      label: field.label,
      propertyName: field.property.name,
    }));
}

/** Reads a boolean shortcut's current value straight from `filters` — `"true"`/`"false"` map
 * to `true`/`false`, anything else (usually absent) means unset. */
function readBooleanFilterValue(
  filters: Record<string, string>,
  propertyName: string,
): boolean | undefined {
  const raw = filters[propertyName];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

/**
 * App-agnostic single search bar (FR-001–FR-018): a text input with a suggestion popover,
 * composing with `EntityItemCollectionView`/`EntityItemCollectionSearchView` through their
 * EXISTING `filters`/`onFiltersChange` props (contracts §7) — this component adds no new prop
 * to those stable components and renders no chrome of its own beyond the input+popover.
 */
export function EntitySearchBar({
  profile,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  onEntityItemSelect,
  currentSort,
  onSortChange,
}: Readonly<EntitySearchBarProps>) {
  // The search property this bar's own last applied selection came from, if any — lets
  // clearing the box (FR-013) remove exactly that filter, and lets picking a DIFFERENT
  // attribute's suggestion replace this bar's own prior contribution rather than
  // accumulating two search-bar-driven filters side by side.
  const [activeFilterKey, setActiveFilterKey] = useState<string | undefined>(undefined);
  // Off by default — fanning out suggestion/effective-match requests across related entities
  // is a heavier request pattern, so the user opts in via the popover's relation-search switch.
  const [includeRelationSearch, setIncludeRelationSearch] = useState(false);

  const {
    searchTermSuggestions,
    effectiveMatchCandidates,
    hasRelationSearchableProperty,
    isLoading,
    isError,
    refetch,
  } = useEntitySearchSuggestions({
    profileEntity: profile,
    query,
    includeRelationSearch,
  });

  // FR-002: hidden entirely for an entity with no text-searchable attribute.
  if (!hasStringSearchableProperty(profile)) return null;

  const budgetedSuggestions = applySuggestionBudget([
    ...searchTermSuggestions,
    ...enumSuggestionCandidates(profile, query),
  ]);
  const sortOptions = toRecordTableSortOptions(profile);
  const activeSortOption = sortOptions.find((option) => option.value === currentSort);
  const effectiveMatches = selectEffectiveMatches(effectiveMatchCandidates, activeSortOption);
  const dateTargets = dateShortcutTargets(profile);
  const booleanTargets = booleanShortcutTargets(profile);

  function applyBooleanShortcut(attributeGroupKey: string, value: boolean | undefined) {
    const target = booleanTargets.find((t) => t.attributeGroupKey === attributeGroupKey);
    if (!target) return;
    const next = { ...filters };
    if (value === undefined) delete next[target.propertyName];
    else next[target.propertyName] = String(value);
    onFiltersChange(next);
  }

  function applyDateBounds(attributeGroupKey: string, from: Date, to: Date) {
    const target = dateTargets.find((t) => t.attributeGroupKey === attributeGroupKey);
    if (!target) return;
    const encode = target.isDateOnly ? formatDateOnly : (d: Date) => d.toISOString();
    onFiltersChange({
      ...filters,
      [target.startPropertyName]: encode(from),
      [target.endPropertyName]: encode(to),
    });
  }

  function clearDateBounds(attributeGroupKey: string) {
    const target = dateTargets.find((t) => t.attributeGroupKey === attributeGroupKey);
    if (!target) return;
    const next = { ...filters };
    delete next[target.startPropertyName];
    delete next[target.endPropertyName];
    onFiltersChange(next);
  }

  function applyFilter(propertyName: string, value: string) {
    const next = { ...filters };
    if (activeFilterKey && activeFilterKey !== propertyName) delete next[activeFilterKey];
    next[propertyName] = value;
    onFiltersChange(next);
    setActiveFilterKey(propertyName);
    onQueryChange(value);
  }

  function handleQueryChange(next: string) {
    onQueryChange(next);
    if (next === "" && activeFilterKey) {
      const nextFilters = { ...filters };
      delete nextFilters[activeFilterKey];
      onFiltersChange(nextFilters);
      setActiveFilterKey(undefined);
    }
  }

  function handleSelectEffectiveMatch(id: string) {
    const match = effectiveMatches.find((item) => item.id === id);
    if (match) onEntityItemSelect(match);
  }

  function handleSubmitQuery() {
    const [first] = budgetedSuggestions;
    if (first) applyFilter(first.propertyName, first.value);
  }

  return (
    <SearchSuggestionsPopover
      query={query}
      onQueryChange={handleQueryChange}
      searchTermSuggestions={budgetedSuggestions}
      effectiveMatches={effectiveMatches.map((item) => ({
        id: item.id,
        content: <EntityItemReference item={item} size="sm" />,
      }))}
      onSelectSearchTermSuggestion={applyFilter}
      onSelectEffectiveMatch={handleSelectEffectiveMatch}
      onSubmitQuery={handleSubmitQuery}
      placeholder={`Search ${profile.pluralName}…`}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      sortOptions={sortOptions.map((option) => ({ value: option.value, label: option.prompt }))}
      currentSort={currentSort}
      onSortChange={onSortChange}
      dateShortcuts={dateTargets.map((target) => ({
        attributeGroupKey: target.attributeGroupKey,
        label: target.label,
        hasActiveRange: !!filters[target.startPropertyName] && !!filters[target.endPropertyName],
      }))}
      onApplyDateRange={applyDateBounds}
      onClearDateRange={clearDateBounds}
      relationSearchEnabled={includeRelationSearch}
      onRelationSearchChange={hasRelationSearchableProperty ? setIncludeRelationSearch : undefined}
      booleanShortcuts={booleanTargets.map((target) => ({
        attributeGroupKey: target.attributeGroupKey,
        label: target.label,
        value: readBooleanFilterValue(filters, target.propertyName),
      }))}
      onBooleanShortcutChange={applyBooleanShortcut}
    />
  );
}
