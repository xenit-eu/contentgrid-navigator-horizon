import { format, parse } from "date-fns";
import { X } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single filterable search parameter, as returned from the HAL-Forms profile. */
export interface SearchProperty {
  /** Parameter name, may contain a "~<operator>" suffix, e.g. "created~greater-than" */
  name: string;
  /** Optional human-readable label */
  prompt?: string;
  /** Data type, e.g. "string", "date", "datetime" */
  type: string;
  /** Available values for enum-like fields */
  options?: { inline?: string[] };
}

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
// Internal helpers (no external deps beyond date-fns which is in package.json)
// ---------------------------------------------------------------------------

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

function formatFieldLabel(prop: SearchProperty): string {
  if (prop.prompt) return prop.prompt;
  const name = prop.name;
  if (name.includes("~")) {
    const [field] = name.split("~");
    return formatWords(field);
  }
  return formatWords(name);
}

const SEARCH_TYPE_LABELS: Record<string, string> = {
  prefix: "prefix",
  "prefix-match": "prefix",
  "exact-match": "exact",
  "greater-than": "after",
  "greater-than-or-equal-to": "from",
  "less-than": "before",
  "less-than-or-equal-to": "until",
};

function getSearchType(prop: SearchProperty): string {
  if (prop.name.includes("~")) {
    const [, type] = prop.name.split("~");
    return SEARCH_TYPE_LABELS[type] ?? type;
  }
  return "exact";
}

const DATE_FIELD_TYPES = new Set(["date", "datetime", "datetime-local", "time"]);
const DATE_SUFFIXES = [
  "~greater-than",
  "~greater-than-or-equal-to",
  "~less-than",
  "~less-than-or-equal-to",
];

type InputType = "text" | "select" | "date";

function getInputType(prop: SearchProperty): InputType {
  if (prop.options?.inline?.length) return "select";
  if (DATE_FIELD_TYPES.has(prop.type)) return "date";
  if (DATE_SUFFIXES.some((s) => prop.name.endsWith(s))) return "date";
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

/** Convert an ISO 8601 date string back to input format (yyyy-MM-dd) */
function apiToDate(apiStr: string): string {
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
    const base = prop.name.includes("~") ? prop.name.split("~")[0] : prop.name;
    if (seen.has(base)) continue;
    seen.add(base);
    const items = props.filter((p) => {
      const pBase = p.name.includes("~") ? p.name.split("~")[0] : p.name;
      return pBase === base;
    });
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

function DateGroupFilter({
  label,
  items,
  filters,
  onFilterChange,
}: Readonly<{
  label: string;
  items: SearchProperty[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string | undefined) => void;
}>) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {items.map((prop) => {
        const searchType = getSearchType(prop);
        const value = filters[prop.name] ?? "";
        const direction = getDirectionLabel(searchType);

        return (
          <div key={prop.name} className="space-y-1">
            {direction && <span className="text-xs text-muted-foreground">{direction}</span>}
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Input
                  type="date"
                  aria-label={direction ? `${label} ${direction.toLowerCase()}` : label}
                  className="h-8 text-sm"
                  value={value ? apiToDate(value) : ""}
                  onChange={(e) =>
                    onFilterChange(
                      prop.name,
                      e.target.value ? dateToApi(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <ClearButton onClick={() => onFilterChange(prop.name, undefined)} visible={!!value} />
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
  searchType,
  value,
  onChange,
}: Readonly<{
  label: string;
  searchType: string;
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const direction = getDirectionLabel(searchType);
  const displayLabel = direction ? `${label} ${direction.toLowerCase()}` : label;
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
            onChange={(e) => onChange(e.target.value ? dateToApi(e.target.value) : undefined)}
          />
        </div>
        <ClearButton onClick={() => onChange(undefined)} visible={!!value} />
      </div>
    </div>
  );
}

function TextFilter({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string | undefined) => void;
}>) {
  const inputId = `filter-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
        {label}
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
          const isDateGroup =
            group.items.length > 1 && group.items.every((p) => getInputType(p) === "date");

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
                          label={label}
                          searchType={searchType}
                          value={value}
                          onChange={(v) => onFilterChange(prop.name, v)}
                        />
                      );
                    }

                    // 3. Handle Text types
                    if (type === "text") {
                      return (
                        <TextFilter
                          key={prop.name}
                          label={label}
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
