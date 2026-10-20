import type { HalFormsProperty } from "@contentgrid/hal-forms";
import type { ProfileAttribute } from "../attribute-profile";
import type ProfileEntity from "../entity-profile";

/**
 * A create- or update-form property for a user-defined attribute, enhanced with profile metadata.
 */
export interface FormAttributeProperty {
  /** The original HAL-FORMS property */
  property: HalFormsProperty;
  /** The ProfileAttribute this property maps to (for type, constraints, validation) */
  profileAttribute?: ProfileAttribute;
  /** Whether this field is required */
  isRequired: boolean;
  /** Whether this is a content/file upload field */
  isContent: boolean;
  /** Allowed values for enum-like fields */
  allowedValues?: readonly string[];
}

/** Enhance a user-defined attribute property of a create or update form with profile metadata. */
export function toFormAttributeProperty(
  property: HalFormsProperty,
  profileEntity: ProfileEntity,
): FormAttributeProperty {
  const profileAttribute = profileEntity.getAttribute(property.name);
  const isContent = property.type === "file" || (profileAttribute?.isContent ?? false);
  const isRequired = property.required ?? false;

  // Extract allowed values from inline options
  const allowedValues =
    property.options?.isInline() && Array.isArray(property.options.inline)
      ? property.options.inline.filter((v): v is string => typeof v === "string")
      : undefined;

  return {
    property,
    profileAttribute,
    isRequired,
    isContent,
    allowedValues,
  };
}
