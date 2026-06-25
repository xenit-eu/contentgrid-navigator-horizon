import { queryOptions } from "@tanstack/react-query";
import { HalObject } from "@contentgrid/hal";
import type { Link } from "@contentgrid/hal";
import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import { createValues } from "@contentgrid/hal-forms/values";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { cgRels, contentDispositionAttachment } from "../api";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import type {
  EntityInstanceDeleteRequestSpec,
  EntityInstanceUpdateRequestSpec,
  RelationDeleteRequestSpec,
  RelationUpdateRequestSpec,
} from "../api/requests";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import type { ProfileAttribute } from "./attribute-profile";
import type ProfileEntity from "./entity-profile";
import type { ProfileRelation } from "./relation-profile";

const ENTITY_ITEM_STALE_TIME = 30 * 1000; // 30 seconds

// ========================================
// Relation value object + cardinality error
// ========================================

/**
 * Thrown when a relation operation is attempted with the wrong cardinality.
 *
 * For example: calling `setRequest` on a to-many relation, or `addRequest` on a to-one
 * relation. Distinct from the ABAC "template absent" error so callers can distinguish
 * programming errors (wrong cardinality) from permission errors (ABAC deny).
 */
export class RelationCardinalityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelationCardinalityError";
  }
}

/**
 * A relation on an entity item, joining the `cg:relation` navigation link with the
 * `ProfileRelation` schema metadata and the item's HAL-FORMS relation templates.
 *
 * Mirrors the legacy `EntityRelation` shape from `xenit-eu/contentgrid-navigator`
 * (EntityInstanceAccessor.ts) but integrates with the new ProfileRelation for
 * cardinality information and target discovery.
 *
 * @example
 * ```typescript
 * const rel = item.getRelation("supplier");
 * if (rel?.canSet) {
 *   const req = rel.setRequest("https://api.example.com/suppliers/sup-001");
 *   await fetchVoid(apiFetch, req);
 * }
 * ```
 */
export class EntityItemRelation {
  constructor(
    private readonly halItem: HalObject<EntityItemShape>,
    public readonly profile: ProfileRelation,
    /** The `cg:relation` navigation link for this relation. May be absent when ABAC hides it. */
    public readonly link: Link | null,
  ) {}

  /** The relation name (e.g. "supplier", "lineItems"). */
  get name(): string {
    return this.profile.name;
  }

  /** Human-readable title from the profile. */
  get title(): string {
    return this.profile.title;
  }

  /** True when this is a to-many relation (many_target_per_source = true). */
  get isToMany(): boolean {
    return this.profile.isToMany;
  }

  /** True when this is a to-one relation (many_target_per_source = false). */
  get isToOne(): boolean {
    return this.profile.isToOne;
  }

  // ---- Template resolvers ----

