import { AttributeKind, type EntityItemAttribute } from "@contentgrid/navigator-data";

/**
 * Single source of truth for rendering an attribute value as display text.
 * Used by the attribute grid and by the relation section previews below.
 */
export function formatAttributeValue(attr: EntityItemAttribute): string {
  switch (attr.value.kind) {
    case AttributeKind.PLAIN:
      return attr.value.value == null ? "—" : String(attr.value.value);
    case AttributeKind.CONTENT:
      return attr.value.metadata?.filename ?? "—";
    case AttributeKind.NESTED:
      return "(object)";
    default:
      return "—";
  }
}
