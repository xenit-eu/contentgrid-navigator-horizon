import { type ReactNode, useCallback, useState } from "react";
import { CheckIcon as Check, MagnifyingGlassIcon as MagnifyingGlass } from "@phosphor-icons/react";
import { cn, formatCellValue } from "../../lib/utils";
import { Button } from "../../primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  /**
   * Called once, when the user confirms the dialog, with every currently selected item's
   * href — a single-element array in single-select mode, one or more in multi-select mode.
   */
  onSelect: (hrefs: string[]) => void;
  /**
   * Rendered next to the search input when provided — e.g. a "Create new"
   * link to the target's own create page. This component has no routing
   * knowledge; the caller supplies the already-built node (see
   * packages/ui/CLAUDE.md's "accept already-resolved... from the caller" rule).
   */
  createNewLink?: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  onSelect,
  createNewLink,
}: Readonly<EntityPickerProps>) {
  // Single-select state
  const [selectedHref, setSelectedHref] = useState<string | null>(null);

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set());

  const toggleItem = useCallback((href: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  function resetState() {
    setSelectedHref(null);
    setSelectedItems(new Set());
    onSearch("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  function handleConfirm() {
    const hrefs = multiSelect ? [...selectedItems] : selectedHref ? [selectedHref] : [];
    if (hrefs.length === 0) return;
    onSelect(hrefs);
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
            <TableHead className="w-10" />
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
            return (
              <TableRow
                key={item.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50",
                )}
                onClick={() => {
                  if (multiSelect) {
                    toggleItem(item.href);
                  } else {
                    setSelectedHref(item.href);
                  }
                }}
              >
                <TableCell className="w-10 pr-0">
                  {isSelected && <Check className="text-primary size-4" />}
                </TableCell>
                {columnKeys.map((key) => (
                  <TableCell key={key} className={cn(isSelected && "font-medium")}>
                    {formatCellValue(item.data[key])}
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {multiSelect
              ? `Link ${titleCase(relationTitle)}`
              : `Select ${titleCase(relationTitle)}`}
          </DialogTitle>
          <DialogDescription>
            {multiSelect
              ? `Select one or more ${relationTitle.toLowerCase()} to link.`
              : `Choose a ${relationTitle.toLowerCase()} to link.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="text-muted-foreground absolute top-2.5 left-3 size-4" />
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
          {createNewLink}
        </div>

        <div className="max-h-80 overflow-auto rounded-md border">{resultsBody}</div>

        {(hasPreviousPage || hasNextPage) && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPreviousPage}
              onClick={onPreviousPage}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!hasSelection}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
