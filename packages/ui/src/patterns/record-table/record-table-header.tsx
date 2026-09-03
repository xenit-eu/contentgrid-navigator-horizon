import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  ArrowsDownUpIcon as ArrowsDownUp,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
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

export interface RecordTableHeaderProps {
  /** Column definitions */
  columns: RecordTableColumn[];
  /** Available sort options, e.g. parsed from a HAL-FORMS `_sort` template field */
  sortOptions?: readonly RecordTableSortOption[];
  /** Currently active sort values, e.g. ["name,asc"] — supports more than one active column */
  currentSort?: readonly string[];
  /** Called with the clicked column's next sort option (or undefined to clear it) */
  onSort?: (option: RecordTableSortOption | undefined) => void;
  /** Reserves a trailing header cell to match a row-level actions column */
  showActionsColumn?: boolean;
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

function sortIcon(direction: "asc" | "desc" | undefined) {
  if (direction === "asc") return <ArrowUp className="ml-1 size-3.5" aria-hidden />;
  if (direction === "desc") return <ArrowDown className="ml-1 size-3.5" aria-hidden />;
  return <ArrowsDownUp className="ml-1 size-3.5 text-muted-foreground/50" aria-hidden />;
}

function RecordTableHeader({
  columns,
  sortOptions,
  currentSort,
  onSort,
  showActionsColumn,
  className,
}: Readonly<RecordTableHeaderProps>) {
  const gridTemplateColumns = getRecordTableGridTemplate(columns.length, {
    hasActions: showActionsColumn,
  });

  return (
    <TooltipProvider>
      <div role="rowgroup" className={cn("shrink-0", className)}>
        <div
          role="row"
          style={{ gridTemplateColumns }}
          className={cn(
            "grid items-center gap-3 px-4 py-2 border-b border-[#F1F4F7] dark:border-[#1B3A50] bg-muted/70",
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
  );
}

export { RecordTableHeader };
