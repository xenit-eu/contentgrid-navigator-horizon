import type React from "react";
import { useEffect, useState } from "react";
import { XIcon as X } from "@phosphor-icons/react";
import { format } from "date-fns";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Popover, PopoverAnchor, PopoverContent } from "../../primitives/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { Separator } from "../../primitives/separator";
import { formatWords } from "../search-property-utils";

export type FilterInputKind = "text" | "number" | "date" | "datetime" | "boolean" | "select";

export type SearchOperator =
  | "exact-match"
  | "prefix-match"
  | "full-text"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal";

/** Sub-label for a range-pair input, indicating which bound it represents. */
export type DirectionLabel = "After" | "Before" | "From" | "Until";

/**
 * Pre-computed view model produced by buildFilterProperties() in @contentgrid/navigator-data
 * (`packages/navigator-data/src/accessors/extended-forms/filter-properties.ts`).
 *
 * This is a HAND-MAINTAINED MIRROR, not an import: packages/ui may not import
 * @contentgrid/navigator-data (see packages/ui/CLAUDE.md's forbidden-imports list), so this
 * type has to be redeclared here. Keep every field name, optionality, and type in sync with
 * the producer — a field that's required there but optional (or missing) here is structurally
 * still assignable, so a drift won't show up as a compile error on either side.
 */
export interface SearchFilterProperty {
  name: string;
  label: string;
  description?: string;
  inputKind: FilterInputKind;
  /**
   * The raw HAL-FORMS wire type (e.g. "number", "checkbox"). Used by `invalidValueMessage`,
   * whose case labels are keyed to the wire type (mirroring `coerceFilterValue` in the data
   * layer) rather than `inputKind` — `inputKind` collapses to "select" whenever inline options
   * are present, which would otherwise mask the underlying type this message is about.
   */
  propertyType: string;
  searchOperator: SearchOperator;
  groupKey: string;
  /** Heading for this property's group. Always set by the producer for every real property. */
  groupLabel: string;
  directionLabel?: DirectionLabel;
  dateEncoding?: "iso" | "plain";
  options?: string[];
  relationKey?: string;
  relationDescription?: string;
}

export interface FilterSidebarProps {
  filterProperties: SearchFilterProperty[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | undefined) => void;
  onClearAll?: () => void;
  /** Called when user types in a prefix-match field; fieldParam is the full property name. */
  onTypeaheadSearch?: (fieldParam: string, query: string) => void;
  /**
   * The property name of the field currently being typeahead-searched (only one field can be
   * active at a time — useTypeahead tracks a single query). `typeaheadSuggestions` /
   * `typeaheadIsLoading` apply to this field only.
   */
  activeTypeaheadField?: string;
  /** Suggestions for `activeTypeaheadField`; populated externally from useTypeahead. */
  typeaheadSuggestions?: string[];
  /** Loading state for `activeTypeaheadField`. */
  typeaheadIsLoading?: boolean;
  /**
   * Names of properties whose current `filters` value could not be coerced for its
   * propertyType (e.g. non-numeric text in a number field) and was therefore silently omitted
   * from the request — see `findInvalidFilterKeys` in `@contentgrid/navigator-data`. Rendered
   * as an inline error under the affected field instead of the table just quietly not
   * filtering by it.
   */
  invalidFilterKeys?: readonly string[];
}