  private get setTemplate(): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `set-${this.name}`);
  }

  private get addTemplate(): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `add-${this.name}`);
  }

  private get clearTemplate(): HalFormsTemplate<RelationDeleteRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `clear-${this.name}`);
  }

  // ---- Capability flags (ABAC gate via template presence) ----

  /**
   * Whether the current user is permitted to set (replace) this to-one relation.
   *
   * Derived from `set-<name>` template presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  get canSet(): boolean {
    return this.setTemplate !== null;
  }

  /**
   * Whether the current user is permitted to add to this to-many relation.
   *
   * Derived from `add-<name>` template presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  get canAdd(): boolean {
    return this.addTemplate !== null;
  }

  /**
   * Whether the current user is permitted to clear this relation.
   *
   * Derived from `clear-<name>` template presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  get canClear(): boolean {
    return this.clearTemplate !== null;
  }

  // ---- Request builders ----

  /**
   * Encode a "set" Request for this to-one relation using the HAL-FORMS codec.
   *
   * @param targetHref - The href of the target entity item (single URL for to-one)
   * @returns Request ready to be sent with apiFetch
   * @throws {RelationCardinalityError} if this is a to-many relation
   * @throws {Error} if the `set-<name>` template is absent (ABAC deny)
   */
  setRequest(targetHref: string): Request {
    if (this.isToMany) {
      throw new RelationCardinalityError(
        `Relation '${this.name}' is to-many; use addRequest() instead of setRequest()`,
      );
    }
    const template = this.setTemplate;
    if (template === null) {
      throw new Error(`Relation operation 'set' not permitted for '${this.name}': template absent`);
    }
    const codec = halFormCodecs.requireCodecFor(template);
    const prop = template.properties[0];
    if (!prop) {
      throw new Error(
        `set-${this.name} template has no properties; cannot encode uri-list request`,
      );
    }
    return codec.encode(createValues(template).withValue(prop.name, targetHref));
  }

  /**
   * Encode an "add" Request for this to-many relation using the HAL-FORMS codec.
   *
   * @param targetHrefs - The hrefs of the target entity items (one or more)
   * @returns Request ready to be sent with apiFetch
   * @throws {RelationCardinalityError} if this is a to-one relation
   * @throws {Error} if the `add-<name>` template is absent (ABAC deny)
   */
  addRequest(targetHrefs: readonly string[]): Request {
    if (this.isToOne) {
      throw new RelationCardinalityError(
        `Relation '${this.name}' is to-one; use setRequest() instead of addRequest()`,
      );
    }
    const template = this.addTemplate;
    if (template === null) {
      throw new Error(`Relation operation 'add' not permitted for '${this.name}': template absent`);
    }
    const codec = halFormCodecs.requireCodecFor(template);
    const prop = template.properties[0];
    if (!prop) {
      throw new Error(
        `add-${this.name} template has no properties; cannot encode uri-list request`,
      );
    }
    return codec.encode(createValues(template).withValue(prop.name, targetHrefs));
  }

  /**
   * Encode a "clear" Request for this relation using the HAL-FORMS codec.
   *
   * Valid for both to-one and to-many relations.
   *
   * @returns Request ready to be sent with apiFetch
   * @throws {Error} if the `clear-<name>` template is absent (ABAC deny)
   */
  clearRequest(): Request {
    const template = this.clearTemplate;
    if (template === null) {
      throw new Error(
        `Relation operation 'clear' not permitted for '${this.name}': template absent`,
      );
    }
    const codec = halFormCodecs.requireCodecFor(template);
    return codec.encode(createValues(template));
  }
}

/**
 * Represents a single entity instance (entity-item resource) with typed attribute access.
 *
 * Wraps a HAL entity-item response and provides structured access to attributes,
 * content links, and update operations. Attributes are classified by kind (plain,
 * content, nested, unknown) and optionally linked to their profile metadata.
 *
 * @example
 * ```typescript
 * const item = new EntityItem(halObject, profileEntity);
 *
 * // Access all attributes
 * item.attributes.forEach(attr => {
 *   console.log(attr.value.name, attr.value.kind);
 * });
 *
 * // Filter user-defined attributes
 * const userAttrs = item.userDefinedAttributes;
 *
 * // Update the entity
 * await item.editEntity({ name: "New Name" });
 * ```
 */
export class EntityItem {
  // ========================================
  // Static Query Options Factories
  // ========================================

