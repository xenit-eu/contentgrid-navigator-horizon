/**
 * Where an attribute value is rendered:
 * - `"default"` — label-prefixed chips (audit timeline, relation previews).
 * - `"item-reference"` — `EntityItemReference` titles/subtitles: chips without the label prefix.
 * - `"table"` — `EntityItemCollectionTable` columns (relation sections, pickers).
 * - `"collection-table"` — the collection page's table: as `"table"`, plus pills for booleans and a
 *   file tile in file columns.
 * - `"attribute-table"` — the entity item detail page's attribute table.
 */
export type AttributeRendererVariant =
  | "default"
  | "item-reference"
  | "table"
  | "collection-table"
  | "attribute-table";

/** True for every table variant — renderers that look the same in any table branch on this. */
export function isTableVariant(variant: AttributeRendererVariant): boolean {
  return variant === "table" || variant === "collection-table" || variant === "attribute-table";
}
