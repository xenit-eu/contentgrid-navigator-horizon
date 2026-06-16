import type { HalFormsProperty, HalFormsTemplate } from "@contentgrid/hal-forms";
import type { SearchRequestSpec } from "../api/requests";
import { ProfileAttributeSearchType } from "./attribute-profile";
import type { ProfileAttribute } from "./attribute-profile";
import type ProfileEntity from "./entity-profile";
import type { ProfileRelation } from "./relation-profile";

/**
 * Enhanced Search HAL-FORMS Template Wrapper
 *
 * This class wraps a HAL-FORMS search template and enriches it with metadata
 * from the entity profile to make search functionality more ergonomic and type-safe.
 *
 * ## Why We Wrap HAL-FORMS
 *
 * The base HAL-FORMS API provides raw property definitions (name, type, prompt),
 * but lacks semantic information needed to build rich, dynamic search UIs:
 *
 * 1. **Attribute Linking**: Properties reference attributes by name (e.g., "name~prefix"),
 *    but the UI needs direct access to ProfileAttribute objects to:
 *    - Display correct labels and descriptions
 *    - Validate input based on attribute type
 *    - Show available constraints (unique, required, allowed values)
 *
 * 2. **Relation Traversal**: Search properties can traverse relations (e.g., "supplier.name"),
 *    but the raw API doesn't indicate:
 *    - Which part is the relation vs. the attribute
 *    - What the target entity type is
 *    - Whether it's a to-one or to-many relation
 *
 * 3. **Search Type Parsing**: Property names encode search types via suffixes
 *    (~prefix, ~fts, ~gt, etc.), but accessing these requires string parsing.
 *    Pre-parsed flags make it easy to:
 *    - Render appropriate input controls (text field vs. date picker)
 *    - Show search type indicators in the UI
 *    - Build filter chips with proper operators
 *
 * 4. **Sort Metadata**: The _sort property needs attribute linking so the UI can:
 *    - Display human-readable sort labels
 *    - Group sort options by entity (when searching across relations)
 *    - Show attribute types next to sort options
 *
 * ## Architecture Decision
 *
 * We parse the template **at the Profile level** (not in hooks or components)
 * because:
 * - Profile data is stable and cacheable (staleTime: Infinity)
 * - Parsing happens once per profile, not on every render
 * - Enhanced templates can be passed directly to TanStack Query without re-processing
 * - Type safety propagates from Profile → hooks → components
 * - Custom parsing of the search template should stay out of the application code.
 *   When the semantics of the API change, we only need to adjust the parsing in one place.
 */

/**
 * Enhanced search property with linked profile metadata
 */
export interface SearchHalFormTemplateProperty {
  /** The original HAL-FORMS property */
  property: HalFormsProperty;
  /** The ProfileAttribute this property searches on (undefined for relation traversals) */
  profileAttribute?: ProfileAttribute;
  /** True if this property searches across a relation (e.g., "supplier.name") */
  isOverRelation: boolean;
  /** The ProfileRelation being traversed (undefined for direct attribute searches) */
  profileRelation?: ProfileRelation;
  /** Pre-parsed search type based on property name suffix */
  searchType: ProfileAttributeSearchType;
}

/**
 * Enhanced sort option with linked profile metadata
 */
export interface SortOption {
  /** Original sort value (e.g., "name,asc") */
  value: string;
  /** Human-readable prompt */
  prompt: string;
  /** Sort direction: ascending or descending */
  direction: "asc" | "desc";
  /** The ProfileAttribute being sorted (for display and validation) */
  profileAttribute?: ProfileAttribute;
}

/**
 * Wrapper class for HAL-FORMS search templates with enhanced metadata.
 *
 * Lazily parses and enriches search properties and sort options with
 * links to ProfileAttribute and ProfileRelation objects.
 */
export class SearchHalFormTemplate {
  private _searchProperties?: readonly SearchHalFormTemplateProperty[];
  private _sortOptions?: readonly SortOption[];

  constructor(
    /** The underlying HAL-FORMS template */
    public readonly template: HalFormsTemplate<SearchRequestSpec>,
    /** The profile accessor for attribute/relation linking */
    private readonly profileEntity: ProfileEntity,
    /** Optional map of all profiles for cross-entity relation resolution */
    private readonly _allProfiles?: ProfileEntity[],
  ) {}

  /**
   * Get all search properties with enhanced metadata.
   * Excludes the _sort property (use sortOptions instead).
   */
  get searchProperties(): readonly SearchHalFormTemplateProperty[] {
    if (!this._searchProperties) {
      this._searchProperties = (this.template.properties ?? [])
        .filter((property) => property.name !== "_sort")
        .map((property) => this.enhanceSearchProperty(property));
    }
    return this._searchProperties;
  }

  /**
   * Get all sort options with enhanced metadata.
   * Returns undefined if this search template does not support sorting.
   */
  get sortOptions(): readonly SortOption[] | undefined {
    if (this._sortOptions === undefined) {
      const sortProperty = this.template.properties?.find((p) => p.name === "_sort");
      if (sortProperty?.options?.isInline()) {
        const inline = sortProperty.options.inline;
        this._sortOptions = (Array.isArray(inline) ? inline : []).map((opt) =>
          this.parseSortOption(opt),
        );
      }
      // Leave as undefined if no sort property exists
    }
    return this._sortOptions;
  }

  /**
   * Get the raw _sort HAL-FORMS property if present.
   */
  get sortProperty(): HalFormsProperty | undefined {
    return this.template.properties?.find((p) => p.name === "_sort") ?? undefined;
  }

