import { XIcon as X } from "@phosphor-icons/react";
import { format, parse } from "date-fns";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";
import { Separator } from "../../primitives/separator";
import {
  SEARCH_TYPE_LABELS,
  type SearchProperty,
  formatFieldLabel,
  formatWords,
  isDateProperty,
  parseName,
} from "../search-property-utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { SearchProperty } from "../search-property-utils";

export interface FilterSidebarProps {
  /** All filterable search properties */
  filterProperties: SearchProperty[];
  /** Current active filter values keyed by SearchProperty.name */
  filters: Record<string, string>;
  /** Called when a single filter value changes. Pass undefined to clear. */
  onFilterChange: (key: string, value: string | undefined) => void;
  /** Called when the user wants to clear all filters */
  onClearAll?: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** True for range-pair operator names like "created.~from" (dot before the tilde). */
function isRangePair(name: string): boolean {
  return name.includes(".~");
}

/** True for numeric range-pair operators like "amount.~gte" — a range pair that isn't a date. */
function isNumberRangeProperty(name: string, type: string): boolean {
  return isRangePair(name) && !isDateProperty(name, type);
}

/** Convert a raw date input value to an API value. Range-pair operators use plain yyyy-MM-dd; legacy operators use ISO 8601. */
function encodeDateInputValue(rawValue: string, rangePair: boolean): string {
  return rangePair ? rawValue : dateToApi(rawValue);
}

function getSearchType(prop: SearchProperty): string {
  const { op } = parseName(prop.name);
  if (!op) return "exact";
  return SEARCH_TYPE_LABELS[op] ?? op;
}

type InputType = "text" | "select" | "date" | "number";

function getInputType(prop: SearchProperty): InputType {
  if (prop.options?.inline?.length) return "select";
  if (isDateProperty(prop.name, prop.type)) return "date";
  if (isNumberRangeProperty(prop.name, prop.type)) return "number";
  return "text";
}

/** Map a search-type label to a capitalised direction word, or null. */
function getDirectionLabel(searchType: string): "After" | "Before" | null {
  if (searchType === "after" || searchType === "from") return "After";
  if (searchType === "before" || searchType === "until") return "Before";
  return null;
}

/** Convert a date string from <input type="date"> (yyyy-MM-dd) to ISO 8601 for the API */
function dateToApi(dateStr: string): string {
  return `${dateStr}T00:00:00Z`;
}

/** Convert a stored filter value (ISO 8601 or plain yyyy-MM-dd) to the <input type="date"> display format. */
function decodeDateInputValue(apiStr: string): string {
  if (apiStr.includes("T")) {
    const date = new Date(apiStr);
    if (!Number.isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }
  const parsed = parse(apiStr, "yyyy-MM-dd", new Date());
  if (!Number.isNaN(parsed.getTime())) return apiStr;
  return apiStr;
}

interface FilterGroup {
  label: string;
  items: SearchProperty[];
}

function groupFilterProperties(props: SearchProperty[]): FilterGroup[] {
  const groups: FilterGroup[] = [];
  const seen = new Set<string>();
  for (const prop of props) {
    const base = parseName(prop.name).base;
    if (seen.has(base)) continue;
    seen.add(base);
    const items = props.filter((p) => parseName(p.name).base === base);
    groups.push({ label: formatFieldLabel(items[0]), items });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ClearButton({
  onClick,
  visible = true,
}: Readonly<{ onClick: () => void; visible?: boolean }>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-6 w-6 shrink-0${visible ? "" : " invisible"}`}
      onClick={onClick}
    >
      <X className="h-3 w-3" />
      <span className="sr-only">Clear</span>
    </Button>
  );
}

function RangeGroupFilter({
  label,
  items,
  filters,
  onFilterChange,
  inputType,
}: Readonly<{
  label: string;
  items: SearchProperty[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | undefined) => void;
  inputType: "date" | "number";
}>) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {items.map((prop) => {
        const searchType = getSearchType(prop);
        const rawValue = filters[prop.name] ?? "";
        const direction = getDirectionLabel(searchType);
        const displayValue =
          inputType === "date" ? (rawValue ? decodeDateInputValue(rawValue) : "") : rawValue;

        return (
          <div key={prop.name} className="space-y-1">
            {direction && <span className="text-xs text-muted-foreground">{direction}</span>}
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  type={inputType}
                  aria-label={direction ? `${label} ${direction.toLowerCase()}` : label}
                  className="h-8 text-sm"
                  value={displayValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      onFilterChange(prop.name, undefined);
                      return;
                    }
                    onFilterChange(
                      prop.name,
                      inputType === "date"
                        ? encodeDateInputValue(raw, isRangePair(prop.name))
                        : raw,
                    );
                  }}
                />
              </div>
              <ClearButton
                onClick={() => onFilterChange(prop.name, undefined)}
                visible={!!rawValue}
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
  propName,
  label,
  searchType,
  value,
  onChange,
  rawDate = false,
}: Readonly<{
  propName: string;
  label: string;
  searchType: string;
  value: string;
  onChange: (value: string | undefined) => void;
  rawDate?: boolean;
}>) {
  const direction = getDirectionLabel(searchType);
  const displayLabel = direction ? `${label} ${direction.toLowerCase()}` : label;
  const inputId = `filter-${propName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

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
            value={value ? decodeDateInputValue(value) : ""}
            onChange={(e) =>
              onChange(e.target.value ? encodeDateInputValue(e.target.value, rawDate) : undefined)
            }
          />
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
    </div>
  );
}

function TextFilter({
  propName,
  label,
  value,
  onChange,
  searchType = "exact",
  inputType = "text",
}: Readonly<{
  propName: string;
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
  searchType?: string;
  inputType?: "text" | "number";
}>) {
  const direction = getDirectionLabel(searchType);
  const displayLabel = direction ? `${label} ${direction.toLowerCase()}` : label;
  const inputId = `filter-${propName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {displayLabel}
      </Label>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Input
            id={inputId}
            type={inputType}
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FilterSidebar({
  filterProperties,
  filters,
  onFilterChange,
  onClearAll,
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
          const groupInputType: "date" | "number" | null =
            group.items.length > 1 && group.items.every((p) => getInputType(p) === "date")
              ? "date"
              : group.items.length > 1 && group.items.every((p) => getInputType(p) === "number")
                ? "number"
                : null;

          return (
            <div key={group.label}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                {groupInputType ? (
                  <RangeGroupFilter
                    label={group.label}
                    items={group.items}
                    filters={filters}
                    onFilterChange={onFilterChange}
                    inputType={groupInputType}
                  />
                ) : (
                  group.items.map((prop) => {
                    const type = getInputType(prop);
                    const value = filters[prop.name] ?? "";
                    const label = formatFieldLabel(prop);
                    const searchType = getSearchType(prop);

                    // 1. Handle Select/Enum types
                    if (type === "select" && prop.options?.inline) {
                      return (
                        <EnumFilter
                          key={prop.name}
                          label={label}
                          options={prop.options.inline}
                          value={value}
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    // 2. Handle Date types
                    if (type === "date") {
                      return (
                        <DateFilter
                          key={prop.name}
                          propName={prop.name}
                          label={label}
                          searchType={searchType}
                          value={value}
                          rawDate={isRangePair(prop.name)}
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    // 3. Handle numeric range-pair types (lone bound, not grouped)
                    if (type === "number") {
                      return (
                        <TextFilter
                          key={prop.name}
                          propName={prop.name}
                          label={label}
                          searchType={searchType}
                          value={value}
                          inputType="number"
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    // 4. Handle Text types
                    if (type === "text") {
                      return (
                        <TextFilter
                          key={prop.name}
                          propName={prop.name}
                          label={label}
                          searchType={searchType}
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
