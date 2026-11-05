import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type EntityItem,
  EntityItemAttributeContent,
  type ProfileAttribute,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { useSelectedContentAttribute } from "./use-selected-content-attribute";

// Duck-typed profile/item, as in select-default-content-attribute.test.ts.
function makeProfileEntity(name: string, contentAttributeNames: readonly string[]): ProfileEntity {
  return {
    name,
    userDefinedAttributes: [
      ...contentAttributeNames.map((attr) => ({ name: attr, isContent: true })),
      { name: "title", isContent: false },
    ] as unknown as ProfileAttribute[],
  } as unknown as ProfileEntity;
}

function makeItem(id: string, filled: readonly string[]): EntityItem {
  return {
    id,
    attributes: filled.map((name) => ({
      value: new EntityItemAttributeContent(
        name,
        { filename: `${name}.pdf`, length: 1, mimetype: "application/pdf" },
        { href: `https://api.example.com/${id}/${name}` } as never,
      ),
    })),
  } as unknown as EntityItem;
}

const document = makeProfileEntity("document", ["scan", "receipt"]);
const doc1 = makeItem("1", ["receipt"]);
const doc2 = makeItem("2", ["scan"]);

describe("useSelectedContentAttribute", () => {
  it("picks the data-model default without a user choice", () => {
    const { result } = renderHook(() => useSelectedContentAttribute(document, doc1));

    expect(result.current[0]).toBe("receipt");
  });

  it("is undefined when the profile has no content attributes", () => {
    const { result } = renderHook(() =>
      useSelectedContentAttribute(makeProfileEntity("note", []), makeItem("1", [])),
    );

    expect(result.current[0]).toBeUndefined();
  });

  it("keeps the user's choice across re-renders of the same item", () => {
    const { result, rerender } = renderHook(
      ({ item }) => useSelectedContentAttribute(document, item),
      { initialProps: { item: doc1 } },
    );

    act(() => result.current[1]("scan"));
    expect(result.current[0]).toBe("scan");

    rerender({ item: doc1 });
    expect(result.current[0]).toBe("scan");
  });

  it("resets to the default when the item changes, and does not bring the choice back", () => {
    const { result, rerender } = renderHook(
      ({ item }) => useSelectedContentAttribute(document, item),
      { initialProps: { item: doc1 } },
    );
    act(() => result.current[1]("scan"));

    rerender({ item: doc2 });
    expect(result.current[0]).toBe("scan"); // doc2's own default is also scan
    rerender({ item: doc1 });
    expect(result.current[0]).toBe("receipt");
  });

  it("resets when only the entity changes (same id)", () => {
    const invoice = makeProfileEntity("invoice", ["pdf"]);
    const { result, rerender } = renderHook(
      ({ profile, item }) => useSelectedContentAttribute(profile, item),
      { initialProps: { profile: document, item: doc1 } },
    );
    act(() => result.current[1]("scan"));

    rerender({ profile: invoice, item: makeItem("1", ["pdf"]) });

    expect(result.current[0]).toBe("pdf");
  });

  it("falls back to the default when the choice is not a content attribute of the profile", () => {
    const { result } = renderHook(() => useSelectedContentAttribute(document, doc1));

    act(() => result.current[1]("title"));

    expect(result.current[0]).toBe("receipt");
  });
});
