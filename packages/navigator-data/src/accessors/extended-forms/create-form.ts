import type { HalFormsProperty, HalFormsTemplate } from "@contentgrid/hal-forms";
import type { EntityInstanceCreateRequestSpec } from "../../api/requests";
import type { ProfileAttribute } from "../attribute-profile";
import type ProfileEntity from "../entity-profile";
import type { ProfileRelation } from "../relation-profile";

/**
 * Enhanced Create-Form HAL-FORMS Template Wrapper
 *
 * This class wraps a HAL-FORMS create template and enriches it with metadata
 * from the entity profile to make form rendering more ergonomic and type-safe.
 *
 * ## Property Classification
 *
 * Create-form properties are classified into:
 *
 * 1. **User-defined attributes** - Regular fields (text, number, datetime, checkbox)
 *    - Excludes system fields (id, audit metadata) - these never appear in create-form
 *    - Linked to ProfileAttribute for type, constraints, allowed values
 *
 * 2. **Content attributes** - File upload fields (type: "file")
 *    - Detected via property type OR ProfileAttribute.isContent
 *    - Renders as file upload controls
 *
 * 3. **Relations** - Entity references (type: "url")
 *    - To-one: maxItems === 1
 *    - To-many: !maxItems || maxItems > 1
 *    - Both read `required` straight off the create-form template property — cardinality
 *      doesn't imply a required-ness rule of its own; the backend decides.
 *    - Target Profile resolution is NOT done here — the profile list needed to resolve it
 *      (`useProfileEntities()`) is only available async, after this template is already needed
 *      for the create/permission gate. Callers resolve it themselves via
 *      `profileRelation?.getTargetProfile(profiles)` once profiles have loaded (see
 *      `CreateEntityItemForm` in packages/features/src/entity-item-create/).
 */

/**
 * Enhanced create-form property for user-defined attributes
 */
export interface CreateFormProperty {
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

/**
 * Enhanced create-form property for to-one relation fields.
 * To-one relations have maxItems === 1 and can be required.
 */
export interface CreateFormRelationToOneProperty {
  /** The original HAL-FORMS property */
  property: HalFormsProperty;
  /** The ProfileRelation this property maps to */
  profileRelation?: ProfileRelation;
  /** The collection URL for fetching available target entities */
  targetCollectionHref: string;
  /** Whether this field is required */
  isRequired: boolean;
}

/**
 * Enhanced create-form property for to-many relation fields.
 * To-many relations have !maxItems || maxItems > 1.
 */
export interface CreateFormRelationToManyProperty {
  /** The original HAL-FORMS property */
  property: HalFormsProperty;
  /** The ProfileRelation this property maps to */
  profileRelation?: ProfileRelation;
  /** The collection URL for fetching available target entities */
  targetCollectionHref: string;
  /** Whether this field is required (e.g. "at least one link") */
  isRequired: boolean;
}

/**
 * Wrapper class for HAL-FORMS create templates with enhanced metadata.
 *
 * Lazily parses and enriches form properties with links to ProfileAttribute
 * and ProfileRelation objects.
 */
export class CreateHalFormTemplate {
  private _userDefinedProperties?: readonly CreateFormProperty[];
  private _toOneRelationProperties?: readonly CreateFormRelationToOneProperty[];
  private _toManyRelationProperties?: readonly CreateFormRelationToManyProperty[];

  constructor(
    /** The underlying HAL-FORMS template */
    public readonly template: HalFormsTemplate<EntityInstanceCreateRequestSpec>,
    /** The profile accessor for attribute/relation linking */
    private readonly profileEntity: ProfileEntity,
  ) {}

  /**
   * Get all user-defined attribute properties (excludes relations).
   * System fields (id, audit) never appear in create-form.
   */
  get userDefinedProperties(): readonly CreateFormProperty[] {
    this._userDefinedProperties ??= (this.template.properties ?? [])
      .filter((property) => property.type !== "url")
      .map((property) => this.enhanceAttributeProperty(property));
    return this._userDefinedProperties;
  }

  /**
   * Get to-one relation properties (maxItems === 1).
   * To-one relations can be required.
   */
  get toOneRelationProperties(): readonly CreateFormRelationToOneProperty[] {
    this._toOneRelationProperties ??= (this.template.properties ?? [])
      .filter((property) => {
        if (property.type !== "url") return false;
        return property.options?.maxItems === 1;
      })
      .map((property) => this.enhanceToOneRelationProperty(property));
    return this._toOneRelationProperties;
  }

  /**
   * Get to-many relation properties (!maxItems || maxItems > 1).
   */
  get toManyRelationProperties(): readonly CreateFormRelationToManyProperty[] {
    this._toManyRelationProperties ??= (this.template.properties ?? [])
      .filter((property) => {
        if (property.type !== "url") return false;
        return property.options?.maxItems !== 1;
      })
      .map((property) => this.enhanceToManyRelationProperty(property));
    return this._toManyRelationProperties;
  }

  /**
   * Get all properties (user-defined + relations).
   */
  get allProperties(): readonly (
    | CreateFormProperty
    | CreateFormRelationToOneProperty
    | CreateFormRelationToManyProperty
  )[] {
    return [
      ...this.userDefinedProperties,
      ...this.toOneRelationProperties,
      ...this.toManyRelationProperties,
    ];
  }

  /**
   * Enhance a user-defined attribute property with profile metadata.
   */
  private enhanceAttributeProperty(property: HalFormsProperty): CreateFormProperty {
    const profileAttribute = this.profileEntity.getAttribute(property.name);
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

  /**
   * Enhance a to-one relation property with profile metadata.
   */
  private enhanceToOneRelationProperty(
    property: HalFormsProperty,
  ): CreateFormRelationToOneProperty {
    const profileRelation = this.profileEntity.getRelation(property.name);

    // Extract target collection href from options.link.href
    const targetCollectionHref = property.options?.isRemote() ? property.options.link.href : "";

    // To-one relations can be required
    const isRequired = property.required ?? false;

    return {
      property,
      profileRelation,
      targetCollectionHref,
      isRequired,
    };
  }

  /**
   * Enhance a to-many relation property with profile metadata.
   */
  private enhanceToManyRelationProperty(
    property: HalFormsProperty,
  ): CreateFormRelationToManyProperty {
    const profileRelation = this.profileEntity.getRelation(property.name);

    // Extract target collection href from options.link.href
    const targetCollectionHref = property.options?.isRemote() ? property.options.link.href : "";

    const isRequired = property.required ?? false;

    return {
      property,
      profileRelation,
      targetCollectionHref,
      isRequired,
    };
  }
}
