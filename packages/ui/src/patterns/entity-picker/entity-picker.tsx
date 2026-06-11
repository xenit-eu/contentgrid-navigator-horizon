import { type ReactNode, useCallback, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  ListFilter,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { cn, formatCellValue } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/dialog";
import { Input } from "../../primitives/input";
import { Skeleton } from "../../primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../primitives/table";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single selectable option in the picker */
export interface EntityPickerOption {
  /** Unique identifier for this option */
  id: string;
  /** Stable href / self-link URI used as the selection value */
  href: string;
  /** Attribute data, keyed by attribute name */
  data: Record<string, unknown>;
}

/** Column descriptor controlling which data fields are shown */
export interface EntityPickerColumn {
  /** Attribute name */
  key: string;
  /** Column header label */
  header: string;
}

export interface EntityPickerProps {
  /** Controls dialog visibility */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title used in the dialog heading, e.g. "Invoice" */
  relationTitle: string;
  /** Current loaded page of options */
  options: EntityPickerOption[];
  /** Columns to display; when empty the picker falls back to the first data keys */
  columns?: EntityPickerColumn[];
  /** True while options are being fetched */
  isLoading?: boolean;
  /** Current search query — controlled externally so the caller can debounce / fetch */
  searchQuery: string;
  /** Hint text for the search input placeholder */
  searchPlaceholder?: string;
  /** Called when the user types in the search box */
  onSearch: (query: string) => void;
  /** True when a previous page is available */
  hasPreviousPage?: boolean;
  /** True when a next page is available */
  hasNextPage?: boolean;
  /** Called when the user clicks "Previous" */
  onPreviousPage?: () => void;
  /** Called when the user clicks "Next" */
  onNextPage?: () => void;
  /** Allow selecting multiple items at once */
  multiSelect?: boolean;
  /** Total number of matching items, shown in the pagination summary ("Showing N of total") */
  totalCount?: number;
  /** When provided, renders a "Filters" button in the toolbar */
  onOpenFilters?: () => void;
  /** When provided, renders a "Create new" button in the toolbar */
  onCreateNew?: () => void;
  /** Called with the selected href(s) and display label(s) when the user confirms */
  onSelect: (href: string, displayLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemLabel(item: EntityPickerOption): string {
  const firstVal = Object.entries(item.data).find(
    ([k, v]) => !k.startsWith("_") && k !== "id" && v != null,
  );
  return firstVal ? String(firstVal[1]) : item.id;
}

function resolveColumnKeys(
  options: EntityPickerOption[],
  columns?: EntityPickerColumn[],
): string[] {
  if (columns && columns.length > 0) return columns.map((c) => c.key);
  if (!options[0]) return [];
  return Object.keys(options[0].data)
    .filter((k) => !k.startsWith("_") && k !== "id")
    .slice(0, 4);
}

function resolveColumnHeaders(columnKeys: string[], columns?: EntityPickerColumn[]): string[] {
  if (columns && columns.length > 0) return columns.map((c) => c.header);
  return columnKeys;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Stable keys for the loading-state skeleton rows. */
const SKELETON_ROWS = ["s1", "s2", "s3"];

/**
 * Renders a single table cell value. Booleans become soft status pills
 * (matching the design mockup's bool-pill); everything else is formatted text.
 */
function renderCellValue(value: unknown): ReactNode {
  if (typeof value === "boolean") {
    return value ? (
      <Badge variant="successSubtle">
        <CheckCircle2 />
        Active
      </Badge>
    ) : (
      <Badge variant="dangerSubtle">
        <XCircle />
        Inactive
      </Badge>
    );
  }
  return formatCellValue(value);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function EntityPicker({
  open,
  onOpenChange,
  relationTitle,
  options,
  columns,
  isLoading,
  searchQuery,
  searchPlaceholder,
  onSearch,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  multiSelect = false,
  totalCount,
  onOpenFilters,
  onCreateNew,
  onSelect,
}: Readonly<EntityPickerProps>) {
  // Single-select state
  const [selectedHref, setSelectedHref] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Map<string, string>>(() => new Map());

  const toggleItem = useCallback((href: string, label: string) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.set(href, label);
      }
      return next;
    });
  }, []);

  function resetState() {
    setSelectedHref(null);
    setSelectedLabel("");
    setSelectedItems(new Map());
    onSearch("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  function handleConfirm() {
    if (multiSelect) {
      for (const [href, label] of selectedItems) {
        onSelect(href, label);
      }
    } else {
      if (!selectedHref) return;
      onSelect(selectedHref, selectedLabel);
    }
    resetState();
    onOpenChange(false);
  }

  let selectionCount: number;
  if (multiSelect) {
    selectionCount = selectedItems.size;
  } else {
    selectionCount = selectedHref ? 1 : 0;
  }
  const hasSelection = selectionCount > 0;

  let confirmLabel: string;
  if (multiSelect && selectionCount > 1) {
    confirmLabel = `Link ${selectionCount} items`;
  } else if (multiSelect) {
    confirmLabel = "Link";
  } else {
    confirmLabel = "Select";
  }

  const columnKeys = resolveColumnKeys(options, columns);
  const columnHeaders = resolveColumnHeaders(columnKeys, columns);

  let resultsBody: ReactNode;
  if (isLoading) {
    resultsBody = (
      <div className="space-y-2 p-4">
        {SKELETON_ROWS.map((rowKey) => (
          <Skeleton key={rowKey} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (options.length === 0) {
    resultsBody = <p className="text-muted-foreground p-6 text-center text-sm">No items found.</p>;
  } else {
    resultsBody = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[34px]" />
            {columnHeaders.map((header, i) => (
              <TableHead key={columnKeys[i]}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((item) => {
            const isSelected = multiSelect
              ? selectedItems.has(item.href)
              : selectedHref === item.href;
            const select = () => {
              if (multiSelect) {
                toggleItem(item.href, getItemLabel(item));
              } else {
                setSelectedHref(item.href);
                setSelectedLabel(getItemLabel(item));
              }
            };
            return (
              <TableRow
                key={item.id}
                data-state={isSelected ? "selected" : undefined}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/50",
                )}
                onClick={select}
              >
                <TableCell className="w-[34px] pr-0">
                  <input
                    type={multiSelect ? "checkbox" : "radio"}
                    name="entity-picker-selection"
                    checked={isSelected}
                    onChange={select}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${getItemLabel(item)}`}
                    className="accent-primary size-4 cursor-pointer align-middle"
                  />
                </TableCell>
                {columnKeys.map((key, i) => (
                  <TableCell key={key} className={cn(i === 0 && isSelected && "font-semibold")}>
                    {renderCellValue(item.data[key])}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[780px]" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center gap-2.5">
          <Link2 className="text-primary size-[18px] shrink-0" />
          <DialogTitle className="flex-1">{`Link ${titleCase(relationTitle)}`}</DialogTitle>
          <span className="text-muted-foreground text-xs">
            {`${multiSelect ? "to-many" : "to-one"} · ${titleCase(relationTitle)}`}
          </span>
        </DialogHeader>

        <div className="mb-3 flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              placeholder={searchPlaceholder ?? "Search..."}
              value={searchQuery}
              onChange={(e) => {
                onSearch(e.target.value);
                if (!multiSelect) setSelectedHref(null);
              }}
              className="pl-9"
            />
          </div>
          {onOpenFilters && (
            <Button variant="outline" onClick={onOpenFilters}>
              <ListFilter className="size-4" />
              Filters
            </Button>
          )}
          {onCreateNew && (
            <Button onClick={onCreateNew}>
              <Plus className="size-4" />
              Create new
            </Button>
          )}
        </div>

        <div className="border-border overflow-hidden rounded-lg border">{resultsBody}</div>

        {(hasPreviousPage || hasNextPage) && (
          <div className="text-muted-foreground mt-3 flex items-center justify-between text-[13px]">
            <span>
              {totalCount != null
                ? `Showing ${options.length} of ${totalCount}`
                : `Showing ${options.length}`}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPreviousPage}
                onClick={onPreviousPage}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={onNextPage}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" data-dialog-ghost onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!hasSelection}>
            <Link2 className="size-4" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
