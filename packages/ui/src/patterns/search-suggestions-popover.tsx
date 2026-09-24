import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  CheckCircleIcon,
  CircleNotchIcon as CircleNotch,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { DateRange } from "react-day-picker";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Calendar } from "../primitives/calendar";
import { Input } from "../primitives/input";
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/popover";
import { Switch } from "../primitives/switch";

export interface SearchTermSuggestionItem {
  readonly propertyName: string;
  readonly value: string;
  readonly attributeLabel: string;
  readonly relationLabel?: string;
}

export interface SortOptionItem {
  readonly value: string;
  readonly label: string;
}

export interface DateShortcutItem {
  readonly attributeGroupKey: string;
  readonly label: string;
  /** True when this attribute currently has an applied range filter — shown on the chip via a
   * distinct border even while its config panel is collapsed. */
  readonly hasActiveRange?: boolean;
}

export interface BooleanShortcutItem {
  readonly attributeGroupKey: string;
  readonly label: string;
  /** Current value — `true`, `false`, or `undefined` when not set. */
  readonly value?: boolean;
}

type DateRangePreset = "last-day" | "last-week" | "last-month";

/** unset → true → false → unset, matching the read-only boolean AttributeRenderer's own
 * true/false/not-set states one step at a time per click. */
function cycleBooleanValue(current: boolean | undefined): boolean | undefined {
  if (current === undefined) return true;
  if (current === true) return false;
  return undefined;
}

export interface EffectiveMatchItem {
  readonly id: string;
  /**
   * Caller-supplied row content — e.g. an already-composed record-reference component (icon,
   * color, name/subtitle attributes) — rather than a plain string, so this pattern doesn't
   * flatten a richer existing "how this app already displays a record" summary down to text.
   * This pattern only renders it; it stays otherwise descriptor-agnostic per the primitive/
   * pattern boundary (no HAL-Forms-shaped type is required to produce it).
   */
  readonly content: ReactNode;
}

export interface SearchSuggestionsPopoverProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** Value suggestions, one per matching attribute value — rendered first. */
  readonly searchTermSuggestions: readonly SearchTermSuggestionItem[];
  /** Matching records of the current entity type — rendered below the value suggestions (FR-007). */
  readonly effectiveMatches: readonly EffectiveMatchItem[];
  readonly onSelectSearchTermSuggestion: (propertyName: string, value: string) => void;
  readonly onSelectEffectiveMatch: (id: string) => void;
  /**
   * Fires on Enter when no suggestion is highlighted (the user typed a term and pressed Enter
   * without arrowing to one) — lets the caller apply the typed term directly (FR-012) instead
   * of requiring an explicit pick from the list.
   */
  readonly onSubmitQuery?: () => void;
  readonly placeholder?: string;
  /** True while suggestions are being fetched — shows a loading indicator (FR-014). */
  readonly isLoading?: boolean;
  /**
   * True when the suggestion request itself failed — shows a distinct error state, never the
   * same "no matches" message a genuinely empty result would show (FR-015, FR-027).
   */
  readonly isError?: boolean;
  /** Retries the failed request; required whenever `isError` can be true. */
  readonly onRetry?: () => void;
  /**
   * The entity's existing sortable options (FR-020) — the SAME options/value tokens the
   * collection's own sort control already uses, just offered from this surface too. Omitted
   * (or empty) when the entity has none.
   */
  readonly sortOptions?: readonly SortOptionItem[];
  /** The currently active sort value, matching one of `sortOptions`' `value`s, if any. */
  readonly currentSort?: string;
  /** Fires with the picked option's `value`, or `undefined` to clear the active sort. */
  readonly onSortChange?: (value: string | undefined) => void;
  /** One entry per date/date-and-time attribute on the entity (FR-021/022). Omitted (or empty)
   * hides the date-shortcut section entirely. */
  readonly dateShortcuts?: readonly DateShortcutItem[];
  /** Applies the chosen start/end pair (picked directly on the calendar, or via a relative
   * preset button that just moves the calendar's selection) to the given attribute's range —
   * fires only when the Apply button is clicked (FR-023 — other attributes are unaffected). */
  readonly onApplyDateRange?: (attributeGroupKey: string, from: Date, to: Date) => void;
  /** Removes the given attribute's currently APPLIED range filter (not just the calendar's
   * unsaved draft, which the Clear button always resets locally regardless of this prop). */
  readonly onClearDateRange?: (attributeGroupKey: string) => void;
  /** Current enabled state of the "search across relations" toggle, shown next to the Sort
   * chip. */
  readonly relationSearchEnabled?: boolean;
  /** Fires with the toggle's next state. Omit entirely to hide the toggle (e.g. the entity has
   * no relation-traversal search property to offer). */
  readonly onRelationSearchChange?: (enabled: boolean) => void;
  /** One entry per boolean-searchable attribute — rendered as an ordinary chip (same shape as
   * the other chips in this row) that cycles unset → true → false → unset on click. Carries the
   * same CheckCircle/XCircle/MinusCircle icon the read-only boolean AttributeRenderer uses for
   * true/false/unset, but — unlike that renderer's filled `StatusPill` — only the chip's BORDER
   * carries color (green for true, red for false, the default neutral border for unset), so it
   * still reads as a chip belonging to this row rather than a status badge. Omitted (or empty)
   * hides the section. */
  readonly booleanShortcuts?: readonly BooleanShortcutItem[];
  /** Fires with the shortcut's NEXT value — the unset → true → false → unset cycle is computed
   * inside this component; the caller only applies the value it's given. */
  readonly onBooleanShortcutChange?: (
    attributeGroupKey: string,
    value: boolean | undefined,
  ) => void;
}

