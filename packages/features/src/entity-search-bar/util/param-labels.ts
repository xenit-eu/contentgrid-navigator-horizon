import type { SearchParamDescriptor } from "./types";

/** The parameter's display name: the attribute, prefixed by the relation it goes through. */
export function paramLabel(descriptor: SearchParamDescriptor): string {
  return descriptor.relation
    ? `${descriptor.relation.title} · ${descriptor.attributeLabel}`
    : descriptor.attributeLabel;
}

/** The type indicator text shown next to a parameter in the selector (FR-008). */
export function searchTypeLabel(descriptor: SearchParamDescriptor): string {
  switch (descriptor.valueKind) {
    case "integer":
      return "Integer";
    case "decimal":
      return "Decimal";
    case "allowed-values":
      return "One of";
    default:
      break;
  }
  switch (descriptor.mode) {
    case "prefix":
      return "Starts with";
    case "full-text":
      return "Full text";
    default:
      return "Exact";
  }
}
