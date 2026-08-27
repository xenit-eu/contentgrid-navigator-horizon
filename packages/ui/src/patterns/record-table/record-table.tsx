import { Children, type ReactNode } from "react";
import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  ArrowsDownUpIcon as ArrowsDownUp,
  TrayIcon as Tray,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";
import { getRecordTableGridTemplate } from "./grid-template";

export interface RecordTableColumn {
  /** Machine-readable key matching a key in DataTableRow.data */
  key: string;
  /** Header label displayed in the column */
  header: string;
}

export interface RecordTableSortOption {
  /** Exact token to send as the active sort, e.g. "name,asc" */
  readonly value: string;
  /** Matches a RecordTableColumn.key */
  readonly property: string;
  /** Display label, e.g. "Name A→Z" */
  readonly prompt: string;
  /** Drives which arrow icon renders */
  readonly direction?: "asc" | "desc";
}

export interface RecordTableProps {
  /** Entity identifier used in empty-state messaging */
  entityName: string;
  /** Human-readable entity title used in empty-state messaging */
  entityTitle?: string;
  /** Column definitions */
  columns: RecordTableColumn[];

  /** Available sort options, e.g. parsed from a HAL-FORMS `_sort` template field */
  sortOptions?: readonly RecordTableSortOption[];
  /** Currently active sort values, e.g. ["name,asc"] — supports more than one active column */
  currentSort?: readonly string[];
  /** Called with the clicked column's next sort option (or undefined to clear it) */
  onSort?: (option: RecordTableSortOption | undefined) => void;

  /** Renders the next button as enabled */
  onNextPageClick?: () => void;
  /** Renders the previous button as enabled when passed */
  onPreviousPageClick?: () => void;

  tableActions?: ReactNode;

  /** Reserves a trailing column for row-level actions */
  showActionsColumn?: boolean;

  /** Called when the user clicks the create-new button in the empty state. Button is hidden if omitted. */
  onCreateClick?: () => void;

  /** RecordTableRows */
  children: ReactNode;

  className?: string;
}

function nextSortOption(
  options: readonly RecordTableSortOption[],
  current: RecordTableSortOption | undefined,
): RecordTableSortOption | undefined {
  const sequence = [...options, undefined];
  const currentIndex = current
    ? sequence.findIndex((option) => option?.value === current.value)
    : sequence.length - 1;
  return sequence[(currentIndex + 1) % sequence.length];
}

function RecordTable({
  entityName,
  entityTitle,
  columns,
  sortOptions,
  currentSort,
  onSort,
  onNextPageClick,
  onPreviousPageClick,
  tableActions,
  showActionsColumn,
  onCreateClick,
  children,
  className,
}: Readonly<RecordTableProps>) {
  const isEmpty = Children.count(children) === 0;
  const gridTemplateColumns = getRecordTableGridTemplate(columns.length, {
    hasActions: showActionsColumn,
  });

  function sortIcon(direction: "asc" | "desc" | undefined) {
    if (direction === "asc") return <ArrowUp className="ml-1 size-3.5" aria-hidden />;
    if (direction === "desc") return <ArrowDown className="ml-1 size-3.5" aria-hidden />;
    return <ArrowsDownUp className="ml-1 size-3.5 text-muted-foreground/50" aria-hidden />;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {tableActions && <div className="flex items-center justify-end gap-2">{tableActions}</div>}

      <div role="table" className="w-full rounded-md border overflow-hidden">
        <TooltipProvider>
          <div role="rowgroup">
            <div
              role="row"
              style={{ gridTemplateColumns }}
              className={cn(
                "grid items-center gap-3 px-4 py-2 border-b border-[#F1F4F7] dark:border-[#1B3A50] bg-muted/50",
              )}
            >
              {columns.map((column) => {
                const columnOptions = sortOptions?.filter((o) => o.property === column.key) ?? [];
                const activeOption = columnOptions.find((o) => currentSort?.includes(o.value));
                const next = nextSortOption(columnOptions, activeOption);

                return (
                  <div
                    key={column.key}
                    role="columnheader"
                    className="text-[13px] font-medium text-muted-foreground"
                  >
                    {columnOptions.length > 0 && onSort ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onSort(next)}
                            className="flex items-center hover:text-foreground transition-colors"
                          >
                            {column.header}
                            {sortIcon(activeOption?.direction)}
                          </button>
                        </TooltipTrigger>
                        {next && <TooltipContent side="bottom">{next.prompt}</TooltipContent>}
                      </Tooltip>
                    ) : (
                      column.header
                    )}
                  </div>
                );
              })}
              {showActionsColumn && <div role="columnheader" />}
            </div>
          </div>
        </TooltipProvider>

        <div role="rowgroup">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Tray className="size-10" aria-hidden />
              <p className="text-sm font-medium">No {entityTitle ?? entityName} found</p>
              {onCreateClick && (
                <Button variant="outline" size="sm" onClick={onCreateClick}>
                  Add new item to {entityTitle ?? entityName}
                </Button>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      {(onNextPageClick || onPreviousPageClick) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!onPreviousPageClick}
            onClick={onPreviousPageClick}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!onNextPageClick} onClick={onNextPageClick}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export { RecordTable };