const DATE_PRESETS: readonly { readonly value: DateRangePreset; readonly label: string }[] = [
  { value: "last-day", label: "Last day" },
  { value: "last-week", label: "Last week" },
  { value: "last-month", label: "Last month" },
];

/** Resolves a relative preset to a concrete `{ from, to }` pair, evaluated against `now`
 * (defaults to the current time) — `to` is always `now`, `from` is `now` shifted back by the
 * preset's span. Only moves the calendar's own selection; applying still requires Apply. */
function resolvePresetRange(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const from = new Date(now);
  switch (preset) {
    case "last-day":
      from.setDate(from.getDate() - 1);
      break;
    case "last-week":
      from.setDate(from.getDate() - 7);
      break;
    case "last-month":
      from.setMonth(from.getMonth() - 1);
      break;
  }
  return { from, to: now };
}

/**
 * One date/datetime attribute's expanded config: a range calendar on the left, relative presets
 * (which just move the calendar's selection) and an Apply button on the right. Its own draft
 * state — remounted fresh whenever a different chip becomes active (its `key` in the parent is
 * the attribute's `attributeGroupKey`), so picking a range for one attribute never leaks into
 * another's (FR-023). No attribute label of its own — the chip above it (which stays visible
 * while this is open) already identifies which attribute this is.
 */
function DateShortcutPanel({
  shortcut,
  onApplyDateRange,
  onClearDateRange,
}: Readonly<{
  shortcut: DateShortcutItem;
  onApplyDateRange?: (attributeGroupKey: string, from: Date, to: Date) => void;
  onClearDateRange?: (attributeGroupKey: string) => void;
}>) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const currentYear = new Date().getFullYear();

  function applyRange() {
    if (!range?.from || !range?.to) return;
    onApplyDateRange?.(shortcut.attributeGroupKey, range.from, range.to);
  }

  function clearRange() {
    setRange(undefined);
    onClearDateRange?.(shortcut.attributeGroupKey);
  }

  return (
    <div className="flex gap-2 border-b p-1.5">
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={2}
        captionLayout="dropdown"
        startMonth={new Date(currentYear - 10, 0)}
        endMonth={new Date(currentYear + 10, 11)}
      />
      <div className="flex max-w-40 flex-1 flex-col gap-1 py-1">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className="w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setRange(resolvePresetRange(preset.value))}
          >
            {preset.label}
          </button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clearRange}>
          Clear
        </Button>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={applyRange}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/** Sentinel `activeConfigKey` for the sort panel — distinct from any real `attributeGroupKey`. */
const SORT_CONFIG_KEY = "__sort__";

/** Reorders suggestions so every value for the same attribute (`propertyName`) sits together,
 * in first-seen attribute order — the raw list can interleave attributes, but the rendered
 * list groups them under one header each (a `Map`'s iteration order already matches
 * first-seen insertion order, so no separate bookkeeping is needed). */