  public static fetchByUrlQuery(
    apiFetch: TypedFetch,
    url: string,
    profileEntity: ProfileEntity,
    override: QueryOptionsOverride<EntityItem, Error> = {},
  ) {
    return queryOptions({
      queryKey: queryKeys.entityItem.byUrl(profileEntity, url),
      queryFn: async () => {
        const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, new Request(url));
        return new EntityItem(object, profileEntity, etag);
      },
      staleTime: ENTITY_ITEM_STALE_TIME,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      ...override,
    });
  }

  // ========================================
  // Constructor & Instance Properties
  // ========================================

  /**
   * @param halItem - The HAL entity-item resource from the API
   * @param profileEntity - The entity profile providing schema metadata
   * @param etag - ETag from the response header; pass as `If-Match` on update requests (RFC 9110)
   */
  public constructor(
    public readonly halItem: HalObject<EntityItemShape>,
    public readonly profileEntity: ProfileEntity,
    public readonly etag: string | null = null,
  ) {}

  public get id(): string {
    return this.halItem.data.id;
  }
  /**
   * All content attribute links (cg:content) for this entity.
   * Content attributes store binary files (images, PDFs, etc.) in S3.
   *
   * @returns Array of content links with their attribute names
   */
  public get contentLinks(): readonly Link[] {
    return this.halItem.links.findLinks(cgRels.content);
  }

  /**
   * All attributes on this entity, excluding HAL/internal fields (those starting with `_`).
   *
   * Each attribute is typed as plain, content, nested, or unknown, and optionally
   * linked to its ProfileAttribute for schema metadata. Content attributes include
   * their binary content link.
   *
   * @returns All entity attributes with their profile metadata
   */
  public get attributes(): readonly EntityItemAttribute[] {
    return Object.entries(this.halItem.data)
      .filter(([attributeName]) => !attributeName.startsWith("_"))
      .map(([attributeName, attributeValue]) => {
        const profileAttribute = this.profileEntity.getAttribute(attributeName);
        const contentLink = this.halItem.links.findLink(cgRels.content, attributeName);

        if (contentLink) {
          return {
            value: new EntityItemAttributeContent(
              attributeName,
              attributeValue as ContentMetadata | null,
              contentLink,
            ),
            profileAttribute,
          };
        }

        return createEntityItemAttributeValue([attributeName, attributeValue], profileAttribute);
      });
  }

  /**
   * User-defined attributes only — excludes system-managed audit attributes
   * (created-date, created-by, modified-date, modified-by).
   *
   * Use this when rendering entity forms or displays where audit fields
   * should be shown separately or hidden.
   *
   * @returns Filtered attributes that are user-defined per the profile
   */
  public get userDefinedAttributes(): readonly EntityItemAttribute[] {
    return this.attributes.filter(
      (attr) =>
        attr.profileAttribute &&
        this.profileEntity.userDefinedAttributeNames.has(attr.profileAttribute.name),
    );
  }

  /**
   * System-managed audit attributes only (created-date, created-by, modified-date, modified-by).
   *
   * These are read-only fields automatically set by the platform.
   * Use this to display "created/modified" metadata separately from user data.
   *
   * @returns Filtered attributes that are audit fields per the profile
   */
  public get auditAttributes(): readonly EntityItemAttribute[] {
    return this.attributes.filter(
      (attr) =>
        attr.profileAttribute &&
        this.profileEntity.auditAttributeNames.has(attr.profileAttribute.name),
    );
  }

  /**
   * The HAL-FORMS "default" template for updating this entity (PATCH operation).
   *
   * Returns `null` if the current user lacks update permission or the template is missing.
   * Use this template to build update forms and encode mutation payloads.
   *
   * @returns Update template or null if not available
   */
  public get selfLink(): Link {
    return this.halItem.self;
  }

  public get defaultTemplate(): HalFormsTemplate<EntityInstanceUpdateRequestSpec> | null {
    return resolveTemplate(this.halItem.data, "default");
  }

  /**
   * Encode attribute update values into a PATCH Request using the HAL-FORMS codec.
   *
   * Returns the Request — callers are responsible for executing it with `apiFetch`.
   * Include an `If-Match` header on the request to prevent concurrent update conflicts (RFC 9110).
   *
   * @param values - Attribute values to update (partial update via PATCH)
   * @returns Request ready to be sent with apiFetch
   */
  public editEntityRequest(values: HalFormValues<EntityInstanceUpdateRequestSpec>): Request {
    if (this.defaultTemplate === null) {
      throw new Error("Update not permitted: 'default' template absent");
    }
    const codec = halFormCodecs.requireCodecFor(this.defaultTemplate);
    return codec.encode(values);
  }

  /**
   * Whether the current user is permitted to update this entity item.
   *
   * Derived from `defaultTemplate` presence — the platform omits the template
   * when the ABAC policy denies update for this item/user combination.
   * Feature components must read this flag instead of re-checking raw templates.
   */
  public get canUpdate(): boolean {
    return this.defaultTemplate !== null;
  }

  /**
   * The HAL-FORMS "delete" template for deleting this entity item.
   *
   * Returns `null` if the current user lacks delete permission or the template is missing.
   * Template absence is the platform's per-item ABAC signal — never assume permission.
   *
   * @returns Delete template or null if not available
   */
  public get deleteTemplate(): HalFormsTemplate<EntityInstanceDeleteRequestSpec> | null {
    return resolveTemplate(this.halItem.data, "delete");
  }

  /**
   * Whether the current user is permitted to delete this entity item.
   *
   * Derived from `deleteTemplate` presence — the platform omits the template
   * when the ABAC policy denies delete for this item/user combination.
   * Feature components must read this flag instead of re-checking raw templates.
   */
  public get canDelete(): boolean {
    return this.deleteTemplate !== null;
  }

  /**
   * Encode a delete Request using the HAL-FORMS codec (driven by the `delete` template).
   *
   * The codec picks the `encodedToRequestUrl` encoder for DELETE (no request body),
   * which encodes any properties as URL query parameters.
   * Returns the Request — callers are responsible for executing it with `apiFetch`.
   * Include an `If-Match` header on the request to prevent concurrent conflicts (RFC 9110).
   *
   * @returns Request ready to be sent with apiFetch
   * @throws Error if the delete template is not present
   */
  public deleteEntityItemRequest(): Request {
    if (this.deleteTemplate === null) {
      throw new Error("Delete not permitted: 'delete' template absent");
    }
    const template = this.deleteTemplate;
    const codec = halFormCodecs.requireCodecFor(template);
    return codec.encode(createValues(template));
  }

  // ========================================
  // Relation Accessors (EntityItemRelation value objects)
  // ========================================

  /**
   * Look up a relation by name, joining the `ProfileRelation` schema with the
   * `cg:relation` navigation link from this item.
   *
   * Returns `undefined` when the profile has no relation of that name (unknown relation).
   * The `cg:relation` link may be absent when ABAC hides the navigation target — in that
   * case the object is still constructed (with `link: null`) so capability flags can
   * report false without callers having to guard against undefined separately.
   *
   * @param relationName - The name of the relation (e.g. "supplier", "lineItems")
   * @returns EntityItemRelation or undefined if the relation is not in the profile
   */
  public getRelation(relationName: string): EntityItemRelation | undefined {
    const profileRelation = this.profileEntity.getRelation(relationName);
    if (!profileRelation) {
      return undefined;
    }
    const link = this.halItem.links.findLink(cgRels.relation, relationName) ?? null;
    return new EntityItemRelation(this.halItem, profileRelation, link);
  }

  /**
   * All relations defined in the entity profile, each joined with their `cg:relation`
   * navigation link from this item (link may be null when ABAC hides it).
   *
   * Order matches `profileEntity.relations`.
   */
  public get relations(): readonly EntityItemRelation[] {
    return this.profileEntity.relations.map((profileRelation) => {
      const link = this.halItem.links.findLink(cgRels.relation, profileRelation.name) ?? null;
      return new EntityItemRelation(this.halItem, profileRelation, link);
    });
  }

  // ========================================
  // Relation Template Resolvers (kept for compatibility)
  // ========================================

  /**
   * The HAL-FORMS "set-<relationName>" template for setting a to-one relation (PUT).
   *
   * Returns `null` if the current user lacks permission or the template is missing.
   * Template absence is the platform's per-item ABAC signal — never assume permission.
   *
   * @param relationName - The name of the relation
   * @returns Set-relation template or null if not available
   */
  public setRelationTemplate(
    relationName: string,
  ): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `set-${relationName}`);
  }

  /**
   * The HAL-FORMS "add-<relationName>" template for adding to a to-many relation (POST).
   *
   * Returns `null` if the current user lacks permission or the template is missing.
   * Template absence is the platform's per-item ABAC signal — never assume permission.
   *
   * @param relationName - The name of the relation
   * @returns Add-relation template or null if not available
   */
  public addRelationTemplate(
    relationName: string,
  ): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `add-${relationName}`);
  }

  /**
   * The HAL-FORMS "clear-<relationName>" template for clearing a relation (DELETE).
   *
   * Returns `null` if the current user lacks permission or the template is missing.
   * Template absence is the platform's per-item ABAC signal — never assume permission.
   *
   * @param relationName - The name of the relation
   * @returns Clear-relation template or null if not available
   */
  public clearRelationTemplate(
    relationName: string,
  ): HalFormsTemplate<RelationDeleteRequestSpec> | null {
    return resolveTemplate(this.halItem.data, `clear-${relationName}`);
  }

  // ========================================
  // Relation Capability Flags
  // ========================================

  /**
   * Whether the current user is permitted to set (replace) a to-one relation.
   *
   * Derived from `setRelationTemplate` presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  public canSetRelation(relationName: string): boolean {
    return this.setRelationTemplate(relationName) !== null;
  }

  /**
   * Whether the current user is permitted to add to a to-many relation.
   *
   * Derived from `addRelationTemplate` presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  public canAddRelation(relationName: string): boolean {
    return this.addRelationTemplate(relationName) !== null;
  }

  /**
   * Whether the current user is permitted to clear a relation.
   *
   * Derived from `clearRelationTemplate` presence — the platform omits the template
   * when the ABAC policy denies the operation for this item/user combination.
   */
  public canClearRelation(relationName: string): boolean {
    return this.clearRelationTemplate(relationName) !== null;
  }

  // ========================================
  // Relation Request Builders
  // ========================================

  /**
   * Encode a "set" Request for a to-one relation using the HAL-FORMS codec.
   *
   * The codec selects `text/uri-list` based on the template's contentType.
   * The property name is read from `template.properties[0].name` — never hardcoded.
   * Returns the Request — callers are responsible for executing it with `apiFetch`.
   * Include an `If-Match` header on the request to prevent concurrent conflicts (RFC 9110).
   *
   * @param relationName - The name of the relation to set
   * @param targetHref - The href of the target entity item (single URL for to-one)
   * @returns Request ready to be sent with apiFetch
   * @throws Error if the set-relation template is absent (ABAC deny)
   */
  public setRelationRequest(relationName: string, targetHref: string): Request {
    const template = this.setRelationTemplate(relationName);
    if (template === null) {
      throw new Error(
        `Relation operation 'set' not permitted for '${relationName}': template absent`,
      );
    }
    const codec = halFormCodecs.requireCodecFor(template);
    const prop = template.properties[0];
    if (!prop) {
      throw new Error(
        `set-${relationName} template has no properties; cannot encode uri-list request`,
      );
    }
    return codec.encode(createValues(template).withValue(prop.name, targetHref));
  }

  /**
   * Encode an "add" Request for a to-many relation using the HAL-FORMS codec.
   *
   * The codec selects `text/uri-list` based on the template's contentType.
   * Emits one URL per line — the codec handles newline separation.
   * The property name is read from `template.properties[0].name` — never hardcoded.
   * Returns the Request — callers are responsible for executing it with `apiFetch`.
   * Include an `If-Match` header on the request to prevent concurrent conflicts (RFC 9110).
   *
   * @param relationName - The name of the relation to add to
   * @param targetHrefs - The hrefs of the target entity items (one or more)
   * @returns Request ready to be sent with apiFetch
   * @throws Error if the add-relation template is absent (ABAC deny)
   */
  public addRelationRequest(relationName: string, targetHrefs: readonly string[]): Request {
    const template = this.addRelationTemplate(relationName);
    if (template === null) {
      throw new Error(
        `Relation operation 'add' not permitted for '${relationName}': template absent`,
      );
    }
    const codec = halFormCodecs.requireCodecFor(template);
    const prop = template.properties[0];
    if (!prop) {
      throw new Error(
        `add-${relationName} template has no properties; cannot encode uri-list request`,
      );
    }
    return codec.encode(createValues(template).withValue(prop.name, targetHrefs));
  }

  /**
   * Encode a "clear" Request for a relation using the HAL-FORMS codec.
   *
   * The codec selects the appropriate encoder for the DELETE method (no request body).
   * Returns the Request — callers are responsible for executing it with `apiFetch`.
   * Include an `If-Match` header on the request to prevent concurrent conflicts (RFC 9110).
   *
   * @param relationName - The name of the relation to clear
   * @returns Request ready to be sent with apiFetch
   * @throws Error if the clear-relation template is absent (ABAC deny)
   */
  public clearRelationRequest(relationName: string): Request {
    const template = this.clearRelationTemplate(relationName);
    if (template === null) {
      throw new Error(
        `Relation operation 'clear' not permitted for '${relationName}': template absent`,
      );
    }
    const codec = halFormCodecs.requireCodecFor(template);
    return codec.encode(createValues(template));
  }

  // ========================================
  // Content Link Accessors (exception: no HAL-FORMS template)
  // ========================================

  /**
   * Resolves the `cg:content` link for a named content attribute.
   *
   * The presence of this link is the ABAC gate for binary content operations —
   * the platform omits it when the current user lacks permission to access the content.
   * Returns `null` when the link is absent.
   *
   * @param attributeName - The name of the content attribute
   * @returns The resolved Link, or null if absent
   */
  public contentLink(attributeName: string): Link | null {
    return this.halItem.links.findLink(cgRels.content, attributeName) ?? null;
  }

  /**
   * Whether the current user is permitted to upload (PUT) binary content for this attribute.
   *
   * Derived from `contentLink` presence — the platform omits the link when the
   * ABAC policy denies content access for this item/user combination.
   *
   * @param attributeName - The name of the content attribute
   * @returns true when upload is permitted
   */
  public canUploadContent(attributeName: string): boolean {
    return this.contentLink(attributeName) !== null;
  }

  /**
   * Builds a PUT Request for uploading binary content to a content attribute.
   *
   * This is the ONE allowed exception to the HAL-FORMS template rule — binary content
   * has no `_templates` entry, so the Request is constructed directly from the
   * `cg:content` link href. The link presence is the ABAC gate.
   *
   * The request is NOT executed here. Use `contentFetch` (not `apiFetch`) to send it —
   * `contentFetch` omits the `Accept: application/hal+json` header.
   *
   * If-Match is attached only when an ETag is available (omitted when null).
   *
   * @param attributeName - The name of the content attribute
   * @param file - The file to upload
   * @param opts - Optional overrides for Content-Type and filename
   * @returns Request ready to be sent with contentFetch
   * @throws Error if the cg:content link is absent (ABAC deny)
   */
  public uploadContentRequest(
    attributeName: string,
    file: Blob | File,
    opts?: { contentType?: string; filename?: string },
  ): Request {
    const link = this.contentLink(attributeName);
    if (link === null) {
      throw new Error(
        `Content upload not permitted for attribute '${attributeName}': cg:content link absent`,
      );
    }

    const contentType =
      opts?.contentType ??
      (file instanceof File && file.type ? file.type : "application/octet-stream");

    const filename = opts?.filename ?? (file instanceof File ? file.name : undefined);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    if (filename) {
      headers["Content-Disposition"] = contentDispositionAttachment(filename);
    }

    if (this.etag !== null) {
      headers["If-Match"] = this.etag;
    }

    return new Request(link.href, {
      method: "PUT",
      body: file,
      headers,
    });
  }

  /**
   * Builds a GET Request for downloading binary content from a content attribute.
   *
   * This is the ONE allowed exception to the HAL-FORMS template rule — binary content
   * has no `_templates` entry, so the Request is constructed directly from the
   * `cg:content` link href. The link presence is the ABAC gate.
   *
   * The request is NOT executed here. Use `contentFetch` (not `apiFetch`) to send it —
   * `contentFetch` omits the `Accept: application/hal+json` header.
   *
   * Optionally adds a `Range` header for partial content requests (206 Partial Content).
   *
   * @param attributeName - The name of the content attribute
   * @param opts - Optional range for partial downloads
   * @returns Request ready to be sent with contentFetch
   * @throws Error if the cg:content link is absent (ABAC deny)
   */
  public downloadContentRequest(
    attributeName: string,
    opts?: { range?: { start: number; end?: number } },
  ): Request {
    const link = this.contentLink(attributeName);
    if (link === null) {
      throw new Error(
        `Content download not permitted for attribute '${attributeName}': cg:content link absent`,
      );
    }

    const headers: Record<string, string> = {};

    if (opts?.range !== undefined) {
      const { start, end } = opts.range;
      headers["Range"] = end === undefined ? `bytes=${start}-` : `bytes=${start}-${end}`;
    }

    return new Request(link.href, {
      method: "GET",
      headers,
    });
  }
}

