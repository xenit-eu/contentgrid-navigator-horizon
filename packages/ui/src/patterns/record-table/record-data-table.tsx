import { Children, type ReactNode } from "react";
import { TrayIcon as Tray } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { RecordTableHeader } from "./record-table-header";
import type { RecordTableColumn, RecordTableSortOption } from "./record-table-header";

export interface RecordDataTableProps {
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

  /**
   * Extra class names on the root element. The root has no forced height of its own — pass a
   * bounding class here (e.g. `"h-full"` or `"flex-1 min-h-0"`) to opt into the scrollable
   * layout: the column header and pagination footer stay pinned while only the row list
   * (`role="rowgroup"`) scrolls. Expects a height-constrained parent for that to take effect —
   * same convention `BreadCrumbsToolBarLayout`/`PageLayout` already document. Without a bounded
   * height, the table simply grows to fit its content instead.
   */
  className?: string;
}

function RecordDataTable({
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
}: Readonly<RecordDataTableProps>) {
  const isEmpty = Children.count(children) === 0;

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {tableActions && (
        <div className="flex shrink-0 items-center justify-end gap-2">{tableActions}</div>
      )}

      <div role="table" className="flex min-h-0 flex-1 flex-col rounded-md border overflow-hidden">
        <RecordTableHeader
          columns={columns}
          sortOptions={sortOptions}
          currentSort={currentSort}
          onSort={onSort}
          showActionsColumn={showActionsColumn}
        />

        <div role="rowgroup" className="min-h-0 flex-1 overflow-y-auto">
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
        <div className="flex shrink-0 items-center justify-between pt-2">
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

export { RecordDataTable };
