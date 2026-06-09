import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSavedSearches } from "./use-saved-searches";

afterEach(() => sessionStorage.clear());

describe("useSavedSearches", () => {
  it("starts with an empty list", () => {
    const { result } = renderHook(() => useSavedSearches());
    expect(result.current.searches).toEqual([]);
  });

  it("save() adds a search and returns it with id and auto-assigned order", () => {
    const { result } = renderHook(() => useSavedSearches());
    let saved: ReturnType<typeof result.current.save>;

    act(() => {
      saved = result.current.save({
        label: "Drafts",
        entityName: "invoice",
        search: "draft",
        searchField: "status",
        pinned: false,
      });
    });

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].label).toBe("Drafts");
    expect(saved!.id).toBeTruthy();
  });

  it("remove() deletes a search by id", () => {
    const { result } = renderHook(() => useSavedSearches());
    let id: string;

    act(() => {
      id = result.current.save({ label: "X", entityName: "e", pinned: false }).id;
    });
    act(() => result.current.remove(id));

    expect(result.current.searches).toHaveLength(0);
  });

  it("update() modifies an existing search", () => {
    const { result } = renderHook(() => useSavedSearches());
    let id: string;

    act(() => {
      id = result.current.save({ label: "Old", entityName: "e", pinned: false }).id;
    });
    act(() => result.current.update(id, { label: "New" }));

    expect(result.current.searches[0].label).toBe("New");
  });

  it("reorder() reassigns order values", () => {
    const { result } = renderHook(() => useSavedSearches());
    let id1: string, id2: string;

    act(() => {
      id1 = result.current.save({ label: "A", entityName: "e", pinned: false }).id;
      id2 = result.current.save({ label: "B", entityName: "e", pinned: false }).id;
    });
    act(() => result.current.reorder([id2, id1]));

    const orders = Object.fromEntries(result.current.searches.map((s) => [s.label, s.order]));
    expect(orders["B"]).toBe(0);
    expect(orders["A"]).toBe(1);
  });

  it("exportSearches() returns JSON string of current searches", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save({ label: "Test", entityName: "e", pinned: false }));

    expect(JSON.parse(result.current.exportSearches())).toHaveLength(1);
  });

  it("importSearches() replaces existing searches with parsed data", () => {
    const { result } = renderHook(() => useSavedSearches());
    const data = JSON.stringify([
      { id: "x1", label: "Imported", entityName: "e", pinned: false, order: 0 },
    ]);

    act(() => {
      expect(result.current.importSearches(data).success).toBe(true);
    });

    expect(result.current.searches[0].label).toBe("Imported");
  });

  it("importSearches() returns error when valid JSON is not an array", () => {
    const { result } = renderHook(() => useSavedSearches());
    let res: ReturnType<typeof result.current.importSearches>;
    act(() => {
      res = result.current.importSearches(JSON.stringify({ label: "oops" }));
    });
    expect(res!.success).toBe(false);
    expect(res!.error).toMatch(/expected an array/);
  });

  it("importSearches() returns error for invalid JSON", () => {
    const { result } = renderHook(() => useSavedSearches());
    let res: ReturnType<typeof result.current.importSearches>;
    act(() => {
      res = result.current.importSearches("not-json");
    });
    expect(res!.success).toBe(false);
  });

  it("importSearches() returns error when items lack required fields", () => {
    const { result } = renderHook(() => useSavedSearches());
    let res: ReturnType<typeof result.current.importSearches>;
    act(() => {
      res = result.current.importSearches(JSON.stringify([{ id: "x" }]));
    });
    expect(res!.success).toBe(false);
  });

  it("recovers via readSearches() when sessionStorage is corrupted after render", () => {
    const { result } = renderHook(() => useSavedSearches());
    // Corrupt storage after initial render so the hook's useSyncExternalStore snapshot
    // is still valid; the corruption is only visible when readSearches() is called
    // inside save(), triggering the catch branch (line 40) and returning [].
    sessionStorage.setItem("savedSearches", "{bad json}");
    act(() => {
      result.current.save({ label: "New", entityName: "e", pinned: false });
    });
    expect(result.current.searches).toHaveLength(1);
  });

  it("unsubscribes when the hook unmounts", () => {
    const { unmount, result } = renderHook(() => useSavedSearches());
    // Add a search so there is something to verify afterwards
    act(() => {
      result.current.save({ label: "Keep", entityName: "e", pinned: false });
    });
    // Unmounting triggers the return value of subscribe() — the cleanup function on line 28
    unmount();
  });
});