/**
 * Discriminator for entity attribute value types.
 * Use `attribute.value.kind` to narrow the type in a switch statement.
 */
export enum AttributeKind {
  /** String, number, boolean, or null value */
  PLAIN,
  /** Binary content stored in S3 (file/image/document) */
  CONTENT,
  /** Nested object with embedded attributes */
  NESTED,
  /** Unknown/unsupported type */
  UNKNOWN,
}

/**
 * An entity attribute with its typed value and optional profile metadata.
 *
 * The `value` discriminated union provides type-safe access to attribute data.
 * The optional `profileAttribute` links to schema information (type, title, constraints).
 */
export type EntityItemAttribute = {
  value: EntityItemAttributeKind;
  profileAttribute?: ProfileAttribute;
};

type EntityItemAttributeKind =
  | EntityItemAttributePlain
  | EntityItemAttributeContent
  | EntityItemAttributeNested
  | EntityItemAttributeUnknown;

/**
 * Factory function to create an EntityItemAttribute from a raw attribute entry.
 *
 * Inspects the value type and creates the appropriate attribute kind:
 * - Plain values (string/number/boolean/null) → EntityItemAttributePlain
 * - Objects → EntityItemAttributeNested (with recursive profile lookup)
 * - Other types → EntityItemAttributeUnknown
 *
 * @param attributeName - Name of the attribute
 * @param attributeValue - Raw JSON value from the API
 * @param profileAttribute - Optional profile metadata for this attribute
 * @returns Complete EntityItemAttribute with typed value and profile link
 */