function groupSearchTermSuggestions(
  suggestions: readonly SearchTermSuggestionItem[],
): readonly SearchTermSuggestionItem[] {
  const groups = new Map<string, SearchTermSuggestionItem[]>();
  for (const suggestion of suggestions) {
    const existing = groups.get(suggestion.propertyName);
    if (existing) existing.push(suggestion);
    else groups.set(suggestion.propertyName, [suggestion]);
  }
  return [...groups.values()].flat();
}

/**
 * Descriptor-agnostic per `packages/ui/CLAUDE.md`'s primitive/pattern boundary — plain
 * scalar/array props only, never a `HalFormsField` or `SearchHalFormTemplateProperty`. Built
 * from the same `Popover` + `Input` construction `autocomplete-renderer.tsx` already
 * establishes for this codebase's combobox-style widgets (no new dependency, research D10),
 * generalized to render two distinct suggestion kinds instead of one flat string list.
 */
export function SearchSuggestionsPopover({
  query,
  onQueryChange,
  searchTermSuggestions,
  effectiveMatches,
  onSelectSearchTermSuggestion,
  onSelectEffectiveMatch,
  onSubmitQuery,
  placeholder,
  isLoading = false,
  isError = false,
  onRetry,
  sortOptions = [],
  currentSort,
  onSortChange,
  dateShortcuts = [],
  onApplyDateRange,
  onClearDateRange,
  relationSearchEnabled,
  onRelationSearchChange,
  booleanShortcuts = [],
  onBooleanShortcutChange,
}: Readonly<SearchSuggestionsPopoverProps>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Which chip's config panel is currently expanded — "__sort__", a date attribute's
  // `attributeGroupKey`, or undefined (no panel open). Only one at a time, per the chip-row
  // design: the first row is always just chips; picking one reveals its own config below it.
  const [activeConfigKey, setActiveConfigKey] = useState<string | undefined>(undefined);
  const hasSortOptions = sortOptions.length > 0;
  const hasDateShortcuts = dateShortcuts.length > 0;
  const hasRelationSearchToggle = !!onRelationSearchChange;
  const hasBooleanShortcuts = booleanShortcuts.length > 0;
  const hasConfigChips =
    hasSortOptions || hasDateShortcuts || hasRelationSearchToggle || hasBooleanShortcuts;

  function toggleConfig(key: string) {
    setActiveConfigKey((current) => (current === key ? undefined : key));
  }

  // Grouped by attribute (FR-007) so the render order — and therefore keyboard-nav index —
  // puts every value for the same attribute together under one header.
  const groupedSearchTermSuggestions = groupSearchTermSuggestions(searchTermSuggestions);
  // One flat, keyboard-navigable list: every search-term suggestion first (in grouped order),
  // then every effective match — mirrors the render order (FR-007) so arrow-key index and
  // click target always agree.
  const flatItems: readonly (
    | { kind: "term"; propertyName: string; value: string }
    | { kind: "match"; id: string }
  )[] = [
    ...groupedSearchTermSuggestions.map((s) => ({
      kind: "term" as const,
      propertyName: s.propertyName,
      value: s.value,
    })),
    ...effectiveMatches.map((m) => ({ kind: "match" as const, id: m.id })),
  ];
  const hasItems = flatItems.length > 0;
  // Open whenever there's a query to react to (loading/error/"no matches" all render inside
  // the SAME popover as the item list, FR-014/FR-015), OR whenever there's a sort/date
  // shortcut to offer even before the user has typed anything (FR-020) — those aren't
  // search-driven, so they shouldn't require a query to reach.
  const showPopover = open && (query.length > 0 || hasItems || hasConfigChips);

  function selectItem(item: (typeof flatItems)[number]) {
    if (item.kind === "term") onSelectSearchTermSuggestion(item.propertyName, item.value);
    else onSelectEffectiveMatch(item.id);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        if (!hasItems) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % flatItems.length);
        break;
      case "ArrowUp":
        if (!hasItems) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
        break;
      case "Enter":
        if (hasItems && activeIndex >= 0) {
          event.preventDefault();
          selectItem(flatItems[activeIndex]);
        } else if (query.length > 0) {
          onSubmitQuery?.();
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  }

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            role="combobox"
            aria-expanded={showPopover}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            className="pl-8"
            onChange={(event) => {
              const nextValue = event.target.value;
              onQueryChange(nextValue);
              setOpen(!!nextValue);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.length > 0 || hasItems || hasConfigChips) setOpen(true);
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        {hasConfigChips && (
          <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
            {hasSortOptions && (
              <button
                type="button"
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs hover:bg-accent",
                  activeConfigKey === SORT_CONFIG_KEY
                    ? "border-primary bg-primary/10"
                    : currentSort && "border-blue-500 dark:border-blue-400",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleConfig(SORT_CONFIG_KEY)}
              >
                Sort
                {currentSort &&
                  `: ${sortOptions.find((o) => o.value === currentSort)?.label ?? currentSort}`}
              </button>
            )}
            {hasRelationSearchToggle && (
              <label className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                <Switch
                  checked={!!relationSearchEnabled}
                  onCheckedChange={onRelationSearchChange}
                />
                Search relations
              </label>
            )}
            {dateShortcuts.map((shortcut) => (
              <button
                key={shortcut.attributeGroupKey}
                type="button"
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs hover:bg-accent",
                  activeConfigKey === shortcut.attributeGroupKey
                    ? "border-primary bg-primary/10"
                    : shortcut.hasActiveRange && "border-blue-500 dark:border-blue-400",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleConfig(shortcut.attributeGroupKey)}
              >
                {shortcut.label}
              </button>
            ))}
            {booleanShortcuts.map((shortcut) => (
              <button
                key={shortcut.attributeGroupKey}
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent",
                  shortcut.value === true && "border-green-500 dark:border-green-400",
                  shortcut.value === false && "border-destructive",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  onBooleanShortcutChange?.(
                    shortcut.attributeGroupKey,
                    cycleBooleanValue(shortcut.value),
                  )
                }
              >
                {shortcut.value === true ? (
                  <CheckCircleIcon size={14} aria-hidden />
                ) : shortcut.value === false ? (
                  <XCircleIcon size={14} aria-hidden />
                ) : (
                  <MinusCircleIcon size={14} aria-hidden />
                )}
                {shortcut.label}
              </button>
            ))}
          </div>
        )}
        {activeConfigKey === SORT_CONFIG_KEY && hasSortOptions && (
          <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs hover:bg-accent",
                  option.value === currentSort && "border-primary bg-primary/10",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  onSortChange?.(option.value === currentSort ? undefined : option.value)
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {dateShortcuts
          .filter((shortcut) => shortcut.attributeGroupKey === activeConfigKey)
          .map((shortcut) => (
            <DateShortcutPanel
              key={shortcut.attributeGroupKey}
              shortcut={shortcut}
              onApplyDateRange={onApplyDateRange}
              onClearDateRange={onClearDateRange}
            />
          ))}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-2 py-3 text-sm">
            <p className="text-destructive">Couldn't load suggestions.</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && !hasItems && query.length > 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">No matches</p>
        )}
        {!isLoading &&
          !isError &&
          groupedSearchTermSuggestions.map((suggestion, index) => {
            const previous = groupedSearchTermSuggestions[index - 1];
            const isNewGroup = !previous || previous.propertyName !== suggestion.propertyName;
            return (
              <div key={`${suggestion.propertyName}:${suggestion.value}`}>
                {isNewGroup && (
                  <p className="px-2 pt-2 pb-1 text-sm font-semibold text-foreground first:pt-1">
                    {suggestion.relationLabel
                      ? `${suggestion.relationLabel}: ${suggestion.attributeLabel}`
                      : suggestion.attributeLabel}
                  </p>
                )}
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    index === activeIndex && "bg-accent",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectItem(flatItems[index])}
                >
                  {suggestion.value}
                </button>
              </div>
            );
          })}
        {!isLoading &&
          !isError &&
          effectiveMatches.map((match, matchIndex) => {
            const index = groupedSearchTermSuggestions.length + matchIndex;
            return (
              <button
                key={match.id}
                type="button"
                className={cn(
                  "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectItem(flatItems[index])}
              >
                {match.content}
              </button>
            );
          })}
      </PopoverContent>
    </Popover>
  );
}
