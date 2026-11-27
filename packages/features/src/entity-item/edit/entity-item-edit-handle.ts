/**
 * Lets the caller drive an item's edit mode from outside the item, e.g. from Edit and Cancel edit
 * buttons in the page's toolbar. Pass a ref to a variation's `editHandleRef`; the variation then
 * draws no Edit or Cancel button of its own. The caller still decides whether to offer Edit (see
 * `isEditableEntityItem`) and hears the mode through `onEditingChange`.
 */
export interface EntityItemEditHandle {
  /** Opens the update form in the Attributes section, expanding what holds it. */
  readonly startEdit: () => void;
  /**
   * Leaves edit mode. Same as the form's own Cancel: with unsaved changes it asks for confirmation
   * first.
   */
  readonly cancelEdit: () => void;
}
