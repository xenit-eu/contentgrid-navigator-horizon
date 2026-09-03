import { afterEach, describe, expect, it } from "vitest";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";

const PROFILE_URL_A = "https://a.example.com/profile";
const PROFILE_URL_B = "https://b.example.com/profile";

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("useEntityDisplayPreferencesStore", () => {
  it("starts with no overrides", () => {
    expect(useEntityDisplayPreferencesStore.getState().overrides).toEqual({});
  });

  it("setOverride stores a partial override for one entity on one backend", () => {
    useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL_A, "invoice", {
      color: "blue",
    });

    expect(useEntityDisplayPreferencesStore.getState().overrides).toEqual({
      [PROFILE_URL_A]: { invoice: { color: "blue" } },
    });
  });

  it("setOverride merges into an existing override rather than replacing it", () => {
    const { setOverride } = useEntityDisplayPreferencesStore.getState();
    setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    setOverride(PROFILE_URL_A, "invoice", { icon: "file" });

    expect(useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL_A].invoice).toEqual({
      color: "blue",
      icon: "file",
    });
  });

  it("scopes overrides per backend — same entity name, different profileUrl", () => {
    const { setOverride } = useEntityDisplayPreferencesStore.getState();
    setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    setOverride(PROFILE_URL_B, "invoice", { color: "red" });

    const { overrides } = useEntityDisplayPreferencesStore.getState();
    expect(overrides[PROFILE_URL_A].invoice.color).toBe("blue");
    expect(overrides[PROFILE_URL_B].invoice.color).toBe("red");
  });

  it("clearOverride removes all overridden fields for one entity, leaving other entities intact", () => {
    const { setOverride, clearOverride } = useEntityDisplayPreferencesStore.getState();
    setOverride(PROFILE_URL_A, "invoice", { color: "blue" });
    setOverride(PROFILE_URL_A, "customer", { color: "green" });

    clearOverride(PROFILE_URL_A, "invoice");

    const { overrides } = useEntityDisplayPreferencesStore.getState();
    expect(overrides[PROFILE_URL_A].invoice).toBeUndefined();
    expect(overrides[PROFILE_URL_A].customer).toEqual({ color: "green" });
  });

  it("persists overrides to localStorage", () => {
    useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL_A, "invoice", {
      color: "blue",
    });

    const raw = localStorage.getItem("contentgrid-entity-display-preferences");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.overrides[PROFILE_URL_A].invoice.color).toBe("blue");
  });
});
