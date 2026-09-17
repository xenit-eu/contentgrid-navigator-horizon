import { Children, type ReactNode, useEffect, useRef, useState } from "react";
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  TrayIcon as Tray,
} from "@phosphor-icons/react";
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
  /**
   * Rendered at the start of the pagination footer bar (e.g. a "Showing 20 of 100 items"
   * summary). The footer bar renders whenever this is set, even with no next/previous page.
   */
  footerContent?: ReactNode;

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
  footerContent,
  tableActions,
  showActionsColumn,
  onCreateClick,
  children,
  className,
}: Readonly<RecordDataTableProps>) {
  const isEmpty = Children.count(children) === 0;
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const rowGroupRef = useRef<HTMLDivElement>(null);

  // The rowgroup's own vertical scrollbar (when one is rendered) eats into its content width,
  // shrinking the space available to its rows — but the header wrapper never scrolls vertically,
  // so it never loses that width, and its columns drift out of alignment with the row cells
  // below them. Mirror the rowgroup's actual scrollbar width as right padding on the header so
  // both compute their column tracks against the same available width. Measured via
  // ResizeObserver (rather than only on mount) because the scrollbar can appear or disappear
  // later purely from a content-box change — e.g. the row count changing on pagination — without
  // the rowgroup's own border-box size changing.
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  useEffect(() => {
    const rowGroupEl = rowGroupRef.current;
    if (!rowGroupEl) return;

    const measure = () => setScrollbarWidth(rowGroupEl.offsetWidth - rowGroupEl.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(rowGroupEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {tableActions && (
        <div className="flex shrink-0 items-center justify-end gap-2">{tableActions}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-md border overflow-hidden">
        <div role="table" className="flex min-h-0 flex-1 flex-col">
          {/* An element with `overflow-y` set to anything but `visible` forces its `overflow-x`
              to become non-visible too (CSS overflow spec) — so the rowgroup below, which must
              scroll vertically, unavoidably becomes its own independent horizontal-scroll
              container as well; it can't simply pass horizontal overflow up to an ancestor.
              Rather than fight that, this header wrapper's `scrollLeft` is kept in sync with the
              rowgroup's via the rowgroup's `onScroll` below (the standard "frozen header" trick)
              — `overflow-x-hidden` here means the header has no scrollbar of its own and isn't
              user-draggable, but remains freely scrollable by setting `scrollLeft` in JS, and
              `position: sticky` on its trailing actions cell still tracks that scroll offset.
              `paddingRight: scrollbarWidth` mirrors the rowgroup's actual vertical scrollbar
              width (0 when it isn't showing one) so the header's columns line up with the row
              cells below them instead of drifting by the scrollbar's width. */}
          <div
            ref={headerScrollRef}
            className="shrink-0 overflow-x-hidden"
            style={{ paddingRight: scrollbarWidth }}
          >
            <RecordTableHeader
              columns={columns}
              sortOptions={sortOptions}
              currentSort={currentSort}
              onSort={onSort}
              showActionsColumn={showActionsColumn}
            />
          </div>

          <div
            ref={rowGroupRef}
            role="rowgroup"
            // `tabIndex={0}` makes this scrollable region keyboard-reachable on its own —
            // required whenever its rows don't happen to carry a focusable element themselves
            // (e.g. no row `onClick`), which axe's `scrollable-region-focusable` rule (rightly)
            // flags: a sighted mouse user can drag-scroll a tall list, but a keyboard-only user
            // has no way to reach it otherwise.
            tabIndex={0}
            className="min-h-0 flex-1 overflow-auto"
            onScroll={(event) => {
              if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
              }
            }}
          >
            {isEmpty ? (
              // `role="rowgroup"` requires a `role="row"` child (which itself requires a
              // `role="cell"`/`columnheader` child) per the ARIA table content model — axe's
              // `aria-required-children` flags a bare div here, and would also flag the
              // "Add new item" button below as a disallowed child of `role="table"` /
              // `role="rowgroup"` if it weren't wrapped in one.
              <div role="row">
                <div
                  role="cell"
                  className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
                >
                  <Tray className="size-10" aria-hidden />
                  <p className="text-sm font-medium">No {entityTitle ?? entityName} found</p>
                  {onCreateClick && (
                    <Button variant="outline" size="sm" onClick={onCreateClick}>
                      Add new item to {entityTitle ?? entityName}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>

        {(onNextPageClick || onPreviousPageClick || footerContent) && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/70 p-2">
            <div className="px-2 text-xs text-muted-foreground">{footerContent}</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!onPreviousPageClick}
                onClick={onPreviousPageClick}
              >
                <CaretLeft aria-hidden />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!onNextPageClick}
                onClick={onNextPageClick}
              >
                Next
                <CaretRight aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { RecordDataTable };
