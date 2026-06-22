import { queryOptions } from "@tanstack/react-query";
import { HalObject } from "@contentgrid/hal";
import type { Link } from "@contentgrid/hal";
import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import type { HalFormValues } from "@contentgrid/hal-forms/values";
import { cgRels } from "../api";
import type { TypedFetch } from "../api/client";
import { fetchHal } from "../api/hal-client";
import type { EntityInstanceUpdateRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import type { ProfileAttribute } from "./attribute-profile";
import type ProfileEntity from "./entity-profile";

const ENTITY_ITEM_STALE_TIME = 30 * 1000; // 30 seconds

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
    const codec = halFormCodecs.requireCodecFor(this.defaultTemplate!);
    return codec.encode(values);
  }

  //TODO support relations
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
