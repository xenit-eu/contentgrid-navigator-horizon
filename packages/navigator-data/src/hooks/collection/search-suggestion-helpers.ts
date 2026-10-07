import type { ProfileAttribute } from "../../accessors/attribute-profile";
import { AttributeKind } from "../../accessors/entity-item";
import type { EntityItemCollection } from "../../accessors/entity-item-collection";
import type ProfileEntity from "../../accessors/entity-profile";
import type { SearchHalFormTemplateProperty } from "../../accessors/extended-forms/search-form";

export interface RelationSearchTarget {
  /** The relation's target entity profile. */
  readonly targetProfile: ProfileEntity;
  /** The same parameter on the target entity's own search template, under its local name. */
  readonly targetSearchProperty: SearchHalFormTemplateProperty;
  /** The target entity's attribute the parameter searches, when the target template knows it. */
  readonly targetAttribute: ProfileAttribute | undefined;
}

/**
 * Resolves a relation-traversal search parameter (e.g. `customer.name~prefix` on an invoice) to
 * the relation's target profile and the corresponding parameter on THAT profile's own search
 * template (`name~prefix` on the customer). Relation-traversal parameters live on the target
 * entity's template under their local, un-prefixed name — the parent's items don't embed the
 * related entity's fields, so suggestions for such a parameter have to come from the target's
 * own collection.
 *
 * Returns `undefined` for a direct (non-relation) parameter, and when the target profile or its
 * matching parameter cannot be resolved (yet) from `profiles`.
 */
export function resolveRelationSearchTarget(
  searchProperty: SearchHalFormTemplateProperty,
  profiles: readonly ProfileEntity[],
): RelationSearchTarget | undefined {
  if (!searchProperty.isOverRelation) return undefined;
  const relation = searchProperty.profileRelation;
  if (!relation) return undefined;

  const targetProfile = relation.getTargetProfile(profiles);
  const localName = searchProperty.property.name.slice(relation.name.length + 1);
  const targetSearchProperty = targetProfile?.searchTemplate?.getSearchPropertyByName(localName);
  if (!targetProfile || !targetSearchProperty) return undefined;

  return {
    targetProfile,
    targetSearchProperty,
    targetAttribute: targetSearchProperty.profileAttribute,
  };
}

/**
 * Non-empty plain string values of `attributeName` across the collection's items, in response
 * order, with duplicate occurrences counted rather than collapsed.
 */
export function countAttributeValues(
  collection: EntityItemCollection | undefined,
  attributeName: string | undefined,
): { value: string; count: number }[] {
  if (!collection || !attributeName) return [];
  const counts = new Map<string, number>();
  for (const item of collection.items) {
    const attribute = item.findAttribute(attributeName);
    if (attribute?.value.kind !== AttributeKind.PLAIN) continue;
    const { value } = attribute.value;
    if (typeof value === "string" && value.length > 0) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

/**
 * Distinct, non-empty string values of `attributeName` across the collection's items, in
 * response order (so they follow the collection's own sort), capped at `limit`.
 */
export function extractAttributeSuggestions(
  collection: EntityItemCollection | undefined,
  attributeName: string | undefined,
  limit: number,
): string[] {
  return countAttributeValues(collection, attributeName)
    .slice(0, limit)
    .map(({ value }) => value);
}
