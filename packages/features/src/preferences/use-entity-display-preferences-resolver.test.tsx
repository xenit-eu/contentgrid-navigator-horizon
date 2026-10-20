import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { createRelationDemoAccessors } from "@contentgrid/navigator-data/test-fixtures/hal/relation-demo-accessors";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { useEntityDisplayPreferencesResolver } from "./use-entity-display-preferences-resolver";

const PROFILE_URL = "https://api.example.com/profile";
const noopSupplier: AuthenticationTokenSupplier = async () => null;
const demo = createRelationDemoAccessors();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl={PROFILE_URL}
      >
        {children}
      </NavigatorDataProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("useEntityDisplayPreferencesResolver", () => {
  it("resolves colour, icon and name attribute per entity type", () => {
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "customer", { color: "green" });
    const { result } = renderHook(() => useEntityDisplayPreferencesResolver(), { wrapper });

    expect(result.current(demo.profile("customer"))).toMatchObject({
      color: "green",
      icon: "Database",
      nameAttribute: expect.objectContaining({ name: "name" }),
    });
    expect(result.current(demo.profile("order")).color).toBeUndefined();
  });

  it("re-resolves after a preference change", () => {
    const { result } = renderHook(() => useEntityDisplayPreferencesResolver(), { wrapper });
    expect(result.current(demo.profile("order")).color).toBeUndefined();

    act(() => {
      useEntityDisplayPreferencesStore
        .getState()
        .setOverride(PROFILE_URL, "order", { color: "purple" });
    });
    expect(result.current(demo.profile("order")).color).toBe("purple");
  });
});
