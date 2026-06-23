import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, PROFILE_URL, makeWrapper } from "./test-utils";
import { useSelectedEntity } from "./use-selected-entity";

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const STORAGE_KEY = "cg.api.example.com.selectedEntity";

const profileRootWith1Entity = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [{ href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" }],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const profileRootWith2Entities = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

function makeEntityProfileBody(name: string, collectionPath: string) {
  return {
    name,
    _links: {
      self: { href: `${BASE}/profile/${collectionPath}` },
      describes: [
        { href: `${BASE}/${collectionPath}`, name: "collection" },
        { href: `${BASE}/${collectionPath}/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _templates: {},
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useSelectedEntity — with 1 entity", () => {
  beforeEach(() => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootWith1Entity)),
      http.get(INVOICE_PROFILE_URL, () =>
        HttpResponse.json(makeEntityProfileBody("invoice", "invoices")),
      ),
    );
  });

  it("returns the single entity as selectedEntity", async () => {
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(1));
    expect(result.current.selectedEntity?.name).toBe("invoice");
  });

  it("returns entities list with one entry", async () => {
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(1));
  });
});

describe("useSelectedEntity — with 2+ entities", () => {
  beforeEach(() => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootWith2Entities)),
      http.get(INVOICE_PROFILE_URL, () =>
        HttpResponse.json(makeEntityProfileBody("invoice", "invoices")),
      ),
      http.get(CUSTOMER_PROFILE_URL, () =>
        HttpResponse.json(makeEntityProfileBody("customer", "customers")),
      ),
    );
  });

  it("defaults to the first entity when no localStorage value is set", async () => {
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(2));
    expect(result.current.selectedEntity?.name).toBe("invoice");
  });

  it("restores the saved entity from localStorage on mount", async () => {
    localStorage.setItem(STORAGE_KEY, "customer");
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(2));
    expect(result.current.selectedEntity?.name).toBe("customer");
  });

  it("falls back to first entity when localStorage name is stale (entity no longer exists)", async () => {
    localStorage.setItem(STORAGE_KEY, "deleted-entity");
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(2));
    expect(result.current.selectedEntity?.name).toBe("invoice");
  });
});

describe("useSelectedEntity — setSelectedEntity", () => {
  beforeEach(() => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootWith2Entities)),
      http.get(INVOICE_PROFILE_URL, () =>
        HttpResponse.json(makeEntityProfileBody("invoice", "invoices")),
      ),
      http.get(CUSTOMER_PROFILE_URL, () =>
        HttpResponse.json(makeEntityProfileBody("customer", "customers")),
      ),
    );
  });

  it("updates selectedEntity immediately after calling setSelectedEntity", async () => {
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(2));

    act(() => {
      result.current.setSelectedEntity(result.current.entities.find((e) => e.name === "customer")!);
    });

    expect(result.current.selectedEntity?.name).toBe("customer");
  });

  it("persists the selected entity name to localStorage", async () => {
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.entities).toHaveLength(2));

    act(() => {
      result.current.setSelectedEntity(result.current.entities.find((e) => e.name === "customer")!);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("customer");
  });
});

describe("useSelectedEntity — loading states", () => {
  it("reports isPending true and returns empty entities while profile data is loading", () => {
    server.use(http.get(PROFILE_URL, () => new Promise<never>(() => {})));
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    expect(result.current.isPending).toBe(true);
    expect(result.current.entities).toHaveLength(0);
    expect(result.current.selectedEntity).toBeNull();
  });
});

describe("useSelectedEntity — error states", () => {
  it("reports isError true and returns empty entities when the profile root request fails", async () => {
    server.use(http.get(PROFILE_URL, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useSelectedEntity(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.entities).toHaveLength(0);
    expect(result.current.selectedEntity).toBeNull();
    expect(result.current.isPending).toBe(false);
  });
});
