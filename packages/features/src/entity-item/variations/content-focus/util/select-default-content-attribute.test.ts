import { describe, expect, it } from "vitest";
import {
  AttributeKind,
  type EntityItem,
  type EntityItemAttribute,
  EntityItemAttributeContent,
  type ProfileAttribute,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { selectDefaultContentAttribute } from "./select-default-content-attribute";

/**
 * `loadDumpProfile`/`makeProfileEntity` from `packages/navigator-data/src/hooks/test-utils.tsx`
 * are internal to that package — `@contentgrid/navigator-data`'s `package.json` `exports` map
 * only publishes `.`, `./config`, `./field-value`, and `./test-fixtures/*.ts`, none of which
 * reach `src/hooks/test-utils.tsx` or the raw `test-fixtures/entity-profiles/*.json` dump (the
 * glob target requires a literal `.ts` file). This test instead follows the pattern already
 * established for cross-package `packages/features` unit tests against navigator-data accessors
 * (see `entity-item/attributes/entity-item-attributes.test.tsx`'s `makeProfileAttribute`/
 * `makeItem`): duck-typed `ProfileEntity`/`EntityItem` objects built from real, exported
 * navigator-data value types (`EntityItemAttributeContent`, `AttributeKind`), cast through
 * `as unknown as`.
 */
function makeProfileAttribute(name: string, isContent = true): ProfileAttribute {
  return { name, isContent } as unknown as ProfileAttribute;
}

function makeProfileEntity(contentAttributeNames: readonly string[]): ProfileEntity {
  return {
    userDefinedAttributes: contentAttributeNames.map((name) => makeProfileAttribute(name)),
  } as unknown as ProfileEntity;
}

function makeContentAttribute(name: string, hasFile: boolean): EntityItemAttribute {
  return {
    value: new EntityItemAttributeContent(
      name,
      hasFile ? { filename: `${name}.pdf`, length: 10, mimetype: "application/pdf" } : null,
      { href: `https://api.example.com/items/1/${name}` } as never,
    ),
  };
}

function makeEntityItem(attributes: readonly EntityItemAttribute[]): EntityItem {
  return { attributes } as unknown as EntityItem;
}

describe("selectDefaultContentAttribute", () => {
  it("returns undefined when the profile has no content attributes", () => {
    const profileEntity = makeProfileEntity([]);
    const entityItem = makeEntityItem([]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBeUndefined();
  });

  it("returns the sole content attribute even when it holds no file", () => {
    const profileEntity = makeProfileEntity(["document"]);
    const entityItem = makeEntityItem([makeContentAttribute("document", false)]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBe("document");
  });

  it("returns the first content attribute in profile order that holds a file", () => {
    const profileEntity = makeProfileEntity(["document", "receipt"]);
    const entityItem = makeEntityItem([
      makeContentAttribute("document", false),
      makeContentAttribute("receipt", true),
    ]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBe("receipt");
  });

  it("prefers the earlier content attribute when both hold a file", () => {
    const profileEntity = makeProfileEntity(["document", "receipt"]);
    const entityItem = makeEntityItem([
      makeContentAttribute("document", true),
      makeContentAttribute("receipt", true),
    ]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBe("document");
  });

  it("falls back to the first content attribute in profile order when none holds a file", () => {
    const profileEntity = makeProfileEntity(["document", "receipt"]);
    const entityItem = makeEntityItem([
      makeContentAttribute("document", false),
      makeContentAttribute("receipt", false),
    ]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBe("document");
  });

  it("ignores a content attribute that the item has no value for at all", () => {
    const profileEntity = makeProfileEntity(["document", "receipt"]);
    // Only "receipt" appears on the item — e.g. a profile change since the item was fetched.
    const entityItem = makeEntityItem([makeContentAttribute("receipt", true)]);

    expect(selectDefaultContentAttribute(profileEntity, entityItem)).toBe("receipt");
  });

  it("confirms AttributeKind.CONTENT still discriminates EntityItemAttributeContent", () => {
    const attribute = makeContentAttribute("document", true);
    expect(attribute.value.kind).toBe(AttributeKind.CONTENT);
  });
});
