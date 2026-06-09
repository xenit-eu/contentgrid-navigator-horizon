import { useCallback, useSyncExternalStore } from "react";

export interface SavedSearch {
  id: string;
  label: string;
  entityName: string;
  search?: string;
  searchField?: string;
  sort?: string;
  filters?: Record<string, string>;
  pinned: boolean;
  order: number;
}

const STORAGE_KEY = "savedSearches";

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): string {
  return sessionStorage.getItem(STORAGE_KEY) ?? "[]";
}

function readSearches(): SavedSearch[] {
  try {
    return JSON.parse(getSnapshot()) as SavedSearch[];
  } catch {
    return [];
  }
}

function writeSearches(searches: SavedSearch[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  emitChange();
}

export function useSavedSearches() {
  useSyncExternalStore(subscribe, getSnapshot);
  const searches = readSearches();

  const save = useCallback((search: Omit<SavedSearch, "id" | "order">) => {
    const current = readSearches();
    const maxOrder = current.reduce((max, s) => Math.max(max, s.order), -1);
    const newSearch: SavedSearch = { ...search, id: crypto.randomUUID(), order: maxOrder + 1 };
    writeSearches([...current, newSearch]);
    return newSearch;
  }, []);

  const remove = useCallback((id: string) => {
    writeSearches(readSearches().filter((s) => s.id !== id));
  }, []);

  const update = useCallback((id: string, partial: Partial<Omit<SavedSearch, "id">>) => {
    writeSearches(readSearches().map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }, []);

  const reorder = useCallback((orderedIds: string[]) => {
    writeSearches(
      readSearches().map((s) => {
        const newOrder = orderedIds.indexOf(s.id);
        return newOrder >= 0 ? { ...s, order: newOrder } : s;
      }),
    );
  }, []);

  const exportSearches = useCallback((): string => JSON.stringify(readSearches(), null, 2), []);

  const importSearches = useCallback((json: string): { success: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed))
        return { success: false, error: "Invalid format: expected an array" };
      for (const item of parsed as Array<Record<string, unknown>>) {
        if (!item["id"] || !item["label"] || !item["entityName"]) {
          return {
            success: false,
            error: "Invalid format: each search must have id, label, and entityName",
          };
        }
      }
      writeSearches(parsed as SavedSearch[]);
      return { success: true };
    } catch {
      return { success: false, error: "Invalid JSON" };
    }
  }, []);

  return { searches, save, remove, update, reorder, exportSearches, importSearches };
}
