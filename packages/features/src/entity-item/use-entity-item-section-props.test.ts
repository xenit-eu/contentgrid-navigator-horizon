/**
 * Tests for `useEntityItemSectionProps`: the caller's `onEditingChange` only hears edit mode, it
 * never replaces the handler that opens the form.
 */
import { createRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import type { EntityItemEditHandle } from "./edit/entity-item-edit-handle";
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

  it("opens and cancels edit mode through the caller's handle, which hides the section's own buttons", () => {
    const onEditingChange = vi.fn();
    const onStartEdit = vi.fn();
    const handle = createRef<EntityItemEditHandle>();
    const { result } = renderHook(() =>
      useEntityItemSectionProps({ item, onEditingChange, editHandleRef: handle, onStartEdit }),
    );
    expect(result.current.externalEditControl).toBe(true);

    act(() => handle.current?.startEdit());
    expect(onStartEdit).toHaveBeenCalledOnce();
    expect(result.current.editedItem).toBe(item);
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    // The Attributes section is open for the form.
    expect(result.current.state.openProps("attributes", false).open).toBe(true);

    // No update form is mounted in this hook test, so cancelling leaves edit mode directly.
    act(() => handle.current?.cancelEdit());
    expect(result.current.editedItem).toBeNull();
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });

  it("cancels through the update form while it is mounted, so unsaved changes are confirmed", () => {
    const handle = createRef<EntityItemEditHandle>();
    const { result } = renderHook(() => useEntityItemSectionProps({ item, editHandleRef: handle }));
    const cancel = vi.fn();
    result.current.editFormRef!.current = { cancel };

    act(() => handle.current?.startEdit());
    act(() => handle.current?.cancelEdit());

    expect(cancel).toHaveBeenCalledOnce();
    expect(result.current.editedItem).toBe(item);
  });

  it("keeps the section's own Edit button without a handle", () => {
    const { result } = renderHook(() => useEntityItemSectionProps({ item }));
    expect(result.current.externalEditControl).toBe(false);
  });
});