function createEntityItemAttributeValue(
  [attributeName, attributeValue]: [string, unknown],
  profileAttribute?: ProfileAttribute,
): EntityItemAttribute {
  let value: EntityItemAttributeKind;

  if (isPlainValue(attributeValue)) {
    value = new EntityItemAttributePlain(attributeName, attributeValue);
  } else if (typeof attributeValue === "object") {
    value = new EntityItemAttributeNested(
      attributeName,
      attributeValue as Record<string, unknown>,
      profileAttribute,
    );
  } else {
    value = new EntityItemAttributeUnknown(attributeName);
  }

  return {
    value,
    profileAttribute,
  };
}

/**
 * Base interface for all attribute value types.
 * Provides the discriminator `kind` and the attribute `name`.
 */
interface EntityItemAttributeBase<T extends AttributeKind> {
  readonly kind: T;
  readonly name: string;
}

/**
 * A plain scalar attribute: string, number, boolean, or null.
 *
 * Represents primitive JSON values returned directly in the entity-item response.
 */
export class EntityItemAttributePlain implements EntityItemAttributeBase<AttributeKind.PLAIN> {
  readonly kind = AttributeKind.PLAIN;
  public constructor(
    public readonly name: string,
    public readonly value: string | number | boolean | null,
  ) {}
}

