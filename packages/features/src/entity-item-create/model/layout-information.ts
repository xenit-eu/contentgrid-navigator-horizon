/**
 * One visual grouping of fields, referenced by name so `form-container.tsx` can look each field
 * up in the `FieldDescriptor[]` returned alongside this layout, rather than duplicating
 * descriptors inside the layout itself.
 */
export interface FieldGroup {
  /** Omitted for an ungrouped/flat list — the only shape a create-form produces today. */
  readonly title?: string;
  readonly fieldNames: readonly string[];
}

/**
 * Structural information alongside a resolved `FieldDescriptor[]` describing how to arrange them
 * — kept as its own type (rather than baked into `FieldDescriptor[]` order) so a future
 * multi-group layout (e.g. a search form's filter/sort sections) doesn't need a second bridge
 * shape. `resolveCreateFieldDescriptors` only ever produces a single, unnamed group today.
 */
export interface LayoutInformation {
  readonly groups: readonly FieldGroup[];
}
