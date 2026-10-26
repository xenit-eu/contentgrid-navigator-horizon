import { createUserPreferencesStore } from "@contentgrid/features/user-preferences";

/**
 * The user's display preferences, created once at startup. This app keeps them in
 * `localStorage`; pass another `storage` here to keep them elsewhere.
 */
export const userPreferencesStore = createUserPreferencesStore();