function isoToDateInputValue(isoString: string): string {
  if (isoString.includes("T")) {
    const date = new Date(isoString);
    if (!Number.isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }
  return isoString;
}

function isoToDatetimeLocalInputValue(isoString: string): string {
  const date = new Date(isoString);
  if (!Number.isNaN(date.getTime())) {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  }
  return isoString;
}

/** Appends a lowercased direction ("after"/"before"/"from"/"until") to a label, when present. */
function withDirectionSuffix(label: string, directionLabel: DirectionLabel | undefined): string {
  return directionLabel ? `${label} ${directionLabel.toLowerCase()}` : label;
}

/** Maps a FilterInputKind to the native <input type="..."> it renders as. */
function htmlInputType(inputKind: FilterInputKind): string {
  switch (inputKind) {
    case "datetime":
      return "datetime-local";
    case "date":
      return "date";
    case "number":
      return "number";
    default:
      return "text";
  }
}

/**
 * Error text for a field whose current value is in `invalidFilterKeys` (see
 * FilterSidebarProps). Switches on `propertyType` (the wire type), not `inputKind` — a
 * "select" control on a number-typed attribute with non-numeric inline options (see
 * coerceFilterValue's own doc comment on exactly this case) is the realistic way a "select"
 * kind reaches this at all: a plain "text" propertyType always coerces (raw string
 * passthrough), and "checkbox" is driven by a controlled checkbox that never emits a raw value
 * outside "true"/"false".
 */
function invalidValueMessage(propertyType: string): string {
  switch (propertyType) {
    case "number":
    case "range":
      return "Enter a valid number";
    case "date":
      return "Enter a valid date";
    case "datetime":
    case "datetime-local":
      return "Enter a valid date and time";
    default:
      return "Enter a valid value";
  }
}

interface FilterGroup {
  groupKey: string;
  label: string;
  items: SearchFilterProperty[];
}

/**
 * Groups properties sharing a groupKey under one heading. Redundant siblings (a bare
 * exact-match alongside a prefix/full-text/range variant, or a strict range bound alongside
 * its inclusive equivalent) are already excluded by `buildFilterProperties` in
 * `@contentgrid/navigator-data` — that's model semantics, not a rendering concern, so this
 * function only groups whatever list it's given.
 */
function groupFilterProperties(props: SearchFilterProperty[]): FilterGroup[] {
  const itemsByGroupKey = new Map<string, SearchFilterProperty[]>();
  for (const prop of props) {
    const items = itemsByGroupKey.get(prop.groupKey);
    if (items) {
      items.push(prop);
    } else {
      itemsByGroupKey.set(prop.groupKey, [prop]);
    }
  }
  return Array.from(itemsByGroupKey.values(), (items) => ({
    groupKey: items[0].groupKey,
    label: items[0].groupLabel,
    items,
  }));
}

function ClearButton({
  onClick,
  visible = true,
  ariaLabel = "Clear",
}: Readonly<{ onClick: () => void; visible?: boolean; ariaLabel?: string }>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-6 w-6 shrink-0${visible ? "" : " invisible"}`}
      onClick={onClick}
    >
      <X className="h-3 w-3" />
      <span className="sr-only">{ariaLabel}</span>
    </Button>
  );
}

function toInputId(text: string): string {
  return `filter-${text.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function dateInputValue(inputKind: FilterInputKind, value: string): string {
  if (!value) return "";
  return inputKind === "datetime"
    ? isoToDatetimeLocalInputValue(value)
    : isoToDateInputValue(value);
}

function encodeDateInputValue(
  inputKind: FilterInputKind,
  dateEncoding: "iso" | "plain" | undefined,
  raw: string,
): string | undefined {
  if (!raw) return undefined;
  if (dateEncoding === "plain") return raw;
  if (inputKind === "datetime") {
    // The datetime-local input's value is a local wall-clock time with no timezone marker.
    // `new Date(...)` on a timezone-less datetime string parses it as local time (per the
    // ES Date Time String Format), so toISOString() converts it to the correct UTC instant —
    // naively appending "Z" would treat the local value as if it were already UTC.
    return new Date(raw).toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return `${raw}T00:00:00Z`;
}

/**
 * Renders a set of range-pair properties (e.g. Total~gte/~lte, created_at~after/~before)
 * sharing a groupKey under ONE heading with a clean "After"/"Before"/"From"/"Until" label per
 * input — instead of each item rendering standalone via its own per-item label. That matters
 * because the backend's own prompt for each individual range property can already contain
 * operator wording (e.g. "Total amount: Greater than", "Total amount: Min"); rendering them
 * standalone would concatenate that with our own computed directionLabel, doubling up (e.g.
 * "Total amount: Greater than after"). Handles date/datetime/number — the only kinds that
 * currently produce range-pair operators.
 *
 * Number inputs sit side by side (like the legacy Navigator's HorizontalLayout for the same
 * case), since a range group is almost always exactly two inputs (the strict gt/lt bound is
 * dropped in favor of gte/lte — see isRedundantStrictRangeBound). Date/datetime inputs stay
 * stacked: a native date/datetime-local input needs more width than half of this sidebar to
 * render its segments without the calendar-icon glyph overlapping truncated text.
 */
function RangeGroupFilter({
  label,
  items,
  filters,
  onFilterChange,
  invalidFilterKeys,
}: Readonly<{
  label: string;
  items: SearchFilterProperty[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | undefined) => void;
  invalidFilterKeys: ReadonlySet<string>;
}>) {
  const isNumeric = items.every((p) => p.inputKind === "number");
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className={isNumeric ? "flex gap-2" : "space-y-2"}>
        {items.map((prop) => {
          const value = filters[prop.name] ?? "";
          const isDateLike = prop.inputKind === "date" || prop.inputKind === "datetime";
          const isInvalid = invalidFilterKeys.has(prop.name);
          return (
            <div key={prop.name} className="min-w-0 flex-1 space-y-1">
              {prop.directionLabel && (
                <span className="text-xs text-muted-foreground">{prop.directionLabel}</span>
              )}
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <Input
                    type={htmlInputType(prop.inputKind)}
                    aria-label={withDirectionSuffix(label, prop.directionLabel)}
                    aria-invalid={isInvalid}
                    className="h-8 text-sm"
                    value={isDateLike ? dateInputValue(prop.inputKind, value) : value}
                    onChange={(e) => {
                      onFilterChange(
                        prop.name,
                        isDateLike
                          ? encodeDateInputValue(prop.inputKind, prop.dateEncoding, e.target.value)
                          : e.target.value || undefined,
                      );
                    }}
                  />
                </div>
                <ClearButton
                  onClick={() => onFilterChange(prop.name, undefined)}
                  visible={!!value}
                  ariaLabel={`Clear ${withDirectionSuffix(label, prop.directionLabel)}`}
                />
              </div>
              {isInvalid && (
                <p className="text-xs text-destructive">{invalidValueMessage(prop.propertyType)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EnumFilter({
  label,
  options,
  value,
  onChange,
  invalid = false,
  errorMessage,
}: Readonly<{
  label: string;
  options: string[];
  value: string;
  onChange: (value: string | undefined) => void;
  invalid?: boolean;
  errorMessage?: string;
}>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Select key={value || "empty"} value={value || undefined} onValueChange={onChange}>
            <SelectTrigger aria-label={label} aria-invalid={invalid} className="h-8 w-full text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {formatWords(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
      {invalid && errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}

/**
 * Renders a boolean search filter as a plain checkbox — no filter is applied until the
 * user touches it (filters start at value=""), after which it toggles between "true" and
 * "false". The adjacent ClearButton resets it back to no filter, same as every other kind.
 */
function BooleanFilter({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const inputId = toInputId(label);

  return (
    <div className="flex items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Checkbox
          id={inputId}
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
        <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
          {label}
        </Label>
      </div>
      <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
    </div>
  );
}

/**
 * Shared wrapper for a single labeled input + ClearButton: a heading Label above a row
 * containing the field itself and its clear affordance, with an optional error line below.
 * DateFilter and TextFilter differ only in what `<Input>` they render inside this shell.
 */
function LabeledFilterField({
  label,
  inputId,
  value,
  onClear,
  error,
  children,
}: Readonly<{
  label: string;
  inputId: string;
  value: string;
  onClear: () => void;
  error?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        <ClearButton onClick={onClear} visible={!!value} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Takes both `inputKind` and `propertyType` — not redundant, two different concerns:
 * `inputKind` drives rendering (which native input type, how to format/parse the displayed
 * value); `propertyType` only feeds `invalidValueMessage`, which is keyed to the wire type
 * (see that function's doc comment for why).
 */
function DateFilter({
  label,
  directionLabel,
  dateEncoding,
  inputKind,
  propertyType,
  value,
  onChange,
  invalid = false,
}: Readonly<{
  label: string;
  directionLabel?: DirectionLabel;
  dateEncoding?: "iso" | "plain";
  inputKind: "date" | "datetime";
  propertyType: string;
  value: string;
  onChange: (value: string | undefined) => void;
  invalid?: boolean;
}>) {
  const displayLabel = withDirectionSuffix(label, directionLabel);
  const inputId = toInputId(displayLabel);

  return (
    <LabeledFilterField
      label={displayLabel}
      inputId={inputId}
      value={value}
      onClear={() => onChange(undefined)}
      error={invalid ? invalidValueMessage(propertyType) : undefined}
    >
      <Input
        id={inputId}
        type={htmlInputType(inputKind)}
        aria-invalid={invalid}
        className="h-8 text-sm"
        value={dateInputValue(inputKind, value)}
        onChange={(e) => {
          onChange(encodeDateInputValue(inputKind, dateEncoding, e.target.value));
        }}
      />
    </LabeledFilterField>
  );
}

/**
 * Takes both `inputType` and `propertyType` — not redundant, two different concerns:
 * `inputType` drives rendering (the native `<input type>`); `propertyType` only feeds
 * `invalidValueMessage`, which is keyed to the wire type (see that function's doc comment
 * for why).
 */
function TextFilter({
  label,
  directionLabel,
  inputType = "text",
  propertyType,
  value,
  onChange,
  invalid = false,
}: Readonly<{
  label: string;
  directionLabel?: DirectionLabel;
  inputType?: "text" | "number";
  propertyType: string;
  value: string;
  onChange: (value: string | undefined) => void;
  invalid?: boolean;
}>) {
  const displayLabel = withDirectionSuffix(label, directionLabel);
  const inputId = toInputId(displayLabel);

  return (
    <LabeledFilterField
      label={displayLabel}
      inputId={inputId}
      value={value}
      onClear={() => onChange(undefined)}
      error={invalid ? invalidValueMessage(propertyType) : undefined}
    >
      <Input
        id={inputId}
        type={inputType}
        aria-invalid={invalid}
        className="h-8 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </LabeledFilterField>
  );
}

/**
 * Text input with a typeahead suggestions dropdown for prefix-match search fields.
 * Suggestions are supplied externally (from useTypeahead via FilterSidebarProps).
 *
 * `typedValue` holds whatever is currently in the input box, updated on every keystroke.
 * It is intentionally NOT the same as `value` (the committed filter, owned by the parent's
 * `filters` state) — `typedValue` is only ever pushed into the committed filter by
 * `commitFilterValue`, which runs on three triggers: selecting a suggestion, pressing Enter,
 * or blurring the input. Plain typing only updates `typedValue` and calls `onSearch` (which
 * drives the debounced suggestions query) — it never calls `commitFilterValue`.
 *
 * This split exists to keep two queries genuinely separate: the table's own collection query
 * (built from the committed `filters`) and the typeahead's suggestions query (built from the
 * debounced search text). If every keystroke committed straight to `filters`, both queries
 * would end up requesting the exact same encoded URL — and therefore the same TanStack query
 * key — as soon as the debounce caught up, silently merging two logically distinct queries
 * into one (wrong retry/staleTime/gcTime behavior for whichever query registered second).
 */
function TypeaheadTextFilter({
  label,
  fieldParam,
  value,
  suggestions,
  isLoading,
  onChange,
  onSearch,
}: Readonly<{
  label: string;
  fieldParam: string;
  value: string;
  suggestions: string[];
  isLoading: boolean;
  onChange: (value: string | undefined) => void;
  onSearch: (query: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  // Index of the keyboard-highlighted suggestion; -1 means none highlighted.
  // Drives aria-activedescendant per the WAI-ARIA combobox-with-listbox-popup pattern —
  // focus stays on the input, and this index is the only signal of "current" option.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [typedValue, setTypedValue] = useState(value);

  // Sync typedValue when the committed value changes from OUTSIDE this component (e.g.
  // "Clear all", or a programmatic filter reset) — not on every keystroke, since typing only
  // ever updates typedValue directly, until commitFilterValue pushes it into `filters`.
  useEffect(() => {
    setTypedValue(value);
  }, [value]);

  const inputId = toInputId(fieldParam);
  const listboxId = `${inputId}-listbox`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  // While a new query is loading, `suggestions` can still hold the PREVIOUS query's results
  // (useTypeahead's underlying query keeps previous data visible during a refetch) — treat
  // them as not-yet-actionable so neither the rendered list nor keyboard nav can select a
  // stale suggestion that doesn't match what the user just typed.
  const visibleSuggestions = isLoading ? [] : suggestions;
  const hasSuggestions = visibleSuggestions.length > 0;
  const showPopover = open && (hasSuggestions || isLoading);

  function closePopover() {
    setOpen(false);
    setActiveIndex(-1);
  }

  /**
   * Commits a value into the parent's `filters` state AND resets the live typeahead query.
   * The reset matters: once `v` is committed, the next render passes it back down as this
   * field's own `searchValues` entry (see `entity-list/index.tsx`) — if the debounced query
   * were left holding that same text, `useTypeahead` would re-issue a request scoped to the
   * exact value already committed, which encodes to the same URL (and therefore the same
   * TanStack query key) as the table's own collection query.
   */
  function commitFilterValue(v: string) {
    onChange(v || undefined);
    onSearch("");
  }

  function selectSuggestion(s: string) {
    setTypedValue(s);
    commitFilterValue(s);
    closePopover();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        if (!hasSuggestions) return;
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % visibleSuggestions.length);
        break;
      case "ArrowUp":
        if (!hasSuggestions) return;
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? visibleSuggestions.length - 1 : i - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (hasSuggestions && activeIndex >= 0) {
          selectSuggestion(visibleSuggestions[activeIndex]);
        } else {
          commitFilterValue(typedValue);
          closePopover();
        }
        break;
      case "Escape":
        // Revert the in-progress edit rather than leaving it displayed uncommitted —
        // conventional combobox behaviour, and keeps the input in sync with what the
        // table is actually filtered by.
        setTypedValue(value);
        onSearch("");
        closePopover();
        break;
      default:
        break;
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      <Popover open={showPopover} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <Input
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={showPopover}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                className="h-8 text-sm"
                value={typedValue}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  setTypedValue(v);
                  onSearch(v);
                  setOpen(!!v);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (hasSuggestions) setOpen(true);
                }}
                onBlur={() => {
                  commitFilterValue(typedValue);
                  closePopover();
                }}
              />
            </div>
            <ClearButton
              onClick={() => {
                setTypedValue("");
                commitFilterValue("");
                closePopover();
              }}
              // Visible whenever there's a typed draft OR a committed value — not just
              // typedValue alone, which would hide the affordance the moment the user
              // deletes the text without blurring, even though the previous value is
              // still the active filter until the input blurs.
              visible={!!typedValue || !!value}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1"
          // Prevent stealing focus from the input when the popover opens
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Focus lives on the input (inside PopoverAnchor, not PopoverContent).
          // Without this, Radix fires onOpenChange(false) the instant the popover
          // opens because it sees focus "outside" the content — causing the flash.
          onFocusOutside={(e) => e.preventDefault()}
        >
          {isLoading && <p className="py-2 text-center text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && hasSuggestions && (
            // Native <select>/<datalist> can't render this: suggestions arrive async
            // (debounced typeahead fetch) and must keep shadcn styling consistent across
            // browsers. role="combobox" + aria-activedescendant above wires this listbox
            // into the standard WAI-ARIA combobox pattern with full keyboard support.
            <ul
              id={listboxId}
              role="listbox" // NOSONAR: no native-element alternative for an async, custom-styled combobox popup
              aria-label={`${label} suggestions`}
              className="max-h-48 overflow-y-auto"
            >
              {visibleSuggestions.map((s, index) => (
                // Not a <button>: keyboard navigation is already handled via
                // aria-activedescendant on the input (focus never leaves it), so a nested
                // focusable/interactive element here would only duplicate that path while
                // tripping axe's "nested-interactive" rule (a focusable descendant inside an
                // element that already carries interactive ARIA semantics). Mouse
                // interaction goes directly on the option element instead.
                <li
                  key={s}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  className={`cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-accent ${index === activeIndex ? "bg-accent" : ""}`}
                  // Prevent the input's onBlur from firing before onClick fires
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(s)}
                  // This element is never focused in normal use — real keyboard navigation
                  // happens on the input via handleInputKeyDown, which never moves focus here.
                  // Mirrored defensively so Enter/Space do the right thing in the unlikely
                  // event this option ever does receive focus (e.g. a screen reader's virtual
                  // cursor), instead of a click-only handler silently doing nothing.
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectSuggestion(s);
                    }
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface FilterControlContext {
  value: string;
  onFilterChange: (key: string, value: string | undefined) => void;
  onTypeaheadSearch?: (fieldParam: string, query: string) => void;
  activeTypeaheadField?: string;
  typeaheadSuggestions?: string[];
  typeaheadIsLoading?: boolean;
  invalidFilterKeys: ReadonlySet<string>;
}

/**
 * Dispatches a single (non-range) SearchFilterProperty to its control, switching on the
 * discriminated `inputKind` — the "FieldDescriptor switch" ADR-004 prescribes in place of a
 * JSONForms-style tester/rank registry (see ADR-004's "rejected middle path"). Adding a new
 * FilterInputKind without a case here is a compile error at the exhaustiveness check below,
 * not a silently-skipped field.
 */
function renderFilterControl(
  prop: SearchFilterProperty,
  {
    value,
    onFilterChange,
    onTypeaheadSearch,
    activeTypeaheadField,
    typeaheadSuggestions,
    typeaheadIsLoading,
    invalidFilterKeys,
  }: FilterControlContext,
): React.ReactNode {
  const invalid = invalidFilterKeys.has(prop.name);
  switch (prop.inputKind) {
    case "select":
      // buildFilterProperties() only ever sets inputKind "select" alongside populated
      // options — this guard is defensive for hand-built SearchFilterProperty values (e.g.
      // in tests/stories) that don't go through that factory.
      if (!prop.options) return null;
      return (
        <EnumFilter
          key={prop.name}
          label={prop.label}
          options={prop.options}
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
          invalid={invalid}
          errorMessage={invalidValueMessage(prop.propertyType)}
        />
      );

    case "boolean":
      return (
        <BooleanFilter
          key={prop.name}
          label={prop.label}
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
        />
      );

    case "date":
    case "datetime":
      return (
        <DateFilter
          key={prop.name}
          label={prop.label}
          directionLabel={prop.directionLabel}
          dateEncoding={prop.dateEncoding}
          inputKind={prop.inputKind}
          propertyType={prop.propertyType}
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
          invalid={invalid}
        />
      );

    case "number":
      return (
        <TextFilter
          key={prop.name}
          label={prop.label}
          directionLabel={prop.directionLabel}
          inputType="number"
          propertyType={prop.propertyType}
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
          invalid={invalid}
        />
      );

    case "text": {
      // A bare exact-match sibling (e.g. "number" alongside "number~prefix") is already
      // dropped from group.items by buildFilterProperties() before this runs.

      // Relation-traversal prefix-match params (e.g. "customer.name~prefix") get a working
      // typeahead too — useTypeahead resolves the related entity's own profile/collection via
      // relationKey, so the field param name is all FilterSidebar needs to pass through here.
      if (prop.searchOperator === "prefix-match" && onTypeaheadSearch) {
        const isActiveField = prop.name === activeTypeaheadField;
        return (
          <TypeaheadTextFilter
            key={prop.name}
            label={prop.label}
            fieldParam={prop.name}
            value={value}
            suggestions={isActiveField ? (typeaheadSuggestions ?? []) : []}
            isLoading={isActiveField && (typeaheadIsLoading ?? false)}
            onChange={(v) => onFilterChange(prop.name, v)}
            onSearch={(q) => onTypeaheadSearch(prop.name, q)}
          />
        );
      }

      return (
        <TextFilter
          key={prop.name}
          label={prop.label}
          directionLabel={prop.directionLabel}
          propertyType={prop.propertyType}
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
        />
      );
    }

    default: {
      // `exhaustiveCheck` gives a compile-time guarantee: adding a new FilterInputKind
      // without a case above fails the build here. That guarantee is erased at runtime,
      // though — a value that bypasses the type system (hand-built SearchFilterProperty,
      // `as any`, malformed external data) would silently fall through and render as a
      // bare text node with no error, no crash, no console output. Per ADR-004 ("must have
      // an explicit unhandled descriptor type path that fails loudly in dev and renders a
      // marked placeholder in production"), fail loudly instead — visibly, via the
      // rendered placeholder itself (this repo's lint config forbids console.* calls).
      const exhaustiveCheck: never = prop.inputKind;
      const unhandledKind = String(exhaustiveCheck);
      return (
        <p key={prop.name} className="text-xs text-destructive">
          Unsupported filter: {prop.name} ({unhandledKind})
        </p>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FilterSidebar({
  filterProperties,
  filters,
  onFilterChange,
  onClearAll,
  onTypeaheadSearch,
  activeTypeaheadField,
  typeaheadSuggestions,
  typeaheadIsLoading,
  invalidFilterKeys,
}: Readonly<FilterSidebarProps>) {
  const hasActiveFilters = Object.values(filters).some((v) => !!v);
  // Redundant siblings (bare exact-match, redundant strict range bound) are already excluded
  // by buildFilterProperties() before this list arrives — every group here has ≥1 item.
  const groups = groupFilterProperties(filterProperties);
  const invalidKeySet = new Set(invalidFilterKeys ?? []);

  return (
    <div className="w-56 shrink-0 rounded-lg bg-muted/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-base font-semibold">Filters</span>
        {hasActiveFilters && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-sm text-muted-foreground"
            onClick={onClearAll}
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {groups.map((group, index) => {
          // Only directional items (~gt/~gte/~lt/~lte/~after/~before, i.e. those carrying a
          // directionLabel) belong in the shared RangeGroupFilter box. A group can also contain
          // a bare exact-match sibling now (e.g. "price" alongside "price~gte"/"price~lte" for
          // a NUMBER attribute — isRedundantExactMatch only suppresses that for date/datetime,
          // matching legacy behavior) — that standalone item has no directionLabel and needs
          // its own labeled control via renderFilterControl, or it would render inside
          // RangeGroupFilter with no visible label at all (RangeGroupFilter only ever shows
          // directionLabel, never a plain field label).
          const rangeItems = group.items.filter((p) => p.directionLabel);
          const standaloneItems = group.items.filter((p) => !p.directionLabel);
          const isRangeGroup =
            rangeItems.length > 1 &&
            (rangeItems.every((p) => p.inputKind === "date" || p.inputKind === "datetime") ||
              rangeItems.every((p) => p.inputKind === "number"));

          const controlContext = {
            onFilterChange,
            onTypeaheadSearch,
            activeTypeaheadField,
            typeaheadSuggestions,
            typeaheadIsLoading,
            invalidFilterKeys: invalidKeySet,
          };

          return (
            <div key={group.groupKey}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                {standaloneItems.map((prop) =>
                  renderFilterControl(prop, {
                    value: filters[prop.name] ?? "",
                    ...controlContext,
                  }),
                )}
                {isRangeGroup ? (
                  <RangeGroupFilter
                    label={group.label}
                    items={rangeItems}
                    filters={filters}
                    onFilterChange={onFilterChange}
                    invalidFilterKeys={invalidKeySet}
                  />
                ) : (
                  rangeItems.map((prop) =>
                    renderFilterControl(prop, {
                      value: filters[prop.name] ?? "",
                      ...controlContext,
                    }),
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
