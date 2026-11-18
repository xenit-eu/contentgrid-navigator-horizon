/**
 * Tests for `useEntityItemSectionProps`: the caller's `onEditingChange` only hears edit mode, it
 * never replaces the handler that opens the form.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { useEntityItemSectionProps } from "./use-entity-item-section-props";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@contentgrid/navigator-data")>()),
  useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
}));

const item = { selfLink: { href: "https://api.example.com/items/1" } } as unknown as EntityItem;

describe("useEntityItemSectionProps", () => {
  it("opens edit mode and reports it to the caller's onEditingChange", () => {
    const onEditingChange = vi.fn();
    const { result } = renderHook(() => useEntityItemSectionProps({ item, onEditingChange }));

    expect(result.current.onEditingChange).not.toBe(onEditingChange);
    act(() => result.current.onEditingChange(true));

    expect(result.current.editedItem).toBe(item);
    expect(onEditingChange).toHaveBeenLastCalledWith(true);

    act(() => result.current.onEditingChange(false));
    expect(result.current.editedItem).toBeNull();
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });
});
