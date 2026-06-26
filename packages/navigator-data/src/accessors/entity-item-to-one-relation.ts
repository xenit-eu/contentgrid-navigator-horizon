import { queryOptions } from "@tanstack/react-query";
import type { Link } from "@contentgrid/hal";
import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import { resolveTemplate } from "@contentgrid/hal-forms";
import halFormCodecs from "@contentgrid/hal-forms/codecs";
import { createValues } from "@contentgrid/hal-forms/values";
import type { TypedFetch } from "../api/client";
import { ProblemDetailError } from "../api/errors";
import { fetchHal } from "../api/hal-client";
import type { RelationDeleteRequestSpec, RelationUpdateRequestSpec } from "../api/requests";
import { queryKeys } from "../query-keys";
import type { EntityItemShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
// type-only import: avoids a hard runtime cycle (entity-item.ts will import this file).
// The EntityItem class is accessed via a lazy import() in the static queryFn.
import type { EntityItem } from "./entity-item";
import type ProfileEntity from "./entity-profile";
import type { ProfileRelation } from "./relation-profile";

// matches ENTITY_ITEM_STALE_TIME in entity-item.ts
const RELATION_STALE_TIME = 30 * 1000;

/**
 * A to-one relation on an entity item, joining the `cg:relation` navigation link with the
 * `ProfileRelation` schema metadata and the item's HAL-FORMS relation templates.
 *
 * Provides typed read queries (fetching the related entity item) and request builders
 * for mutating the relation (`set-<name>`, `clear-<name>`).
 *
 * The `source` item is carried so the mutation layer can attach `If-Match` from
 * `source.etag` and re-fetch the parent after mutation.
 *
 * @example
 * ```typescript
 * const rel = item.getToOneRelation("supplier");
 * if (rel?.canSet) {
 *   const req = rel.setRelationRequest("https://api.example.com/suppliers/sup-001");
 *   await fetchVoid(apiFetch, req);
 * }
 * ```
 */
export class EntityItemToOneRelation {
  // ========================================
  // Static Query Options Factory
  // ========================================

  /**
   * Returns TanStack Query options for fetching the target entity item at the given relation URL.
   *
   * Returns `null` when the server responds with 404 (empty to-one slot / ABAC deny).
   * All other errors are rethrown.
   */
  public static fetchQuery(
    apiFetch: TypedFetch,
    url: string,
    targetProfileEntity: ProfileEntity,
    override: QueryOptionsOverride<EntityItem | null, Error> = {},
  ) {
    return queryOptions({
      queryKey: queryKeys.toOneRelation.byUrl(targetProfileEntity, url),
      queryFn: async () => {
        try {
          const { object, etag } = await fetchHal<EntityItemShape>(apiFetch, new Request(url));
          // Lazy import breaks the runtime cycle: entity-item.ts will import this module,
          // so we cannot import it at module load time.
          const { EntityItem: EntityItemClass } = await import("./entity-item");
          return new EntityItemClass(object, targetProfileEntity, etag);
        } catch (e) {
          if (e instanceof ProblemDetailError && e.problemDetail.status === 404) {
            return null;
          }
          throw e;
        }
      },
      staleTime: RELATION_STALE_TIME,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      ...override,
    });
  }

  // ========================================
  // Constructor & Instance Properties
  // ========================================

  constructor(
    /** The relation name (e.g. "supplier"). */
    public readonly name: string,
    /** The `cg:relation` navigation link on the source item. */
    public readonly link: Link,
    /** Profile schema metadata for this relation. */
    public readonly profileRelation: ProfileRelation,
    /** The source entity item; used for template lookup, ETag, and parent re-fetch. */
    public readonly source: EntityItem,
  ) {}

  // ========================================
  // Instance Query Factory
  // ========================================

  /**
   * Returns TanStack Query options for fetching the target entity item via this relation's link href.
   *
   * Delegates to the static factory using `this.link.href`.
   */
  public fetchQuery(apiFetch: TypedFetch, targetProfileEntity: ProfileEntity) {
    return EntityItemToOneRelation.fetchQuery(apiFetch, this.link.href, targetProfileEntity);
  }

  // ========================================
  // Private Template Access
  // ========================================

  private get halItemData() {
    return this.source.halItem.data;
  }

  // ========================================
  // Template Getters
  // ========================================

  /**
   * The HAL-FORMS template for setting (replacing) this to-one relation.
   *
   * Returns `null` when the `set-<name>` template is absent (ABAC deny).
   */
  get setTemplate(): HalFormsTemplate<RelationUpdateRequestSpec> | null {
    return resolveTemplate(this.halItemData, `set-${this.name}`);
  }

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
   * The HAL-FORMS template for clearing this relation.
   *
   * Returns `null` when the `clear-<name>` template is absent (ABAC deny).
   */
  get clearTemplate(): HalFormsTemplate<RelationDeleteRequestSpec> | null {
    return resolveTemplate(this.halItemData, `clear-${this.name}`);
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

  // ========================================
  // Request Builders
  // ========================================

  /**
   * Encode a "set" Request for this to-one relation using the HAL-FORMS codec.
   *
   * Does NOT attach `If-Match` — the mutation hook attaches it from `source.etag` (RFC 9110).
   *
   * @param uri - The href of the target entity item
   * @returns Request ready to be sent with apiFetch (after the hook adds If-Match)
   * @throws {Error} if the `set-<name>` template is absent (ABAC deny)
   */
  setRelationRequest(uri: string): Request {
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
    return codec.encode(createValues(template).withValue(prop.name, uri));
  }

  /**
   * Encode a "clear" Request for this relation using the HAL-FORMS codec.
   *
   * Does NOT attach `If-Match` — the mutation hook attaches it from `source.etag` (RFC 9110).
   *
   * @returns Request ready to be sent with apiFetch (after the hook adds If-Match)
   * @throws {Error} if the `clear-<name>` template is absent (ABAC deny)
   */
  clearRelationRequest(): Request {
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
