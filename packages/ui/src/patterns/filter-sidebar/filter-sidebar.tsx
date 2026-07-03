import { useState } from "react";
import { XIcon as X } from "@phosphor-icons/react";
import { format } from "date-fns";
import { Button } from "../../primitives/button";
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

export type FilterInputKind = "text" | "date" | "select";

export type SearchOperator =
  | "exact-match"
  | "prefix-match"
  | "full-text"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal";

/** Pre-computed view model produced by buildFilterProperties() in @contentgrid/navigator-data. */
export interface SearchFilterProperty {
  name: string;
  label: string;
  description?: string;
  inputKind: FilterInputKind;
  searchOperator: SearchOperator;
  groupKey: string;
  directionLabel?: "After" | "Before" | "From" | "Until";
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

function formatWords(text: string): string {
  return text
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => UPPERCASE_WORDS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function apiToDate(apiStr: string): string {
  if (apiStr.includes("T")) {
    const date = new Date(apiStr);
    if (!Number.isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }
  return apiStr;
}

interface FilterGroup {
  label: string;
  items: SearchFilterProperty[];
}

function groupFilterProperties(props: SearchFilterProperty[]): FilterGroup[] {
  const groups: FilterGroup[] = [];
  const seen = new Set<string>();
  for (const prop of props) {
    if (seen.has(prop.groupKey)) continue;
    seen.add(prop.groupKey);
    const items = props.filter((p) => p.groupKey === prop.groupKey);
    groups.push({ label: prop.label, items });
  }
  return groups;
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

function DateGroupFilter({
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
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {items.map((prop) => {
        const value = filters[prop.name] ?? "";
        return (
          <div key={prop.name} className="space-y-1">
            {prop.directionLabel && (
              <span className="text-xs text-muted-foreground">{prop.directionLabel}</span>
            )}
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  type="date"
                  aria-label={
                    prop.directionLabel ? `${label} ${prop.directionLabel.toLowerCase()}` : label
                  }
                  className="h-8 text-sm"
                  value={value ? apiToDate(value) : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onFilterChange(
                      prop.name,
                      raw ? (prop.dateEncoding === "plain" ? raw : `${raw}T00:00:00Z`) : undefined,
                    );
                  }}
                />
              </div>
              <ClearButton
                onClick={() => onFilterChange(prop.name, undefined)}
                visible={!!value}
                ariaLabel={`Clear ${label}${prop.directionLabel ? ` ${prop.directionLabel.toLowerCase()}` : ""}`}
              />
            </div>
          </div>
        );
      })}
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
                  {formatWords(opt)}
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

function DateFilter({
  label,
  directionLabel,
  dateEncoding,
  value,
  onChange,
}: Readonly<{
  label: string;
  directionLabel?: "After" | "Before" | "From" | "Until";
  dateEncoding?: "iso" | "plain";
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const displayLabel = directionLabel ? `${label} ${directionLabel.toLowerCase()}` : label;
  const inputId = `filter-${displayLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {displayLabel}
      </Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Input
            id={inputId}
            type="date"
            className="h-8 text-sm"
            value={value ? apiToDate(value) : ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw ? (dateEncoding === "plain" ? raw : `${raw}T00:00:00Z`) : undefined);
            }}
          />
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
    </div>
  );
}

function TextFilter({
  label,
  directionLabel,
  value,
  onChange,
}: Readonly<{
  label: string;
  directionLabel?: "After" | "Before" | "From" | "Until";
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const displayLabel = directionLabel ? `${label} ${directionLabel.toLowerCase()}` : label;
  const inputId = `filter-${displayLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {displayLabel}
      </Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Input
            id={inputId}
            type="text"
            className="h-8 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
    </div>
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
  const inputId = `filter-${fieldParam.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const hasSuggestions = suggestions.length > 0;
  const showPopover = open && (hasSuggestions || isLoading);

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
                className="h-8 text-sm"
                value={value}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(v || undefined);
                  onSearch(v);
                  setOpen(!!v);
                }}
                onFocus={() => {
                  if (hasSuggestions) setOpen(true);
                }}
                onBlur={() => setOpen(false)}
              />
            </div>
            <ClearButton
              onClick={() => {
                onChange(undefined);
                onSearch("");
                setOpen(false);
              }}
              visible={!!value}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-anchor-width)] p-1"
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
            <ul
              role="listbox"
              aria-label={`${label} suggestions`}
              className="max-h-48 overflow-y-auto"
            >
              {suggestions.map((s) => (
                <li key={s} role="option" aria-selected={s === value}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    // Prevent the input's onBlur from firing before onClick fires
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(s);
                      onSearch("");
                      setOpen(false);
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
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
  const groups = groupFilterProperties(filterProperties);

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
          const isDateGroup =
            group.items.length > 1 && group.items.every((p) => p.inputKind === "date");

          return (
            <div key={group.label}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                {isDateGroup ? (
                  <DateGroupFilter
                    label={group.label}
                    items={group.items}
                    filters={filters}
                    onFilterChange={onFilterChange}
                  />
                ) : (
                  group.items.map((prop) => {
                    const value = filters[prop.name] ?? "";

                    if (prop.inputKind === "select" && prop.options) {
                      return (
                        <EnumFilter
                          key={prop.name}
                          label={prop.label}
                          options={prop.options}
                          value={value}
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    if (prop.inputKind === "date") {
                      return (
                        <DateFilter
                          key={prop.name}
                          label={prop.label}
                          directionLabel={prop.directionLabel}
                          dateEncoding={prop.dateEncoding}
                          value={value}
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    if (prop.inputKind === "text") {
                      // Suppress a bare exact-match field when a prefix-match sibling exists in
                      // the same group (e.g. both "number" and "number~prefix" are present).
                      if (
                        prop.searchOperator === "exact-match" &&
                        prop.name === prop.groupKey &&
                        group.items.some((p) => p.searchOperator === "prefix-match")
                      ) {
                        return null;
                      }

                      // Relation-traversal prefix-match params (e.g. "customer.name~prefix") are
                      // rendered as a plain text filter — the source entity's profile has no
                      // attribute to resolve suggestions against for a related entity's field,
                      // so wiring a working typeahead here requires the related entity's own
                      // profile/collection. Deferred as out of scope for ACC-2889; falls back to
                      // TextFilter so the field stays usable instead of showing a dead "Loading…"
                      // popover that never resolves.
                      if (
                        prop.searchOperator === "prefix-match" &&
                        onTypeaheadSearch &&
                        !prop.relationKey
                      ) {
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

                    return null;
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
