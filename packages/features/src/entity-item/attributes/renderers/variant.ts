/**
 * Where an attribute value is rendered:
 * - `"default"` — label-prefixed chips (audit timeline, relation previews).
 * - `"item-reference"` — `EntityItemReference` titles/subtitles: chips without the label prefix.
 * - `"table"` — `EntityItemCollectionTable` columns.
 * - `"attribute-table"` — the entity item detail page's attribute table.
 */
export type AttributeRendererVariant = "default" | "item-reference" | "table" | "attribute-table";

/** True for both table variants — renderers that look the same in either table branch on this. */
export function isTableVariant(variant: AttributeRendererVariant): boolean {
  return variant === "table" || variant === "attribute-table";
}
