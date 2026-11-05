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

    act(() => result.current.sectionRef("relation:invoices")(element));
    act(() => result.current.revealRelation("invoices"));

    expect(result.current.openProps("relation:invoices", false).open).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    // An unregistered section is opened without scrolling.
    scrollIntoView.mockClear();
    act(() => result.current.sectionRef("relation:invoices")(null));
    act(() => result.current.revealRelation("invoices"));
    expect(scrollIntoView).not.toHaveBeenCalled();
    rafSpy.mockRestore();
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
