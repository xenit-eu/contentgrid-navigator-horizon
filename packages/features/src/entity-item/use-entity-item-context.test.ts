import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { makeAllAttributeItem } from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { relationSection, useEntityItemContext } from "./use-entity-item-context";

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

describe("useEntityItemContext sections", () => {
  it("uses the default until a section is toggled", () => {
    const { result } = renderHook(() => useEntityItemContext(makeAllAttributeItem()).sections);

    expect(result.current.openProps("invoices", false).open).toBe(false);
    act(() => result.current.openProps("invoices", false).onOpenChange(true));
    expect(result.current.openProps("invoices", false).open).toBe(true);
  });

  it("revealRelation expands a relation's section and scrolls its element into view", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const element = document.createElement("section");
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;
    const { result } = renderHook(() => useEntityItemContext(makeAllAttributeItem()).sections);

    act(() => result.current.sectionRef(relationSection("invoices"))(element));
    act(() => result.current.revealRelation("invoices"));

    expect(result.current.openProps(relationSection("invoices"), false).open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    // An unregistered section is opened without scrolling.
    scrollIntoView.mockClear();
    act(() => result.current.sectionRef(relationSection("invoices"))(null));
    act(() => result.current.revealRelation("invoices"));
    expect(scrollIntoView).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("restores every section's default when the page moves on to another item", () => {
    const itemA = makeAllAttributeItem();
    const itemB = makeAllAttributeItem({
      _links: { self: { href: "https://api.example.contentgrid.com/all-attributes/other" } },
    });
    // The hook stays mounted across items, as it does when the next item comes from the cache.
    const { result, rerender } = renderHook(({ item }) => useEntityItemContext(item).sections, {
      initialProps: { item: itemA as EntityItem },
    });

    act(() => result.current.openProps("attributes", true).onOpenChange(false));
    act(() => result.current.revealRelation("invoices"));
    expect(result.current.openProps("attributes", true).open).toBe(false);

    rerender({ item: itemB });
    expect(result.current.openProps("attributes", true).open).toBe(true);
    expect(result.current.openProps(relationSection("invoices"), false).open).toBe(false);

    // Coming back to the first item does not bring its toggles back either.
    rerender({ item: itemA });
    expect(result.current.openProps("attributes", true).open).toBe(true);
  });

  it("keeps toggles while the same item is refetched", () => {
    const { result, rerender } = renderHook(({ item }) => useEntityItemContext(item).sections, {
      initialProps: { item: makeAllAttributeItem() as EntityItem },
    });

    act(() => result.current.openProps("attributes", true).onOpenChange(false));
    rerender({ item: makeAllAttributeItem() });
    expect(result.current.openProps("attributes", true).open).toBe(false);
  });

  it("sectionRef returns the same callback for a section across renders", () => {
    const { result, rerender } = renderHook(
      () => useEntityItemContext(makeAllAttributeItem()).sections,
    );
    const first = result.current.sectionRef("attributes");
    rerender();
    expect(result.current.sectionRef("attributes")).toBe(first);
    expect(result.current.sectionRef("audit")).not.toBe(first);
  });
});
