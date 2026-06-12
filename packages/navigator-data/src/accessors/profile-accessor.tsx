import type { HalObject, Link, SimpleLink } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { ianaRelations } from "@contentgrid/hal/rels";
import { checkResponse } from "@contentgrid/problem-details";
import type { EntityInstanceCreateRequestSpec, SearchRequestSpec } from "../api/requests";
import { blueprintRelations } from "../relations";
import type { EntityProfileShape, ProfileAttributeShape } from "../shapes";
import { ProfileAttribute } from "./attribute-profile-accessor";

export default class ProfileAccessor {
  public constructor(
    public readonly link: Link,
    private readonly profile: HalObject<EntityProfileShape>,
  ) {}

  public get name(): string {
    return this.link.name!;
  }

  public get title(): string {
    return this.link.title ?? this.name;
  }

  public get description(): string {
    return this.profile.data.description;
  }

  public get singularName(): string {
    return this.profile.data.name;
  }

  public get attributes(): readonly ProfileAttribute[] {
    return (this.profile.embedded.findEmbeddeds(blueprintRelations.attribute) ?? []).map(
      (hal) => new ProfileAttribute(hal as HalObject<ProfileAttributeShape>),
    );
  }

  public getAttribute(attributeName: string): ProfileAttribute | undefined {
    return this.attributes.find((attr) => attr.name === attributeName);
  }

  public get searchTemplate() {
    return resolveTemplate(this.profile.data, "search");
  }

  public async searchEntity(values: HalFormValues<SearchRequestSpec>) {
    const codec = halFormCodecs.requireCodecFor(this.searchTemplate!);
    const request = codec.encode(values);
    return fetch(request).then(checkResponse);
  }

  public get createTemplate() {
    return resolveTemplate(this.profile.data, "create-form");
  }

  public async createEntity(values: HalFormValues<EntityInstanceCreateRequestSpec>) {
    const codec = halFormCodecs.requireCodecFor(this.createTemplate!);
    const request = codec.encode(values);
    return fetch(request).then(checkResponse);
  }

  public get collectionLink(): Link {
    return this.profile.links.requireSingleLink(ianaRelations.describes, "collection");
  }

  public get itemLink(): Link {
    return this.profile.links.requireSingleLink(ianaRelations.describes, "item");
  }

  public describes(link: SimpleLink): boolean {
    return this.profile.links
      .findLinks(ianaRelations.describes)
      .some(
        (desc) => desc.template.match(link.href) || desc.template.match(link.href.split("?")[0]),
      );
  }

  public get pluralName(): string {
    return (
      this.profile.links
        .findLinks(ianaRelations.describes)
        .find((describesLink) => describesLink.name == "collection")?.title ?? this.title
    );
  }

  public get idAttribute(): ProfileAttribute {
    return this.attributes.find((attribute) => attribute.name === "id")!;
  }

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

  // Exposed as a Set for O(1) lookup in EntityInstanceAccessor when filtering entity attributes.
  public get auditAttributeNames(): ReadonlySet<string> {
    return new Set(this.auditAttributes.map((a) => a.name));
  }
}
