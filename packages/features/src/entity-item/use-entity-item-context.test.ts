import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  describe("onEditingChange", () => {
    const itemA = makeAllAttributeItem();
    const itemB = makeAllAttributeItem({
      _links: { self: { href: "https://api.example.contentgrid.com/all-attributes/other" } },
    });
    const noRefetch = () => Promise.resolve({ isSuccess: false });

    function renderWithListener(item: EntityItem = itemA) {
      const onEditingChange = vi.fn();
      const hook = renderHook(
        ({ item: shown }) => useEntityItemContext(shown, noRefetch, onEditingChange),
        { initialProps: { item } },
      );
      return { ...hook, onEditingChange };
    }

    it("is not called while the item is never edited", () => {
      const { onEditingChange } = renderWithListener();

      expect(onEditingChange).not.toHaveBeenCalled();
    });

    it("reports opening and closing edit mode", () => {
      const { result, onEditingChange } = renderWithListener();

      act(() => result.current.setIsEditing(true));
      act(() => result.current.setIsEditing(false));

      expect(onEditingChange.mock.calls).toEqual([[true], [false]]);
    });

    it("reports false when the page moves on to another item while editing", () => {
      const { result, rerender, onEditingChange } = renderWithListener();

      act(() => result.current.setIsEditing(true));
      rerender({ item: itemB as EntityItem });

      expect(onEditingChange.mock.calls).toEqual([[true], [false]]);
    });

    it("reports false when unmounted while editing", () => {
      const { result, unmount, onEditingChange } = renderWithListener();

      act(() => result.current.setIsEditing(true));
      unmount();

      expect(onEditingChange.mock.calls).toEqual([[true], [false]]);
    });
  });
});