/**
 * Type guard for plain scalar values.
 */
function isPlainValue(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

/**
 * A binary content attribute (file/image/document).
 *
 * The actual file is stored in S3; this attribute holds metadata (filename, size, mimetype)
 * and a link to the binary content resource. Use the `link` to fetch or update the file.
 */
export class EntityItemAttributeContent implements EntityItemAttributeBase<AttributeKind.CONTENT> {
  readonly kind = AttributeKind.CONTENT;
  public constructor(
    public readonly name: string,
    public readonly metadata: ContentMetadata | null,
    public readonly link: Link,
  ) {}
}

/**
 * Metadata for a content attribute as returned in the entity-item response.
 * The binary data itself is fetched via the cg:content link.
 */
interface ContentMetadata {
  /** File size in bytes */
  readonly length: number;
  /** MIME type (e.g., "application/pdf", "image/jpeg") */
  readonly mimetype: string;
  /** Original filename or null if not set */
  readonly filename: string | null;
}

/**
 * An attribute with an unknown or unsupported value type.
 *
 * Used as a fallback for values that are neither plain, content, nor object.
 * Typically indicates an unexpected API response or a new attribute type.
 */
export class EntityItemAttributeUnknown implements EntityItemAttributeBase<AttributeKind.UNKNOWN> {
  readonly kind = AttributeKind.UNKNOWN;
  public constructor(public readonly name: string) {}
}

/**
 * A nested object attribute with embedded sub-attributes.
 *
 * Represents a structured object field (e.g., `{street: "Main St", city: "NYC"}`).
 * The `attributes` getter recursively creates typed sub-attributes, linking each to its
 * embedded profile metadata if available.
 *
 * Supports deep nesting: nested objects can themselves contain nested objects.
 */
export class EntityItemAttributeNested implements EntityItemAttributeBase<AttributeKind.NESTED> {
  readonly kind = AttributeKind.NESTED;
  public constructor(
    public readonly name: string,
    private readonly value: Record<string, unknown> | null,
    private readonly profileAttribute?: ProfileAttribute,
  ) {}

  /**
   * Get nested attributes with profile metadata.
   * Uses embedded attributes from the parent ProfileAttribute for linking.
   */
  public get attributes(): readonly EntityItemAttribute[] {
    if (this.value === null) {
      return [];
    }

    return Object.entries(this.value).map(([name, value]) => {
      // Look up the profile for this nested attribute
      const nestedProfileAttribute = this.profileAttribute?.getEmbeddedAttribute(name);

      return createEntityItemAttributeValue([name, value], nestedProfileAttribute);
    });
  }
}
