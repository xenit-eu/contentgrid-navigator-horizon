import { queryOptions } from "@tanstack/react-query";
import { HalObject, type Link, type SimpleLink } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { ianaRelations } from "@contentgrid/hal/rels";
import { blueprintRels } from "../api";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import type { EntityInstanceCreateRequestSpec, SearchRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { ProfileAttributeShape, ProfileEntityShape, ProfileRelationShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { ProfileAttribute } from "./attribute-profile";
import { CreateHalFormTemplate } from "./create-form";
import { ProfileRelation } from "./relation-profile";
import { SearchHalFormTemplate } from "./search-form";

const PROFILE_STALE_TIME = 5 * 60 * 1000; // 5 minutes - profiles rarely change at runtime

export async function getProfileRoot(
  apiFetch: TypedFetch,
  profileUrl: string,
): Promise<HalObject<unknown>> {
  const { object } = await fetchHal<Record<string, unknown>>(apiFetch, new Request(profileUrl));
  return object;
}

/**
 * Query options for fetching the profile root.
 *
 * The profile root is the discovery endpoint that lists all available entity profiles.
 *
 * @param apiFetch - Authenticated TypedFetch instance
 * @param profileUrl - Full URL to the profile root endpoint
 * @param override - Optional query options to override defaults (staleTime, retry, etc.)
 *
 * @example
 * ```typescript
 * const rootQuery = profileRootQuery(apiFetch, profileUrl);
 * const { data: rootProfile } = useQuery(rootQuery);
 * const entityLinks = rootProfile.links.findLinks(cgRels.entity);
 * ```
 */
export function profileRootQuery(
  apiFetch: TypedFetch,
  profileUrl: string,
  override: QueryOptionsOverride<HalObject<unknown>, Error> = {},
) {
  return queryOptions({
    queryKey: queryKeys.profileRoot.byUrl(profileUrl),
    queryFn: () => getProfileRoot(apiFetch, profileUrl),
    staleTime: PROFILE_STALE_TIME,
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer than stale time
    retry: 3, // Retry failed requests
    ...override,
  });
}

export default class ProfileEntity {
  public constructor(
    public readonly link: Link,
    private readonly profileEntity: HalObject<ProfileEntityShape>,
  ) {}

  // ========================================
  // Static Query Options Factories
  // ========================================

  public static profileByLinkQuery(
    apiFetch: TypedFetch,
    profileLink: Link,
    override: QueryOptionsOverride<ProfileEntity, Error> = {},
  ) {
    return queryOptions({
      queryKey: queryKeys.entityProfile.byLink(profileLink),
      queryFn: async () => {
        const { object } = await fetchHal<ProfileEntityShape>(
          apiFetch,
          new Request(profileLink.href),
        );
        return new ProfileEntity(profileLink, object as HalObject<ProfileEntityShape>);
      },
      staleTime: PROFILE_STALE_TIME,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      ...override,
    });
  }

  // ========================================
  // Basic Properties
  // ========================================

  public get name(): string {
    return this.link.name!;
  }

  public get title(): string {
    return this.link.title ?? this.name;
  }

  public get description(): string {
    return this.profileEntity.data.description;
  }

  public get singularName(): string {
    return this.profileEntity.data.name;
  }

  public get pluralName(): string {
    return (
      this.profileEntity.links
        .findLinks(ianaRelations.describes)
        .find((describesLink) => describesLink.name == "collection")?.title ?? this.title
    );
  }

  // ========================================
  // Attributes
  // ========================================

  public get attributes(): readonly ProfileAttribute[] {
    return (this.profileEntity.embedded.findEmbeddeds(blueprintRels.attribute) ?? []).map(
      (hal) => new ProfileAttribute(hal as HalObject<ProfileAttributeShape>),
    );
  }

  public getAttribute(attributeName: string): ProfileAttribute | undefined {
    return this.attributes.find((attr) => attr.name === attributeName);
  }

  public get idAttribute(): ProfileAttribute {
    return this.attributes.find((attribute) => attribute.name === "id")!;
  }

  // ========================================
  // User Defined Attributes
  // ========================================

  public get userDefinedAttributes(): readonly ProfileAttribute[] {
    return this.attributes.filter(
      (attr) => !this.auditAttributeNames.has(attr.name) && attr.name !== "id",
    );
  }

  /**
   * Exposed as a Set for O(1) lookup when filtering user-defined attributes.
   */
  public get userDefinedAttributeNames(): ReadonlySet<string> {
    return new Set(this.userDefinedAttributes.map((a) => a.name));
  }

  // ========================================
  // Relations
  // ========================================

  public get relations(): readonly ProfileRelation[] {
    return (this.profileEntity.embedded.findEmbeddeds(blueprintRels.relation) ?? []).map(
      (hal) => new ProfileRelation(hal as HalObject<ProfileRelationShape>),
    );
  }

  public getRelation(relationName: string): ProfileRelation | undefined {
    return this.relations.find((rel) => rel.name === relationName);
  }

  public get toOneRelations(): readonly ProfileRelation[] {
    return this.relations.filter((rel) => rel.isToOne);
  }

  public get toManyRelations(): readonly ProfileRelation[] {
    return this.relations.filter((rel) => rel.isToMany);
  }

  /**
   * Exposed as a Set for O(1) lookup when checking relation names.
   */
  public get relationNames(): ReadonlySet<string> {
    return new Set(this.relations.map((r) => r.name));
  }

  // ========================================
  // Audit Attributes
  // ========================================

  public get createdByAttribute(): ProfileAttribute | undefined {
    return this.attributes.find((attribute) => attribute.isCreatedBy);
  }

  public get createdAtAttribute(): ProfileAttribute | undefined {
    return this.attributes.find((attribute) => attribute.isCreatedDate);
  }

  public get modifiedByAttribute(): ProfileAttribute | undefined {
    return this.attributes.find((attribute) => attribute.isModifiedBy);
  }

  public get modifiedAtAttribute(): ProfileAttribute | undefined {
    return this.attributes.find((attribute) => attribute.isModifiedDate);
  }

  public get auditAttributes(): ProfileAttribute[] {
    return [
      this.createdByAttribute,
      this.createdAtAttribute,
      this.modifiedByAttribute,
      this.modifiedAtAttribute,
    ].filter((attr): attr is ProfileAttribute => attr !== undefined);
  }

  public get auditAttributeNames(): ReadonlySet<string> {
    return new Set(this.auditAttributes.map((a) => a.name));
  }

  // ========================================
  // HAL Links
  // ========================================

  public get collectionLink(): Link {
    return this.profileEntity.links.requireSingleLink(ianaRelations.describes, "collection");
  }

  public get itemLink(): Link {
    return this.profileEntity.links.requireSingleLink(ianaRelations.describes, "item");
  }

  /**
   * Expand the item URI template for a given entity ID.
   *
   * Uses the `describes` link with `name: "item"` (a URI template like `/{plural}/{id}`).
   * Expansion is done via the `@contentgrid/uri-template` library — no string concatenation.
   *
   * @param entityId - The entity identifier to substitute into the template
   * @returns The fully expanded item URL
   */
  public itemUrl(entityId: string): string {
    const template = this.itemLink.template;
    const [idVariable] = template.variables;
    return template.expand({ [idVariable]: entityId });
  }

  public describes(link: SimpleLink): boolean {
    return this.profileEntity.links
      .findLinks(ianaRelations.describes)
      .some(
        (desc) => desc.template.match(link.href) || desc.template.match(link.href.split("?")[0]),
      );
  }

  // ========================================
  // Search Templates & Operations
  // ========================================

  public get searchTemplate(): SearchHalFormTemplate | null {
    const template = resolveTemplate(this.profileEntity.data, "search");
    if (!template) {
      return null;
    }

    // Return wrapped template with enhanced metadata
    return new SearchHalFormTemplate(template, this);
  }

  /**
   * Create a search Request for this entity.
   *
   * Pure method that encodes search values into a Request using HAL-Forms codecs.
   * Does not perform the fetch - returns a Request object for use with fetchHalSlice.
   *
   * @param values - Search parameters (filters, sort, pagination)
   * @returns Request object ready to be fetched
   *
   * @example
   * ```typescript
   * const searchValues = createValues(profile.searchTemplate.template);
   * const request = profile.searchEntityRequest(searchValues);
   * const slice = await fetchHalSlice(apiFetch, request);
   * ```
   */
  public searchEntityRequest(values: HalFormValues<SearchRequestSpec>): Request {
    const searchTemplate = this.searchTemplate;
    if (!searchTemplate) {
      throw new Error(`Entity ${this.name} does not have a search template`);
    }
    const codec = halFormCodecs.requireCodecFor(searchTemplate.template);
    return codec.encode(values);
  }

  // ========================================
  // Create Template & Operations
  // ========================================

  public get createTemplate(): CreateHalFormTemplate | null {
    const template = resolveTemplate(this.profileEntity.data, "create-form");
    if (!template) {
      return null;
    }

    // Return wrapped template with enhanced metadata
    return new CreateHalFormTemplate(template, this);
  }

  public createEntityItemRequest(values: HalFormValues<EntityInstanceCreateRequestSpec>): Request {
    const createTemplate = this.createTemplate;
    if (!createTemplate) {
      throw new Error("No create template available");
    }
    const codec = halFormCodecs.requireCodecFor(createTemplate.template);
    return codec.encode(values);
  }
}
