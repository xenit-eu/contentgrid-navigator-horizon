/**
 * Fixed width for the trailing actions column — comfortably fits up to two `icon-sm` (32px)
 * buttons plus their gap. Deliberately a FIXED size, not `min-content`: the header and every
 * row are separate CSS Grid containers (each `role="row"`/`role="rowgroup"` renders its own
 * `display: grid`, not a shared table layout), so a content-sized track computes independently
 * per row. `min-content` would size the (empty) header cell to ~0, and would size each row
 * differently depending on how many action buttons that particular row happens to render (e.g.
 * a row without delete permission vs. one with it) — producing a visibly jagged, misaligned
 * actions column. A fixed width guarantees the same track width everywhere.
 */
const ACTIONS_COLUMN_WIDTH = "72px";

/**
 * Minimum width for a non-reference data column. A real minimum (rather than `0`) is what makes
 * the table's horizontal scroll possible: `minmax(0, 1fr)` lets columns get squeezed down to
 * nothing as more are added, so the grid never actually overflows its container — there's simply
 * nothing to scroll. `minmax(140px, 1fr)` still lets columns grow to fill extra space, but once
 * total minimum widths exceed the container, the grid overflows and the horizontal-scroll wrapper
 * in `RecordDataTable` kicks in instead of crushing every column unreadably thin.
 */
const MIN_DATA_COLUMN_WIDTH = "140px";

export function getRecordTableGridTemplate(
  columnCount: number,
  options?: { hasActions?: boolean },
): string {
  if (columnCount < 1) return "";
  const rest = columnCount - 1;
  const tracks = [
    "minmax(200px, 1.6fr)",
    ...Array(rest).fill(`minmax(${MIN_DATA_COLUMN_WIDTH}, 1fr)`),
  ];
  if (options?.hasActions) tracks.push(ACTIONS_COLUMN_WIDTH);
  return tracks.join(" ");
}
