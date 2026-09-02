import {
  AttributeKind,
  type EntityItemAttribute,
  ProfileAttributeType,
} from "@contentgrid/navigator-data";
import { useAttributeValueRendererComponents } from "./registry";

export interface AttributeValueRendererProps {
  readonly attr: EntityItemAttribute;
}

/**
 * Renders just an attribute's value (no label) — for compact contexts that
 * already show the attribute label separately (relation previews, reference
 * titles, and the main attribute table). Nested/object attributes render
 * nothing.
 */
export function AttributeValueRenderer({ attr }: Readonly<AttributeValueRendererProps>) {
  const components = useAttributeValueRendererComponents();

  if (attr.value.kind === AttributeKind.CONTENT) {
    return <components.content metadata={attr.value.metadata} />;
  }
  if (attr.value.kind === AttributeKind.NESTED) {
    return null;
  }
  if (attr.value.kind === AttributeKind.UNKNOWN) {
    return <components.unknown />;
  }

  if (attr.profileAttribute?.isCreatedDate) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return <components.createdDate value={attr.value.value as string | null} label={label} />;
  }
  if (attr.profileAttribute?.isModifiedDate) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return <components.modifiedDate value={attr.value.value as string | null} label={label} />;
  }
  if (attr.profileAttribute?.isCreatedBy) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return <components.createdBy value={attr.value.value} label={label} />;
  }
  if (attr.profileAttribute?.isModifiedBy) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return <components.modifiedBy value={attr.value.value} label={label} />;
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
  if (type === ProfileAttributeType.date) {
    return <components.date value={attr.value.value as string | null} />;
  }
  if (type === ProfileAttributeType.datetime) {
    return <components.datetime value={attr.value.value as string | null} />;
  }
  return <components.string value={attr.value.value} />;
}
