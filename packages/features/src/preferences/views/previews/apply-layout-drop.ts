/**
 * One row in the create-form layout editor's local state — either one field name (rendered full
 * width) or two (rendered side by side). `id` is a stable synthetic identifier for React keys and
 * for `applyLayoutDrop`'s own row lookups; it has no meaning outside this editor and is never
 * persisted (`EntityCreateFormPreview` persists `row.fieldNames` only, as the `createFormLayout`
 * display preference).
 */
export interface LayoutRow {
  readonly id: string;
  readonly fieldNames: readonly string[];
}

/** Builds editor rows from the plain `string[][]` shape `resolveCreateFieldDescriptors` produces. */
export function rowsFromFieldNameRows(rows: readonly (readonly string[])[]): LayoutRow[] {
  return rows.map((fieldNames) => ({ id: crypto.randomUUID(), fieldNames }));
}

/**
 * Pure reducer for one drag-and-drop layout edit — no React, no persistence, easy to unit test in
 * isolation from dnd-kit's pointer-event machinery. `activeId`/`overId` are the raw `active.id`/
 * `over.id` strings off a dnd-kit `DragEndEvent` (`create-form-layout-editor.tsx` names them
 * `field:<name>`, `row:<rowId>`, `gap:<index>`).
 *
 * Returns the same `rows` reference, unchanged, for any drag that isn't a recognized drop —
 * dropping a field onto its own row, onto an already-full (two-field) row, or an unparseable id —
 * so callers can skip persisting/re-rendering with a `===` check.
 *
 * Two distinct drop targets, two distinct effects:
 * - Drop onto a **row** (`row:<rowId>`) that currently holds exactly one *different* field: moves
 *   the dragged field out of its current row (removing that row entirely if it only held the one
 *   field) and appends it to the target row, making it two-up.
 * - Drop onto a **gap** (`gap:<index>`, the space above/below/between rows): moves the dragged
 *   field out of its current row the same way, then inserts it as a brand-new full-width row at
 *   that gap position — this is how a two-up row gets split back apart, and doubles as a general
 *   "reorder this row" mechanism for an already-full-width row.
 */
export function applyLayoutDrop(
  rows: readonly LayoutRow[],
  activeId: string,
  overId: string,
): readonly LayoutRow[] {
  const [activeType, activeFieldName] = activeId.split(":");
  if (activeType !== "field") return rows;

  const sourceRowIndex = rows.findIndex((row) => row.fieldNames.includes(activeFieldName));
  if (sourceRowIndex === -1) return rows;

  const [overType, overTarget] = overId.split(":");

  if (overType === "row") {
    const targetRowIndex = rows.findIndex((row) => row.id === overTarget);
    if (targetRowIndex === -1 || targetRowIndex === sourceRowIndex) return rows;
    if (rows[targetRowIndex].fieldNames.length >= 2) return rows;

    const withoutSource = removeFieldFromRows(rows, sourceRowIndex, activeFieldName);
    return withoutSource.map((row) =>
      row.id === overTarget ? { ...row, fieldNames: [...row.fieldNames, activeFieldName] } : row,
    );
  }

  if (overType === "gap") {
    const gapIndex = Number(overTarget);
    if (!Number.isInteger(gapIndex)) return rows;

    const withoutSource = removeFieldFromRows(rows, sourceRowIndex, activeFieldName);
    // Removing the source row (when it only held the one field) shifts every later gap index
    // down by one — account for that before inserting at the (possibly now-different) position.
    const sourceRowRemoved = rows[sourceRowIndex].fieldNames.length === 1;
    const adjustedGapIndex =
      sourceRowRemoved && sourceRowIndex < gapIndex ? gapIndex - 1 : gapIndex;

    const next = [...withoutSource];
    next.splice(adjustedGapIndex, 0, { id: crypto.randomUUID(), fieldNames: [activeFieldName] });
    return next;
  }

  return rows;
}

function removeFieldFromRows(
  rows: readonly LayoutRow[],
  sourceRowIndex: number,
  fieldName: string,
): LayoutRow[] {
  return rows
    .map((row, i) =>
      i === sourceRowIndex
        ? { ...row, fieldNames: row.fieldNames.filter((name) => name !== fieldName) }
        : row,
    )
    .filter((row) => row.fieldNames.length > 0);
}
