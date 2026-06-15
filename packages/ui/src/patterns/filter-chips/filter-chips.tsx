import { useMemo } from "react";
import { X } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import {
  IMPLICIT_OPS,
  SEARCH_TYPE_LABELS,
  type SearchProperty,
  formatFieldLabel,
  formatWords,
  isDateProperty,
  parseName,
} from "../search-property-utils";

export interface FilterChipsProps {
  /** Active filter values keyed by SearchProperty.name */
  filters: Record<string, string>;
  /** All filterable search properties — used for label and operator lookup */
  filterProperties: SearchProperty[];
  /** Called when the user removes a single chip */
  onRemoveFilter: (key: string) => void;
  /** Called when "Clear all" is clicked; rendered when ≥ 2 chips are active */
  onClearAll?: () => void;
}

const ISO_TIMESTAMP_RE = /T\d{2}:\d{2}:\d{2}.*$/;

export function FilterChips({
  filters,
  filterProperties,
  onRemoveFilter,
  onClearAll,
}: Readonly<FilterChipsProps>) {
  const activeChips = useMemo(() => {
    return Object.entries(filters)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => {
        const prop = filterProperties.find((p) => p.name === key);
        const { base, op } = parseName(key);
        const label = prop ? formatFieldLabel(prop) : formatWords(base);
        const displayOp = op && !IMPLICIT_OPS.has(op) ? (SEARCH_TYPE_LABELS[op] ?? op) : null;
        const displayValue = isDateProperty(key, prop?.type ?? "")
          ? value.replace(ISO_TIMESTAMP_RE, "")
          : value;
        return { key, label, displayOp, displayValue };
      });
  }, [filters, filterProperties]);

  if (activeChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeChips.map(({ key, label, displayOp, displayValue }) => (
        <Badge key={key} variant="secondary" className="gap-1 pr-1 font-normal">
          <span>
            <span className="font-medium">{label}</span>
            {displayOp && <span className="text-muted-foreground"> {displayOp}</span>}
            <span>: {displayValue}</span>
          </span>
          <button
            type="button"
            className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => onRemoveFilter(key)}
            aria-label={`Remove ${label} filter`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      {activeChips.length >= 2 && onClearAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
