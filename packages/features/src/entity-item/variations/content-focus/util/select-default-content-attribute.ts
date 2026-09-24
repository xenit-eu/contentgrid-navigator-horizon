import { AttributeKind, type EntityItem, type ProfileEntity } from "@contentgrid/navigator-data";

/**
 * Picks which content attribute a content-focus view opens by default (data-model.md's
 * "Content attribute" rules, FR-004): the first content attribute in profile order whose item
 * value holds a file, or — when none does — the first content attribute in profile order (its
 * panel then shows the "No file" state).
 *
 * Pure: reads `profileEntity`/`entityItem` accessors only, fetches nothing, renders nothing.
 * Content attributes are user-defined (never audit fields), so profile order is read from
 * `profileEntity.userDefinedAttributes` — the same list `ProfileEntity.hasContentAttributes`
 * checks.
 *
 * @returns the attribute's name, or `undefined` when `profileEntity` has no content attributes
 *   at all. Callers gate on `profileEntity.hasContentAttributes` before reaching a content-focus
 *   layout at all (FR-001), so `undefined` should not occur in practice — it is handled here
 *   only so this function stays a total, pure function.
 */
export function selectDefaultContentAttribute(
  profileEntity: ProfileEntity,
  entityItem: EntityItem,
): string | undefined {
  const contentAttributeNames = profileEntity.userDefinedAttributes
    .filter((attribute) => attribute.isContent)
    .map((attribute) => attribute.name);

  if (contentAttributeNames.length === 0) {
    return undefined;
  }

  const firstContentAttributeNameWithFile = contentAttributeNames.find((name) =>
    entityItem.attributes.some(
      (attr) =>
        attr.value.name === name &&
        attr.value.kind === AttributeKind.CONTENT &&
        attr.value.metadata !== null,
    ),
  );

  return firstContentAttributeNameWithFile ?? contentAttributeNames[0];
}
