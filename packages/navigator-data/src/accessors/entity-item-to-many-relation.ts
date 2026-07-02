import type { Link } from "@contentgrid/hal";
import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import { createValues } from "@contentgrid/hal-forms/values";
import type { TypedFetch } from "../api/client";
import type { RelationDeleteRequestSpec, RelationUpdateRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import type { EntityItem } from "./entity-item";
import { EntityItemCollection } from "./entity-item-collection";
import type ProfileEntity from "./entity-profile";
import type { ProfileRelation } from "./relation-profile";

/**
 * A to-many relation on an entity item, joining the `cg:relation` navigation link
 * with the `ProfileRelation` schema metadata and the item's HAL-FORMS relation templates.
 *
 * Exposes typed access to the `add-<rel>` and `clear-<rel>` templates and
 * the static/instance `fetchQuery` factories for fetching the related collection.
 *
 * @example
 * ```typescript
 * const rel = item.getToManyRelation("lineItems");
 * if (rel?.canAdd) {
 *   const req = rel.addRelationRequest(["https://api.example.com/line-items/li-001"]);
 *   await fetchVoid(apiFetch, req);
 * }
 * ```
 */
export class EntityItemToManyRelation {
  // ========================================
  // Static Query Options Factory
  // ========================================

  /**
   * Query options factory for fetching a to-many relation collection by URL.
   *
   * Delegates to `EntityItemCollection.fetchByUrlQuery` but overrides the query key
   * to the `toManyRelation` namespace so relation reads and mutation invalidations
   * do not collide with regular entity-item collection queries.
   *
   * @param apiFetch - Authenticated TypedFetch instance
   * @param url - The relation href (from the `cg:relation` link on the source item)
   * @param targetProfileEntity - Profile of the target entity type
   * @param override - Optional query options to override defaults
   */
  public static fetchQuery(
    apiFetch: TypedFetch,
    url: string,
    targetProfileEntity: ProfileEntity,
    relationName: string,
    override: QueryOptionsOverride<EntityItemCollection, Error> = {},
  ) {
    const base = EntityItemCollection.fetchByUrlQuery(apiFetch, url, targetProfileEntity, override);
    // Override queryKey to the to-many relation namespace AFTER spreading base (which already
    // contains the override options). This ensures our namespace key always wins even if a
    // caller passed a custom queryKey in override.
    return {
      ...base,
      queryKey: queryKeys.toManyRelation.byUrl(relationName, url),
    };
  }

  // ========================================
  // Constructor
  // ========================================

  constructor(
    public readonly name: string,
    public readonly link: Link,
    public readonly profileRelation: ProfileRelation,
    public readonly source: EntityItem,
  ) {}

  // ========================================
  // Instance Query Factory
  // ========================================

  /**
   * Instance convenience wrapper around the static `fetchQuery`.
   * Uses `this.link.href` as the URL.
   */
  public fetchQuery(apiFetch: TypedFetch, targetProfileEntity: ProfileEntity) {
    return EntityItemToManyRelation.fetchQuery(
      apiFetch,
      this.link.href,
      targetProfileEntity,
      this.name,
    );
  }

  // ========================================
  // Template Getters
  // ========================================

  /** The HAL-FORMS `add-<rel>` template, or `null` when absent (ABAC deny). */
  get addTemplate(): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.source.halItem.data, `add-${this.name}`);
  }

  /** Whether the current user is permitted to add to this to-many relation. */
  get canAdd(): boolean {
    return this.addTemplate !== null;
  }

  /** The HAL-FORMS `clear-<rel>` template, or `null` when absent (ABAC deny). */
  get clearTemplate(): HalFormsTemplate<RelationDeleteRequestSpec> | null {
    return resolveTemplate(this.source.halItem.data, `clear-${this.name}`);
  }

  /** Whether the current user is permitted to clear this to-many relation. */
  get canClear(): boolean {
    return this.clearTemplate !== null;
  }

  // ========================================
  // Request Builders
  // ========================================

  /**
   * Encode an "add" Request for this to-many relation using the HAL-FORMS codec.
   *
   * The `add-<rel>` template property must have `options: {}` so the codec treats
   * the value as multi-value (one URL per line in `text/uri-list`).
   *
   * @param uris - The hrefs of the target entity items to add
   * @returns Request ready to be sent with `fetchVoid(apiFetch, req)`
   * @throws {Error} if the `add-<rel>` template is absent (ABAC deny)
   */
  public addRelationRequest(uris: readonly string[]): Request {
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
    return codec.encode(createValues(template).withValue(prop.name, uris));
  }

  /**
   * Encode a "clear" Request for this to-many relation using the HAL-FORMS codec.
   *
   * @returns Request ready to be sent with `fetchVoid(apiFetch, req)`
   * @throws {Error} if the `clear-<rel>` template is absent (ABAC deny)
   */
  public clearRelationRequest(): Request {
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
