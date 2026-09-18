/**
 * One row of a layout schema — one field name (rendered full width) or two (rendered side by
 * side, FR-003). Never more than two; a caller producing three-or-more must have already
 * collapsed/split before this shape is built.
 */
export interface FieldRow {
  readonly fieldNames: readonly string[];
}

/**
 * One visual grouping of rows, optionally titled/described and independently collapsible
 * (FR-025–FR-027) — e.g. all the search properties of one related profile, grouped under that
 * relation's name. Originated as `entity-item-create`'s `FieldGroup` (ADR-004); renamed and
 * extended here since "section" is the term both the spec and this shape's actual use (a titled,
 * possibly-collapsible chunk of a form, not just a bare row grouping) now call for.
 */
export interface FieldSection {
  /** Optional — an ungrouped/flat section (the only shape this feature produced before sections
   *  existed) renders no header at all. */
  readonly title?: string;
  /** Optional supporting text shown under the title. Has no effect with no `title` set — a
   *  section's header is either fully present or fully absent, never description-only. */
  readonly description?: string;
  /**
   * FR-027: when true, the section's rows collapse/expand together as one unit — never
   * per-row — with the header (title/description) doubling as the toggle. Expanded by default;
   * omitted or `false` renders the rows with no collapse behavior at all, same as before this
   * field existed.
   */
  readonly isCollapsible?: boolean;
  readonly rows: readonly FieldRow[];
}

/**
 * Structural information alongside a resolved `HalFormsField[]` describing how to arrange them.
 * A field name absent from every row of every section is not rendered (FR-004) — omission is the
 * default, not an opt-out.
 */
export interface LayoutSchema {
  readonly sections: readonly FieldSection[];
}
