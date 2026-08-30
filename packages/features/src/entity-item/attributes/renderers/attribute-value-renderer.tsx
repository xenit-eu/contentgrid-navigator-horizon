import {
  AttributeKind,
  type EntityItemAttribute,
  ProfileAttributeType,
} from "@contentgrid/navigator-data";
import { useAttributeRendererComponents } from "./registry";

export interface AttributeValueRendererProps {
  readonly attr: EntityItemAttribute;
}

/**
 * Renders just an attribute's value (no label) — for compact contexts that
 * already show the attribute label separately (relation previews, reference
 * titles). Nested/object attributes render nothing; see `AttributeCell` for
 * the labeled, full-cell variant used by the main attribute grid.
 */
export function AttributeValueRenderer({ attr }: Readonly<AttributeValueRendererProps>) {
  const components = useAttributeRendererComponents();

  if (attr.value.kind === AttributeKind.CONTENT) {
    return <components.content metadata={attr.value.metadata} />;
  }
  if (attr.value.kind === AttributeKind.NESTED) {
    return null;
  }
  if (attr.value.kind === AttributeKind.UNKNOWN) {
    return <components.unknown />;
  }

  const type = attr.profileAttribute?.type;
  if (type === ProfileAttributeType.boolean) {
    const value = attr.value.value as boolean | null;
    const label = value === true ? "Yes" : value === false ? "No" : "Not set";
    return <components.boolean value={value} label={label} />;
  }
  if (type === ProfileAttributeType.long || type === ProfileAttributeType.double) {
    return <components.number value={attr.value.value as number | null} type={type} />;
  }
  if (type === ProfileAttributeType.date || type === ProfileAttributeType.datetime) {
    return <components.date value={attr.value.value as string | null} type={type} />;
  }
  return <components.string value={attr.value.value} />;
}
