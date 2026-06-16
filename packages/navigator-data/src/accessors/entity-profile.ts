import { HalObject, type Link, type SimpleLink } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { ianaRelations } from "@contentgrid/hal/rels";
import { checkResponse } from "@contentgrid/problem-details";
import { blueprintRels, cgRels } from "../api";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import type { EntityInstanceCreateRequestSpec, SearchRequestSpec } from "../api/requests";
import type { ProfileAttributeShape, ProfileEntityShape, ProfileRelationShape } from "../shapes";
import { ProfileAttribute } from "./attribute-profile";
import { CreateHalFormTemplate } from "./create-form";
import { ProfileRelation } from "./relation-profile";
import { SearchHalFormTemplate } from "./search-form";

export async function getProfile(
  apiFetch: TypedFetch,
  profileUrl: string,
): Promise<HalObject<unknown>> {
  const { object } = await fetchHal<Record<string, unknown>>(apiFetch, profileUrl);
  return object;
}

export async function getProfileEntities(
  apiFetch: TypedFetch,
  profileUrl: string,
): Promise<readonly ProfileEntity[]> {
  const rootProfile = await getProfile(apiFetch, profileUrl);
  return Promise.all(
    rootProfile.links.findLinks(cgRels.entity).map(async (link) => {
      const { object } = await fetchHal<ProfileEntityShape>(apiFetch, link.href);
      return new ProfileEntity(link, object as HalObject<ProfileEntityShape>);
    }),
  );
}

export interface ProfileEntityFilter {
  name?: string;
  link?: SimpleLink;
}

export async function getProfileEntity(
  apiFetch: TypedFetch,
  profileUrl: string,
  filter: ProfileEntityFilter,
): Promise<ProfileEntity | null> {
  const rootProfile = await getProfile(apiFetch, profileUrl);
  const entityLinks = rootProfile.links.findLinks(cgRels.entity);

  // Find the entity link by name or href
  const entityLink = entityLinks.find((link) => {
    if (filter.name && link.name === filter.name) {
      return true;
    }
    if (filter.link && link.href === filter.link.href) {
      return true;
    }
    return false;
  });

  if (!entityLink) {
    return null;
  }

  // Fetch only the specific entity profile
  const { object } = await fetchHal<ProfileEntityShape>(apiFetch, entityLink.href);
  return new ProfileEntity(entityLink, object as HalObject<ProfileEntityShape>);
}

export default class ProfileEntity {
  public constructor(
    public readonly link: Link,
    private readonly profileEntity: HalObject<ProfileEntityShape>,
  ) {}

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

  public async searchEntity(apiFetch: TypedFetch, values: HalFormValues<SearchRequestSpec>) {
    const searchTemplate = this.searchTemplate;
    if (!searchTemplate) {
      throw new Error("No search template available");
    }
    const codec = halFormCodecs.requireCodecFor(searchTemplate.template);
    const request = codec.encode(values);
    return apiFetch(request).then(checkResponse);
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

  public async createEntity(
    apiFetch: TypedFetch,
    values: HalFormValues<EntityInstanceCreateRequestSpec>,
  ) {
    const createTemplate = this.createTemplate;
    if (!createTemplate) {
      throw new Error("No create template available");
    }
    const codec = halFormCodecs.requireCodecFor(createTemplate.template);
    const request = codec.encode(values);
    return apiFetch(request).then(checkResponse);
  }
}
