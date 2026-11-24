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
   * Optional text at the start of the pagination footer bar (e.g. a "Showing 20 of 100 items"
   * summary), for tables whose page shows no count of its own. The footer bar renders whenever
   * this is set, even with no next/previous page; without it the bar holds only Previous and Next,
   * on the right.
   */
  footerContent?: ReactNode;

  tableActions?: ReactNode;

  /** Reserves a trailing column for row-level actions */
  showActionsColumn?: boolean;

  /** Checked state of the "select all" checkbox — `"indeterminate"` when some but not all rows are selected */
  selectionState?: boolean | "indeterminate";
  /** Called when the "select all" checkbox is toggled */
  onSelectAll?: (checked: boolean) => void;

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

  /**
   * Lets the page do the vertical scrolling instead of the table: the table grows with its rows,
   * and the column header sticks to the top of the nearest scrolling ancestor (the page) while
   * the rows scroll past; the footer follows the last row. Only horizontal overflow still
   * scrolls inside the table. Don't combine with a bounding `className`; and no ancestor between
   * the table and the page may scroll or clip vertically (`overflow: hidden/auto`), or the
   * header sticks to that one instead. Defaults to `false`: the existing contract above.
   */
  pageScroll?: boolean;
}

/** The nearest ancestor that scrolls or clips vertically: what a `position: sticky` child sticks to. */
function findScrollContainer(element: HTMLElement | null): HTMLElement | undefined {
  for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
    if (/auto|scroll|hidden|overlay/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return undefined;
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
  selectionState,
  onSelectAll,
  onCreateClick,
  children,
  className,
  pageScroll = false,
}: Readonly<RecordDataTableProps>) {
  const isEmpty = Children.count(children) === 0;
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const rowGroupRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Page scroll: a sticky header sticks `top` below the scroller's padding edge, so under a
  // padded page it would stop that far below the toolbar, with the rows scrolling past in the
  // gap above it. Pull it up by the scroller's own top padding so it sticks flush at its edge.
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    if (!pageScroll) return;
    const scroller = findScrollContainer(rootRef.current);
    if (!scroller) return;

    const measure = () => setStickyTop(-parseFloat(getComputedStyle(scroller).paddingTop) || 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [pageScroll]);

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-col gap-2", className)}>
      {tableActions && (
        <div className="flex shrink-0 items-center justify-end gap-2">{tableActions}</div>
      )}

      {/* `overflow-clip` rounds the corners like `overflow-hidden`, but is no scroll container,
          which would otherwise become the sticky header's scroller. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-md border",
          pageScroll ? "overflow-clip" : "overflow-hidden",
        )}
      >
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
            className={cn("shrink-0 overflow-x-hidden", pageScroll && "sticky z-10")}
            style={{ paddingRight: scrollbarWidth, top: pageScroll ? stickyTop : undefined }}
          >
            <RecordTableHeader
              columns={columns}
              sortOptions={sortOptions}
              currentSort={currentSort}
              onSort={onSort}
              showActionsColumn={showActionsColumn}
              selectionState={selectionState}
              onSelectAll={onSelectAll}
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
            // Page scroll: the rows are as tall as they are, so only horizontal overflow scrolls
            // here (`overflow-y` can't stay `visible` next to a scrolling `overflow-x`, but with
            // no height cap it never has anything to scroll).
            className={cn(
              "scrollbar-subtle min-h-0 flex-1",
              pageScroll ? "overflow-x-auto overflow-y-hidden" : "overflow-auto",
            )}
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
          <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-table-header px-3.5 py-2.5">
            {footerContent && (
              <div className="px-2 text-xs text-muted-foreground">{footerContent}</div>
            )}
            {/* Previous and Next sit at the right end, with or without footer content. */}
            <div className="ml-auto flex items-center gap-2">
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
