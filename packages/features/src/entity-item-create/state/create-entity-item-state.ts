import { create } from "zustand";

interface CreateEntityItemState {
  initialFile: File | null;
  /** `null` clears the initial file. */
  setInitialFile: (file: File | null) => void;
}

/**
 * The file attached on the Create Item page, waiting for a create form with a file field.
 * Memory only — never persisted — so a reload drops it. It survives cancelling a create form and
 * switching entity, and is cleared once an item is created or the user removes the file.
 */
export const useCreateEntityItemState = create<CreateEntityItemState>()((set) => ({
  initialFile: null,
  setInitialFile: (initialFile) => set({ initialFile }),
}));
