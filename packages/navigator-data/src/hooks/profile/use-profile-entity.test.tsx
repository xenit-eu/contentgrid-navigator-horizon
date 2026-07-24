/**
 * Tests for useProfileEntities and useProfileEntity hooks.
 *
 * Covers:
 * - useProfileEntities: fetches profile root + all entity profiles in parallel
 * - useProfileEntity: finds entity by name, finds entity by href, disabled when no match
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test-setup";
import { BASE, PROFILE_URL, makeWrapper } from "../test-utils";
import { useProfileEntities, useProfileEntity } from "./use-profile-entity";

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
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: "",
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
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "id",
        title: "id",
        type: "string",
        description: "",
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

  it("query is disabled and returns no data when entity is not found in profile root", async () => {
    setupHandlers();
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProfileEntity({ name: "nonexistent" }), { wrapper });

    // Wait for profile root to load (profile root has retry:false in makeQueryClient)
    await new Promise((r) => setTimeout(r, 200));

    // Query should be disabled — no data and no error
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
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
