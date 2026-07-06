import type { HalFormsProperty, HalFormsTemplate } from "@contentgrid/hal-forms";
import { HalFormsTemplateBuilder } from "@contentgrid/hal-forms/builder";
import type { SearchRequestSpec } from "../../api/requests";
import { ProfileAttributeSearchType } from "../attribute-profile";
import type { ProfileAttribute } from "../attribute-profile";
import type ProfileEntity from "../entity-profile";
import type { ProfileRelation } from "../relation-profile";

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
  /**
   * Base key with all operator suffixes stripped.
   * Groups range-pair properties (e.g. "created.~from" + "created.~until" → "created").
   * Computed once here so consumers never need to parse the raw property name.
   */
  groupKey: string;
}

/**
 * Raw sort option as returned in the HAL-FORMS `_sort` property's inline options array.
 * The `property` and `direction` fields are explicit — prefer these over parsing `value`.
 */
interface RawSortOption {
  /** Attribute name to sort on (e.g., "order_id") */
  property: string;
  /** Sort direction */
  direction: "asc" | "desc";
  /** Human-readable label */
  prompt?: string;
  /** Encoded sort value sent in the request (e.g., "order_id,asc") */
  value: string;
}

function isRawSortOption(opt: unknown): opt is RawSortOption {
  return typeof opt === "object" && opt !== null && "property" in opt && "value" in opt;
}

/**
 * The bare attribute/relation path of a property name, with its trailing operator
 * suffix ("~prefix-match", ".~from", etc.) removed.
 * `dotTildeIdx` is the index of a range-pair ".~" separator, or -1 if this property
 * uses the legacy "~suffix" form instead.
 */
function basePropertyName(propertyName: string, dotTildeIdx: number): string {
  const splitIdx = dotTildeIdx === -1 ? propertyName.indexOf("~") : dotTildeIdx;
  return splitIdx === -1 ? propertyName : propertyName.slice(0, splitIdx);
}

/**
 * The attribute name on the related entity, from a relation-traversal segment
 * with its trailing "~" operator suffix removed (e.g. "name~prefix-match" → "name").
 */
function relationTargetAttributeName(attributeSegmentWithSuffix: string): string {
  return attributeSegmentWithSuffix.split("~")[0];
}

/**
 * The attribute name on the related entity, from a relation-traversal groupKey
 * (e.g. "customer.name" → "name" — everything after the last dot is the relation's attribute).
 */
function relationAttributeName(groupKey: string): string {
  return groupKey.slice(groupKey.lastIndexOf(".") + 1);
}

/** Property-name suffix → search type. Order matters: checked top to bottom, first match wins. */
const SEARCH_TYPE_BY_SUFFIX: ReadonlyArray<readonly [string, ProfileAttributeSearchType]> = [
  ["~prefix", ProfileAttributeSearchType.prefixMatch],
  ["~fts", ProfileAttributeSearchType.fullText],
  ["~gte", ProfileAttributeSearchType.greaterThanOrEqual],
  ["~gt", ProfileAttributeSearchType.greaterThan],
  ["~lte", ProfileAttributeSearchType.lessThanOrEqual],
  ["~lt", ProfileAttributeSearchType.lessThan],
  // datetime uses ~after/~before, which map to gt/lt semantically
  ["~after", ProfileAttributeSearchType.greaterThan],
  ["~before", ProfileAttributeSearchType.lessThan],
];

/** Extract the search type encoded in a property name's suffix (defaults to exact-match). */
function extractSearchType(propertyName: string): ProfileAttributeSearchType {
  const match = SEARCH_TYPE_BY_SUFFIX.find(([suffix]) => propertyName.includes(suffix));
  return match?.[1] ?? ProfileAttributeSearchType.exactMatch;
}

/**
 * Enhanced sort option with linked profile metadata
 */
