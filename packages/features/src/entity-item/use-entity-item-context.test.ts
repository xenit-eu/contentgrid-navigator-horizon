import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { makeAllAttributeItem } from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { useEntityItemContext } from "./use-entity-item-context";

describe("useEntityItemContext", () => {
  it("does not reopen edit mode when the page comes back to the item", () => {
    const itemA = makeAllAttributeItem();
    const itemB = makeAllAttributeItem({
      _links: { self: { href: "https://api.example.contentgrid.com/all-attributes/other" } },
    });
    const { result, rerender } = renderHook(
      ({ item }) => useEntityItemContext(item, () => Promise.resolve({ isSuccess: false })),
      {
        initialProps: { item: itemA as EntityItem },
      },
    );

    act(() => result.current.setIsEditing(true));
    rerender({ item: itemB });
    rerender({ item: itemA });

    expect(result.current.isEditing).toBe(false);
  });
});
