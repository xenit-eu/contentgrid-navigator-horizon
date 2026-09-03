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

export function getRecordTableGridTemplate(
  columnCount: number,
  options?: { hasActions?: boolean },
): string {
  if (columnCount < 1) return "";
  const rest = columnCount - 1;
  const tracks = ["minmax(200px, 1.6fr)", ...Array(rest).fill("minmax(0, 1fr)")];
  if (options?.hasActions) tracks.push(ACTIONS_COLUMN_WIDTH);
  return tracks.join(" ");
}
