/**
 * Tests for useProfileEntities, useProfileEntity, and ensureProfileEntity.
 *
 * Covers:
 * - useProfileEntities: fetches profile root + all entity profiles in parallel
 * - useProfileEntity: finds entity by name, finds entity by href, disabled when no match
 * - ensureProfileEntity: the non-hook, loader-safe equivalent of useProfileEntity
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test-setup";
import { createApiClient } from "../../api/client";
import { BASE, PROFILE_URL, makeQueryClient, makeWrapper, noopSupplier } from "../test-utils";
import {
  ensureProfileEntity,
  useLoadedProfileEntities,
  useProfileEntities,
  useProfileEntity,
} from "./use-profile-entity";

/** A promise the test controls the settlement of, to hold one handler open while others resolve. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_PROFILE_URL = `${BASE}/profile/customers`;
const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;

const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" },
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const customerProfileBody = {
  name: "customer",
  title: "Customer",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: null,
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: CUSTOMER_PROFILE_URL, title: "Customer" },
    describes: [
      { href: `${BASE}/customers`, name: "collection" },
      { href: `${BASE}/customers/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: `${BASE}/customers`, properties: [] },
  },
};

const invoiceProfileBody = {
  name: "invoice",
  title: "Invoice",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: null,
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: INVOICE_PROFILE_URL, title: "Invoice" },
    describes: [
      { href: `${BASE}/invoices`, name: "collection" },
      { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: `${BASE}/invoices`, properties: [] },
  },
};

function setupHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
  );
}

// ---------------------------------------------------------------------------
// useProfileEntities
// ---------------------------------------------------------------------------

describe("useProfileEntities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches all entity profiles from the profile root", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntities(), { wrapper });

    await waitFor(() => expect(result.current.filter((r) => r.isSuccess).length).toBe(2));

    const names = result.current.map((r) => r.data?.name).filter(Boolean);
    expect(names).toContain("customer");
    expect(names).toContain("invoice");
  });

  it("returns results array with same length as entity count", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntities(), { wrapper });

    await waitFor(() => expect(result.current.filter((r) => r.isSuccess).length).toBe(2));

    expect(result.current).toHaveLength(2);
  });

  it("each result has isLoading/isError/data fields", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntities(), { wrapper });

    await waitFor(() => expect(result.current.some((r) => r.isSuccess)).toBe(true));

    for (const r of result.current) {
      expect(typeof r.isLoading).toBe("boolean");
      expect(typeof r.isError).toBe("boolean");
    }
  });

  it("isError is true when profile fetch fails (profileByLinkQuery has retry:3)", async () => {
    vi.useFakeTimers();

    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(CUSTOMER_PROFILE_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntities(), { wrapper });

    await vi.runAllTimersAsync();

    expect(result.current.some((r) => r.isError)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useLoadedProfileEntities
// ---------------------------------------------------------------------------

describe("useLoadedProfileEntities", () => {
  it("keeps isLoading true while one profile has settled but another is still pending", async () => {
    const invoiceGate = deferred<void>();

    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
      http.get(INVOICE_PROFILE_URL, async () => {
        await invoiceGate.promise;
        return HttpResponse.json(invoiceProfileBody);
      }),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useLoadedProfileEntities(), { wrapper });

    // The customer profile resolves, but the invoice profile is still held open —
    // isLoading must not flip false just because one of the two has settled.
    await waitFor(() =>
      expect(result.current.profiles.some((p) => p.name === "customer")).toBe(true),
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profiles.some((p) => p.name === "invoice")).toBe(false);

    invoiceGate.resolve();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profiles.map((p) => p.name).sort()).toEqual(["customer", "invoice"]);
  });

  it("keeps isLoading true while the profile root itself hasn't resolved yet", async () => {
    const rootGate = deferred<void>();

    server.use(
      http.get(PROFILE_URL, async () => {
        await rootGate.promise;
        return HttpResponse.json(profileRootBody);
      }),
      http.get(CUSTOMER_PROFILE_URL, () => HttpResponse.json(customerProfileBody)),
      http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useLoadedProfileEntities(), { wrapper });

    // No entity links are known yet, so `profiles` is empty — that must read
    // as "still loading", not "there is nothing to load".
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profiles).toEqual([]);

    rootGate.resolve();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profiles.map((p) => p.name).sort()).toEqual(["customer", "invoice"]);
  });
});

// ---------------------------------------------------------------------------
// useProfileEntity
// ---------------------------------------------------------------------------

describe("useProfileEntity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches a profile by name", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "customer" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe("customer");
  });

  it("fetches a profile by href", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ href: INVOICE_PROFILE_URL }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe("invoice");
  });

  it("settles to not-found (not stuck pending) when entity is not in the profile root", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "nonexistent" }), { wrapper });

    // Once the profile root resolves, the query must settle — not stay
    // pending forever — so callers can distinguish "still loading" from
    // "definitively not found".
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toBeFalsy();
    expect(result.current.isError).toBe(false);
  });

  it("settles to an error (not stuck pending) when the profile root itself fails to load", async () => {
    // profileRootQuery has no baked-in retry (per navigator-data/CLAUDE.md),
    // so it settles immediately using the test QueryClient's retry: false.
    server.use(http.get(PROFILE_URL, () => HttpResponse.json(null, { status: 500 })));
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "customer" }), { wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeFalsy();
  });

  it("returns profile title via data.title", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "customer" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.title).toBe("Customer");
  });

  it("isError is true on fetch error (profileByLinkQuery has retry:3)", async () => {
    vi.useFakeTimers();

    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
      http.get(CUSTOMER_PROFILE_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "customer" }), { wrapper });

    await vi.runAllTimersAsync();

    expect(result.current.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ensureProfileEntity — non-hook, loader-safe equivalent of useProfileEntity
// ---------------------------------------------------------------------------

describe("ensureProfileEntity", () => {
  it("resolves the matching profile by name", async () => {
    setupHandlers();
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    const profile = await ensureProfileEntity(queryClient, apiFetch, PROFILE_URL, {
      name: "customer",
    });

    expect(profile?.name).toBe("customer");
  });

  it("resolves the matching profile by href", async () => {
    setupHandlers();
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    const profile = await ensureProfileEntity(queryClient, apiFetch, PROFILE_URL, {
      href: INVOICE_PROFILE_URL,
    });

    expect(profile?.name).toBe("invoice");
  });

  it("resolves to null when no entity matches", async () => {
    setupHandlers();
    const queryClient = makeQueryClient();
    const apiFetch = createApiClient(noopSupplier);

    const profile = await ensureProfileEntity(queryClient, apiFetch, PROFILE_URL, {
      name: "nonexistent",
    });

    expect(profile).toBeNull();
  });
});
