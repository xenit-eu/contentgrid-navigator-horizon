import type { ReactNode } from "react";
import type { QuickFilterModel } from "../util/build-quick-filters";

export interface QuickFilterRowProps {
  readonly quickFilters: readonly QuickFilterModel[];
  /** Renders one quick filter; `undefined` skips it. */
  readonly renderQuickFilter: (quickFilter: QuickFilterModel) => ReactNode;
  /** Controls kept at the right end of the row, outside the scrolling area. */
  readonly actions?: ReactNode;
}

/**
 * The third row of the search bar: one quick-filter button per attribute, in a single line that
 * scrolls horizontally rather than wrapping when it runs out of room (FR-031), with the page's
 * own controls (e.g. Columns, Filters) right-aligned next to it, never scrolled away.
 */
export function QuickFilterRow({
  quickFilters,
  renderQuickFilter,
  actions,
}: Readonly<QuickFilterRowProps>) {
  if (quickFilters.length === 0 && !actions) return null;
  return (
    <div data-slot="quick-filter-row" className="flex items-center gap-2">
      <div
        role="toolbar"
        aria-label="Quick filters"
        className="scrollbar-subtle flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1"
      >
        {quickFilters.map((quickFilter) => (
          <span key={quickFilter.groupKey} className="contents">
            {renderQuickFilter(quickFilter)}
          </span>
        ))}
      </div>
      {actions && (
        <div data-slot="quick-filter-row-actions" className="flex shrink-0 items-center gap-2 pb-1">
          {actions}
        </div>
      )}
    </div>
  );
}
