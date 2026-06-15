import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EntityInfo } from "../types/entity";
import {
  INVOICE_ENTITY,
  PROFILE_URL,
  makeQueryClient,
  makeWrapper,
  seedProfile,
} from "./test-utils";
import { useSelectedProfile } from "./use-selected-profile";

const CUSTOMER_ENTITY: EntityInfo = {
  name: "customer",
  title: "Customer",
  href: `${PROFILE_URL}/customers`,
  collectionHref: "https://api.example.com/customers",
};

const STORAGE_KEY = "cg.api.example.com.selectedProfile";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useSelectedProfile — with 1 profile", () => {
  it("returns the single profile as selectedProfile", () => {
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.selectedProfile).toEqual(INVOICE_ENTITY);
  });

  it("returns profiles list with one entry", () => {
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.profiles).toHaveLength(1);
  });
});

describe("useSelectedProfile — with 2+ profiles", () => {
  it("defaults to the first profile when no localStorage value is set", () => {
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY, CUSTOMER_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.selectedProfile).toEqual(INVOICE_ENTITY);
  });

  it("restores the saved profile from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "customer");
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY, CUSTOMER_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.selectedProfile).toEqual(CUSTOMER_ENTITY);
  });

  it("falls back to first profile when localStorage name is stale (entity no longer exists)", () => {
    localStorage.setItem(STORAGE_KEY, "deleted-entity");
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY, CUSTOMER_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.selectedProfile).toEqual(INVOICE_ENTITY);
  });
});

describe("useSelectedProfile — setSelectedProfile", () => {
  it("updates selectedProfile immediately after calling setSelectedProfile", () => {
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY, CUSTOMER_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => result.current.setSelectedProfile(CUSTOMER_ENTITY));

    expect(result.current.selectedProfile).toEqual(CUSTOMER_ENTITY);
  });

  it("persists the selected profile name to localStorage", () => {
    const queryClient = makeQueryClient();
    seedProfile(queryClient, [INVOICE_ENTITY, CUSTOMER_ENTITY]);
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => result.current.setSelectedProfile(CUSTOMER_ENTITY));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("customer");
  });
});

describe("useSelectedProfile — loading states", () => {
  it("reports isPending true and returns empty profiles while profile data is loading", () => {
    const queryClient = makeQueryClient();
    // No seeded data — query is still pending
    const { result } = renderHook(() => useSelectedProfile(), {
      wrapper: makeWrapper(queryClient),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.profiles).toHaveLength(0);
    expect(result.current.selectedProfile).toBeNull();
  });
});
