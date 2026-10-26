import { afterEach, describe, expect, it } from "vitest";
import {
  USER_PREFERENCES_STORAGE_KEY,
  createMemoryStorage,
  createUserPreferencesStore,
} from "./entity-display-preferences-store";

const PROFILE_URL_A = "https://a.example.com/profile";
const PROFILE_URL_B = "https://b.example.com/profile";

afterEach(() => {
  localStorage.clear();
});

function newStore() {
  return createUserPreferencesStore({ storage: createMemoryStorage() });
}

describe("createUserPreferencesStore", () => {
  it("starts with no overrides", () => {
    expect(newStore().getState().overrides).toEqual({});
  });

  it("stores a per-backend, per-entity override", () => {
    const store = newStore();
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });

    expect(store.getState().overrides).toEqual({
      [PROFILE_URL_A]: { invoice: { color: "blue" } },
    });
  });

  it("merges successive partial overrides for the same entity", () => {
    const store = newStore();
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    store.getState().setOverride(PROFILE_URL_A, "invoice", { icon: "Receipt" });

    expect(store.getState().overrides[PROFILE_URL_A].invoice).toEqual({
      color: "blue",
      icon: "Receipt",
    });
  });

  it("keeps backends separate", () => {
    const store = newStore();
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    store.getState().setOverride(PROFILE_URL_B, "invoice", { color: "red" });

    const { overrides } = store.getState();
    expect(overrides[PROFILE_URL_A].invoice).toEqual({ color: "blue" });
    expect(overrides[PROFILE_URL_B].invoice).toEqual({ color: "red" });
  });

  it("clears every override of one entity without touching the others", () => {
    const store = newStore();
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    store.getState().setOverride(PROFILE_URL_A, "customer", { color: "green" });
    store.getState().clearOverride(PROFILE_URL_A, "invoice");

    const { overrides } = store.getState();
    expect(overrides[PROFILE_URL_A].invoice).toBeUndefined();
    expect(overrides[PROFILE_URL_A].customer).toEqual({ color: "green" });
  });

  it("persists to the injected storage under the unchanged key", () => {
    const storage = createMemoryStorage();
    const store = createUserPreferencesStore({ storage });
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });

    expect(USER_PREFERENCES_STORAGE_KEY).toBe("contentgrid-entity-display-preferences");
    const raw = storage.getItem(USER_PREFERENCES_STORAGE_KEY) as string;
    expect(JSON.parse(raw).state.overrides[PROFILE_URL_A].invoice.color).toBe("blue");
    expect(localStorage.getItem(USER_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("loads overrides persisted by an earlier session", () => {
    const stored = JSON.stringify({
      state: { overrides: { [PROFILE_URL_A]: { invoice: { color: "blue" } } } },
      version: 0,
    });
    const store = createUserPreferencesStore({
      storage: createMemoryStorage({ [USER_PREFERENCES_STORAGE_KEY]: stored }),
    });

    expect(store.getState().overrides[PROFILE_URL_A].invoice).toEqual({ color: "blue" });
  });

  it("uses localStorage by default", () => {
    const store = createUserPreferencesStore();
    store.getState().setOverride(PROFILE_URL_A, "invoice", { color: "blue" });

    const raw = localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
    expect(JSON.parse(raw!).state.overrides[PROFILE_URL_A].invoice.color).toBe("blue");
  });
});
