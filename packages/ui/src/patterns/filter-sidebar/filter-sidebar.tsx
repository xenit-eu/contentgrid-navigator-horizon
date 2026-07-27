import type React from "react";
import { useState } from "react";
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

/** Pre-computed view model produced by buildFilterProperties() in @contentgrid/navigator-data. */
export interface SearchFilterProperty {
  name: string;
  label: string;
  description?: string;
  inputKind: FilterInputKind;
  searchOperator: SearchOperator;
  groupKey: string;
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
  /** Suggestions keyed by search property name; populated externally from useTypeahead. */
  typeaheadSuggestions?: Record<string, string[]>;
  /** Loading state per field, keyed by search property name. */
  typeaheadIsLoading?: Record<string, boolean>;
}

const UPPERCASE_WORDS: Record<string, string> = {
  id: "ID",
  url: "URL",
  uri: "URI",
  api: "API",
  uuid: "UUID",
};

function formatOptionLabel(optionValue: string): string {
  return optionValue
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => UPPERCASE_WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

/** Maps a FilterInputKind to the native <input type="..."> it renders as. */
/** Appends a lowercased direction ("after"/"before"/"from"/"until") to a label, when present. */
function withDirectionSuffix(label: string, directionLabel: DirectionLabel | undefined): string {
  return directionLabel ? `${label} ${directionLabel.toLowerCase()}` : label;
}

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

interface FilterGroup {
  label: string;
  items: SearchFilterProperty[];
}

/**
 * An exact-match property is redundant once a MORE SPECIFIC sibling exists for the same
 * attribute: a prefix-match or full-text variant (e.g. "number" alongside "number~prefix"),
 * or a range/direction variant (e.g. "invoice_date" alongside "invoice_date~after" /
 * "~before"). Suppress it — one broad "exact value" control adds nothing once a narrower or
 * range-based way to search the same field is already shown. Applies uniformly across kinds
 * (text, date, datetime, number); select/boolean never have such siblings in practice, since
 * prefix/full-text/range operators only apply to string or ordered-value attributes.
 * Suppresses every redundant sibling, not just one — some search templates expose more than
 * one exact-match-shaped param for the same attribute (see the "range-pair operators" tests).
 */
function isRedundantExactMatch(
  prop: SearchFilterProperty,
  siblings: SearchFilterProperty[],
): boolean {
  if (prop.searchOperator !== "exact-match") return false;
  return siblings.some(
    (p) =>
      p.groupKey === prop.groupKey &&
      (p.searchOperator === "prefix-match" ||
        p.searchOperator === "full-text" ||
        !!p.directionLabel),
  );
}

/**
 * A strict range bound ("greater-than" / "less-than", i.e. the "After"/"Before" direction)
 * is redundant once an inclusive sibling covering the same bound direction exists for the
 * same attribute ("greater-than-or-equal" / "less-than-or-equal", i.e. "From"/"Until").
 * Mirrors the legacy Navigator's range-pairing behavior (RangedJsfFormConvertor / NestedRange
 * in contentgrid-navigator's src/components/form/jsonforms.ts): it prefers the inclusive
 * suffix pair when both are present for the same base field, and never renders the strict
 * pair alongside it. Without this, a search template that exposes all four comparison
 * operators for one attribute (e.g. price~gt/~gte/~lt/~lte) would render four stacked inputs
 * instead of the two (From/Until) that cover the same range.
 */
function isRedundantStrictRangeBound(
  prop: SearchFilterProperty,
  siblings: SearchFilterProperty[],
): boolean {
  if (prop.searchOperator !== "greater-than" && prop.searchOperator !== "less-than") return false;
  const inclusiveEquivalent =
    prop.searchOperator === "greater-than" ? "greater-than-or-equal" : "less-than-or-equal";
  return siblings.some(
    (p) => p.groupKey === prop.groupKey && p.searchOperator === inclusiveEquivalent,
  );
}

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
  return Array.from(itemsByGroupKey.values(), (items) => ({ label: items[0].label, items }));
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
 * Renders a set of range-pair properties (e.g. Total.~gte/~lte, created_at~after/~before)
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
}: Readonly<{
  label: string;
  items: SearchFilterProperty[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | undefined) => void;
}>) {
  const isNumeric = items.every((p) => p.inputKind === "number");
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className={isNumeric ? "flex gap-2" : "space-y-2"}>
        {items.map((prop) => {
          const value = filters[prop.name] ?? "";
          const isDateLike = prop.inputKind === "date" || prop.inputKind === "datetime";
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
}: Readonly<{
  label: string;
  options: string[];
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Select key={value || "empty"} value={value || undefined} onValueChange={onChange}>
            <SelectTrigger aria-label={label} className="h-8 w-full text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {formatOptionLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
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
 * containing the field itself and its clear affordance. DateFilter and TextFilter differ
 * only in what `<Input>` they render inside this shell.
 */
function LabeledFilterField({
  label,
  inputId,
  value,
  onClear,
  children,
}: Readonly<{
  label: string;
  inputId: string;
  value: string;
  onClear: () => void;
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
    </div>
  );
}

function DateFilter({
  label,
  directionLabel,
  dateEncoding,
  inputKind,
  value,
  onChange,
}: Readonly<{
  label: string;
  directionLabel?: DirectionLabel;
  dateEncoding?: "iso" | "plain";
  inputKind: "date" | "datetime";
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const displayLabel = withDirectionSuffix(label, directionLabel);
  const inputId = toInputId(displayLabel);

  return (
    <LabeledFilterField
      label={displayLabel}
      inputId={inputId}
      value={value}
      onClear={() => onChange(undefined)}
    >
      <Input
        id={inputId}
        type={htmlInputType(inputKind)}
        className="h-8 text-sm"
        value={dateInputValue(inputKind, value)}
        onChange={(e) => {
          onChange(encodeDateInputValue(inputKind, dateEncoding, e.target.value));
        }}
      />
    </LabeledFilterField>
  );
}

function TextFilter({
  label,
  directionLabel,
  inputType = "text",
  value,
  onChange,
}: Readonly<{
  label: string;
  directionLabel?: DirectionLabel;
  inputType?: "text" | "number";
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const displayLabel = withDirectionSuffix(label, directionLabel);
  const inputId = toInputId(displayLabel);

  return (
    <LabeledFilterField
      label={displayLabel}
      inputId={inputId}
      value={value}
      onClear={() => onChange(undefined)}
    >
      <Input
        id={inputId}
        type={inputType}
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
  const inputId = toInputId(fieldParam);
  const listboxId = `${inputId}-listbox`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const hasSuggestions = suggestions.length > 0;
  const showPopover = open && (hasSuggestions || isLoading);

  function closePopover() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function selectSuggestion(s: string) {
    onChange(s);
    onSearch("");
    closePopover();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!hasSuggestions) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case "Enter":
        if (activeIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
        }
        break;
      case "Escape":
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
                value={value}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(v || undefined);
                  onSearch(v);
                  setOpen(!!v);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (hasSuggestions) setOpen(true);
                }}
                onBlur={closePopover}
              />
            </div>
            <ClearButton
              onClick={() => {
                onChange(undefined);
                onSearch("");
                closePopover();
              }}
              visible={!!value}
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
          {isLoading && !hasSuggestions && (
            <p className="py-2 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {hasSuggestions && (
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
              {suggestions.map((s, index) => (
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
  typeaheadSuggestions?: Record<string, string[]>;
  typeaheadIsLoading?: Record<string, boolean>;
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
    typeaheadSuggestions,
    typeaheadIsLoading,
  }: FilterControlContext,
): React.ReactNode {
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
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
        />
      );

    case "number":
      return (
        <TextFilter
          key={prop.name}
          label={prop.label}
          directionLabel={prop.directionLabel}
          inputType="number"
          value={value}
          onChange={(v) => onFilterChange(prop.name, v)}
        />
      );

    case "text": {
      // A bare exact-match sibling (e.g. "number" alongside "number~prefix") is already
      // dropped from group.items by isRedundantExactMatch before this runs.

      // Relation-traversal prefix-match params (e.g. "customer.name~prefix") are rendered as
      // a plain text filter — the source entity's profile has no attribute to resolve
      // suggestions against for a related entity's field, so wiring a working typeahead here
      // requires the related entity's own profile/collection. Deferred as out of scope for
      // ACC-2889; falls back to TextFilter so the field stays usable instead of showing a
      // dead "Loading…" popover that never resolves.
      if (prop.searchOperator === "prefix-match" && onTypeaheadSearch && !prop.relationKey) {
        return (
          <TypeaheadTextFilter
            key={prop.name}
            label={prop.label}
            fieldParam={prop.name}
            value={value}
            suggestions={typeaheadSuggestions?.[prop.name] ?? []}
            isLoading={typeaheadIsLoading?.[prop.name] ?? false}
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
  typeaheadSuggestions,
  typeaheadIsLoading,
}: Readonly<FilterSidebarProps>) {
  const hasActiveFilters = Object.values(filters).some((v) => !!v);
  // Groups can end up with zero visible items once redundant exact-match siblings are
  // filtered out — drop those entirely so the separator-per-group logic below (index > 0)
  // counts only groups that actually render something, instead of leaving a stray divider
  // where an empty group used to sit.
  const groups = groupFilterProperties(filterProperties)
    .map((group) => ({
      label: group.label,
      items: group.items.filter(
        (p) =>
          !isRedundantExactMatch(p, group.items) && !isRedundantStrictRangeBound(p, group.items),
      ),
    }))
    .filter((group) => group.items.length > 0);

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
          const isRangeGroup =
            group.items.length > 1 &&
            (group.items.every((p) => p.inputKind === "date" || p.inputKind === "datetime") ||
              group.items.every((p) => p.inputKind === "number"));

          return (
            <div key={group.label}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                {isRangeGroup ? (
                  <RangeGroupFilter
                    label={group.label}
                    items={group.items}
                    filters={filters}
                    onFilterChange={onFilterChange}
                  />
                ) : (
                  group.items.map((prop) =>
                    renderFilterControl(prop, {
                      value: filters[prop.name] ?? "",
                      onFilterChange,
                      onTypeaheadSearch,
                      typeaheadSuggestions,
                      typeaheadIsLoading,
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
