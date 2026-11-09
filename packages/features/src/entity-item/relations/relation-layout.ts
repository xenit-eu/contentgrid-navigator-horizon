import { type PaneWidth, usePaneWidth } from "@contentgrid/ui";

/** Pane width (px) from which a to-many relation shows its full record table. */
export const TO_MANY_TABLE_MIN_WIDTH = 560;

/**
 * Pane widths (px) from which a to-one relation shows extra attributes of the related item
 * under its reference, and in how many columns. Below the first step only the reference shows.
 */
const TO_ONE_SUMMARY_STEPS = [
  { minWidth: 880, columns: 4 },
  { minWidth: 640, columns: 3 },
  { minWidth: 400, columns: 2 },
] as const;

/** Rows of extra attributes a to-one relation shows at most, whatever the column count. */
const TO_ONE_SUMMARY_ROWS = 2;

export interface RelationLayout {
  /** To-many: full record table (`true`) or a compact stack of item references (`false`). */
  readonly toManyTable: boolean;
  /** To-one: columns of extra attributes under the item reference; 0 shows the reference only. */
  readonly toOneSummaryColumns: 0 | 2 | 3 | 4;
  /** To-one: how many extra attributes to show (fills `TO_ONE_SUMMARY_ROWS` rows). */
  readonly toOneSummaryCount: number;
}

/** Layout for a relation section rendered outside any resizable pane, e.g. the full item page. */
const WIDEST_LAYOUT: RelationLayout = {
  toManyTable: true,
  toOneSummaryColumns: 4,
  toOneSummaryCount: 4 * TO_ONE_SUMMARY_ROWS,
};

/**
 * Relation layout for the pane a relation section sits in (`usePaneWidth()`).
 *
 * - Outside a pane (`undefined`): the widest layout — the section has the page to itself.
 * - Inside a pane that hasn't been measured yet: the most compact layout, so a narrow side panel
 *   never flashes a table it can't fit before its first measurement.
 */
export function relationLayoutForPane(pane: PaneWidth | undefined): RelationLayout {
  if (pane === undefined) return WIDEST_LAYOUT;
  const width = pane.width ?? 0;
  const step = TO_ONE_SUMMARY_STEPS.find((s) => width >= s.minWidth);
  const columns = step?.columns ?? 0;
  return {
    toManyTable: width >= TO_MANY_TABLE_MIN_WIDTH,
    toOneSummaryColumns: columns,
    toOneSummaryCount: columns * TO_ONE_SUMMARY_ROWS,
  };
}

/** `relationLayoutForPane` for the pane the calling component is rendered in. */
export function useRelationLayout(): RelationLayout {
  return relationLayoutForPane(usePaneWidth());
}