export interface SortOption {
  /** Original sort value (e.g., "order_id,asc") — use as-is when setting the _sort parameter */
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
    this._searchProperties ??= (this.template.properties ?? [])
      .filter((property) => property.name !== "_sort")
      .map((property) => this.enhanceSearchProperty(property));
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
        this._sortOptions = (Array.isArray(inline) ? inline : [])
          .filter(isRawSortOption)
          .map((opt) => this.parseSortOption(opt));
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
      // profileAttribute.name is the resolved attribute name on the owning entity (direct)
      // or the target entity (relation traversal). Use it when available.
      if (prop.profileAttribute !== undefined) {
        return prop.profileAttribute.name === attributeName;
      }
      // profileAttribute is undefined when allProfiles was not provided. Fall back to groupKey:
      // - direct: groupKey IS the attribute name ("code" from "code~prefix")
      // - relation: groupKey is "relation.attribute" ("customer.name") — take the last segment
      if (prop.isOverRelation) {
        return relationAttributeName(prop.groupKey) === attributeName;
      }
      return prop.groupKey === attributeName;
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
    // Range-pair operators use the form "attribute.~op" (e.g. "created_at.~from").
    // The ".~" sequence is NOT a relation separator — the second segment starts with "~",
    // which means it is an operator suffix on a direct attribute, not a relation path.
    const dotTildeIdx = propertyName.indexOf(".~");
    const parts = propertyName.split(".");
    const isOverRelation = parts.length > 1 && dotTildeIdx === -1;

    // groupKey: strip all operator suffixes (~prefix, .~from, etc.) once here so
    // consumers (filter-properties, getSearchPropertiesByAttribute, etc.) never re-parse.
    const groupKey = basePropertyName(propertyName, dotTildeIdx);

    let profileAttribute: ProfileAttribute | undefined;
    let profileRelation: ProfileRelation | undefined;
    let searchType: ProfileAttributeSearchType;

    if (isOverRelation) {
      // Relation traversal: "relation.attribute~suffix"
      const relationName = parts[0];
      const attributeSegmentWithSuffix = parts.slice(1).join(".");
      const attributeName = relationTargetAttributeName(attributeSegmentWithSuffix);

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

      searchType = extractSearchType(attributeSegmentWithSuffix);
    } else {
      // Direct attribute: "attribute~suffix" or "attribute.~op" (range-pair).
      // groupKey (computed above) IS the attribute name here — no relation prefix to strip.
      profileAttribute = this.profileEntity.getAttribute(groupKey);
      searchType = extractSearchType(propertyName);
    }

    return {
      property,
      profileAttribute,
      isOverRelation,
      profileRelation,
      searchType,
      groupKey,
    };
  }

  /**
   * Return a copy of this template with the given params baked in as hidden properties.
   *
   * **Workaround** — the HAL-FORMS codec only encodes declared template properties.
   * To inject relation scoping params (e.g. `_internal_invoice__products`) into a
   * search request, they must be added as hidden properties so the codec encodes them
   * alongside the user's search input. Replace with a server-side mechanism when one
   * is available.
   *
   * @param params - Params to inject (e.g. from `EntityItemCollection.internalRelationParams`)
   * @returns A new `SearchHalFormTemplate` with the params baked in; returns `this` when empty
   */
  public withHiddenParams(params: Record<string, string>): SearchHalFormTemplate {
    if (Object.keys(params).length === 0) return this;
    let builder = HalFormsTemplateBuilder.fromTemplate(this.template);
    for (const [name, value] of Object.entries(params)) {
      builder = builder.addProperty(name, (prop) => prop.withType("hidden").withValue(value));
    }
    return new SearchHalFormTemplate(builder, this.profileEntity, this._allProfiles);
  }

  /**
   * Parse a sort option from the HAL-FORMS inline options array.
   * Uses the structured `property` and `direction` fields directly.
   */
  private parseSortOption(opt: RawSortOption): SortOption {
    return {
      value: opt.value,
      prompt: opt.prompt ?? opt.value,
      direction: opt.direction,
      profileAttribute: this.profileEntity.getAttribute(opt.property),
    };
  }
}
