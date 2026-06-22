import type { HalObject } from "@contentgrid/hal";
import { blueprintRels } from "../api";
import type {
  ProfileAttributeConstraint,
  ProfileAttributeSearchParam,
  ProfileAttributeShape,
} from "../shapes";

enum ProfileAttributeConstraintType {
  unique = "unique",
  createdDate = "created-date",
  createdBy = "created-by",
  modifiedDate = "modified-date",
  modifiedBy = "modified-by",
  required = "required",
  allowedValues = "allowed-values",
}

export enum ProfileAttributeSearchType {
  exactMatch = "exact-match",
  prefixMatch = "prefix-match",
  greaterThan = "greater-than",
  greaterThanOrEqual = "greater-than-or-equal",
  lessThan = "less-than",
  lessThanOrEqual = "less-than-or-equal",
  fullText = "full-text",
}

export enum ProfileAttributeType {
  string = "string",
  long = "long",
  double = "double",
  boolean = "boolean",
  date = "date",
  datetime = "datetime",
  object = "object",
}

export class ProfileAttribute {
  constructor(private readonly hal: HalObject<ProfileAttributeShape>) {}

  private get attributeProfileData(): ProfileAttributeShape {
    return this.hal.data;
  }

  // ========================================
  // Basic Properties
  // ========================================

  get name() {
    return this.attributeProfileData.name;
  }

  get type() {
    return this.attributeProfileData.type as ProfileAttributeType;
  }

  get title() {
    return this.attributeProfileData.title;
  }

  get description() {
    return this.attributeProfileData.description;
  }

  get isReadOnly() {
    return this.attributeProfileData.readonly;
  }

  get isRequired() {
    return this.attributeProfileData.required;
  }

  get isContent(): boolean {
    return (
      this.type == ProfileAttributeType.object &&
      this.hal.embedded.findEmbeddeds(blueprintRels.attribute).length > 0
    );
  }

  // ========================================
  // Constraints
  // ========================================

  get constraints(): ProfileAttributeConstraint[] {
    return this.hal.embedded
      .findEmbeddeds(blueprintRels.constraint)
      .map((hal) => hal.data as ProfileAttributeConstraint);
  }

  get isUnique() {
    return this.constraints.some((constr) => constr.type === ProfileAttributeConstraintType.unique);
  }

  get allowedValues(): string[] | undefined {
    return this.constraints.find(
      (constr) => constr.type === ProfileAttributeConstraintType.allowedValues,
    )?.values;
  }

  // ========================================
  // Audit Constraints
  // ========================================

  get isCreatedDate() {
    return this.constraints.some(
      (constr) => constr.type === ProfileAttributeConstraintType.createdDate,
    );
  }

  get isCreatedBy() {
    return this.constraints.some(
      (constr) => constr.type === ProfileAttributeConstraintType.createdBy,
    );
  }

  get isModifiedDate() {
    return this.constraints.some(
      (constr) => constr.type === ProfileAttributeConstraintType.modifiedDate,
    );
  }

  get isModifiedBy() {
    return this.constraints.some(
      (constr) => constr.type === ProfileAttributeConstraintType.modifiedBy,
    );
  }

  // ========================================
  // Search Parameters
  // ========================================

  get searchParams(): ProfileAttributeSearchParam[] {
    return this.hal.embedded
      .findEmbeddeds(blueprintRels["search-param"])
      .map((hal) => hal.data as ProfileAttributeSearchParam);
  }

  get availableSearchTypes(): ProfileAttributeSearchType[] {
    return this.searchParams.map((param) => param.type as ProfileAttributeSearchType);
  }

  hasSearchType(searchType: ProfileAttributeSearchType): boolean {
    return this.searchParams.some((param) => param.type === searchType);
  }

  get hasExactSearch(): boolean {
    return this.hasSearchType(ProfileAttributeSearchType.exactMatch);
  }

  get hasPrefixSearch(): boolean {
    return this.hasSearchType(ProfileAttributeSearchType.prefixMatch);
  }

  get hasFullTextSearch(): boolean {
    return this.hasSearchType(ProfileAttributeSearchType.fullText);
  }

  // ========================================
  // Embedded Attributes (for nested objects)
  // ========================================

  /**
   * Get embedded attributes for nested object types.
   * Used for content metadata fields or user-defined nested objects.
   */
  get embeddedAttributes(): readonly ProfileAttribute[] {
    return this.hal.embedded
      .findEmbeddeds(blueprintRels.attribute)
      .map((hal) => new ProfileAttribute(hal as HalObject<ProfileAttributeShape>));
  }

  /**
   * Get a specific embedded attribute by name.
   */
  getEmbeddedAttribute(attributeName: string): ProfileAttribute | undefined {
    return this.embeddedAttributes.find((attr) => attr.name === attributeName);
  }
}