  /**
   * Check if this search template supports sorting.
   */
  get hasSort(): boolean {
    return this.sortProperty !== undefined;
  }

  /**
   * Get search properties filtered by search type.
   *
   * @param searchType - The search type to filter by
   * @returns Array of search properties matching the given type
   */
  getSearchPropertiesByType(
    searchType: ProfileAttributeSearchType,
  ): readonly SearchHalFormTemplateProperty[] {
    return this.searchProperties.filter((prop) => prop.searchType === searchType);
  }

  /**
   * Get a single search property by its name.
   *
   * @param name - The property name (e.g., "name~prefix", "customer.email")
   * @returns The matching search property, or undefined if not found
   */
  getSearchPropertyByName(name: string): SearchHalFormTemplateProperty | undefined {
    return this.searchProperties.find((prop) => prop.property.name === name);
  }

  /**
   * Get all search properties for a specific attribute.
   *
   * @param attributeName - The attribute name (without search suffix)
   * @returns Array of search properties for the given attribute (e.g., exact match, prefix match)
   */
  getSearchPropertiesByAttribute(attributeName: string): readonly SearchHalFormTemplateProperty[] {
    return this.searchProperties.filter((prop) => {
      if (prop.isOverRelation) {
        // For relation properties like "customer.name~prefix", extract the attribute part
        const parts = prop.property.name.split(".");
        const attributePart = parts.slice(1).join(".");
        const attrName = attributePart.split("~")[0];
        return attrName === attributeName;
      } else {
        // For direct properties like "name~prefix", extract attribute name
        const attrName = prop.property.name.split("~")[0];
        return attrName === attributeName;
      }
    });
  }

  /**
   * Get all search properties that traverse relations.
   *
   * @returns Array of search properties that search across relations
   */
  getRelationSearchProperties(): readonly SearchHalFormTemplateProperty[] {
    return this.searchProperties.filter((prop) => prop.isOverRelation);
  }

  /**
   * Enhance a single search property with profile metadata.
   */
  private enhanceSearchProperty(property: HalFormsProperty): SearchHalFormTemplateProperty {
    const propertyName = property.name;
    const parts = propertyName.split(".");
    const isOverRelation = parts.length > 1;

    let profileAttribute: ProfileAttribute | undefined;
    let profileRelation: ProfileRelation | undefined;
    let searchType: ProfileAttributeSearchType;

    if (isOverRelation) {
      // Relation traversal: "relation.attribute~suffix"
      const relationName = parts[0];
      const attributePart = parts.slice(1).join(".");
      const attributeName = attributePart.split("~")[0];

      profileRelation = this.profileEntity.getRelation(relationName);

      // Try to resolve the target attribute using allProfiles
      if (profileRelation && this._allProfiles) {
        const targetProfileHref = profileRelation.targetProfileHref;
        // Find the target profile by matching its self link with the relation's target-entity link
        const targetProfile = this._allProfiles.find(
          (profile) => profile.link.href === targetProfileHref,
        );
        if (targetProfile) {
          profileAttribute = targetProfile.getAttribute(attributeName);
        }
      }

      searchType = this.extractSearchType(attributePart);
    } else {
      // Direct attribute: "attribute~suffix"
      const attributeName = propertyName.split("~")[0];
      profileAttribute = this.profileEntity.getAttribute(attributeName);
      searchType = this.extractSearchType(propertyName);
    }

    return {
      property,
      profileAttribute,
      isOverRelation,
      profileRelation,
      searchType,
    };
  }

  /**
   * Extract search type from property name suffix.
   */
  private extractSearchType(propertyName: string): ProfileAttributeSearchType {
    if (propertyName.includes("~prefix")) return ProfileAttributeSearchType.prefixMatch;
    if (propertyName.includes("~fts")) return ProfileAttributeSearchType.fullText;
    if (propertyName.includes("~gte")) return ProfileAttributeSearchType.greaterThanOrEqual;
    if (propertyName.includes("~gt")) return ProfileAttributeSearchType.greaterThan;
    if (propertyName.includes("~lte")) return ProfileAttributeSearchType.lessThanOrEqual;
    if (propertyName.includes("~lt")) return ProfileAttributeSearchType.lessThan;
    // Note: datetime uses ~after/~before which map to gt/lt semantically
    if (propertyName.includes("~after")) return ProfileAttributeSearchType.greaterThan;
    if (propertyName.includes("~before")) return ProfileAttributeSearchType.lessThan;
    return ProfileAttributeSearchType.exactMatch;
  }

  /**
   * Parse a sort option (string or object format).
   */
  private parseSortOption(opt: unknown): SortOption {
    if (typeof opt === "string") {
      // Parse "attribute,direction" format
      const [attributeName, direction = "asc"] = opt.split(",");
      const profileAttribute = this.profileEntity.getAttribute(attributeName);
      return {
        value: opt,
        prompt: opt,
        direction: direction === "desc" ? "desc" : "asc",
        profileAttribute,
      };
    }

    // Object format: { value: "attribute,direction", prompt: "..." }
    const o = opt as { value?: string; prompt?: string };
    const [attributeName, direction = "asc"] = (o.value || "").split(",");
    const profileAttribute = this.profileEntity.getAttribute(attributeName);
    return {
      value: o.value || "",
      prompt: o.prompt || o.value || "",
      direction: direction === "desc" ? "desc" : "asc",
      profileAttribute,
    };
  }
}
