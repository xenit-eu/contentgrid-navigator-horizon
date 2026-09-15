/**
 * Humanizes a raw HAL-FORMS property/search-group name (e.g. `invoice_number` -> `Invoice
 * Number`) for the case where neither the template's own `prompt` nor a profile-derived title is
 * available. Shared between `entity-item-create`'s and `search`'s field-descriptor bridges — both
 * fall back to this only when the server hasn't already supplied a human-readable label.
 */
export function formatFieldName(name: string): string {
  return name
    .replace(/[._]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
