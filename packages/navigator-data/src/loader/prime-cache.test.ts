import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { server } from "../../test-setup";
import ProfileEntity from "../accessors/entity-profile";
import { createApiClient } from "../api/client";
import { BASE, PROFILE_URL, makeQueryClient, noopSupplier } from "../hooks/test-utils";
import type { ProfileEntityShape } from "../shapes";
import {
  ensureEntityItem,
  ensureEntityItemCollection,
  ensureProfileEntities,
  ensureProfileEntityByName,
} from "./prime-cache";

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_COLLECTION_URL = `${BASE}/invoices`;

const invoiceProfileBody = {
  name: "invoice",
  title: "Invoice",
  description: "",
  _embedded: {
    "blueprint:attribute": [
      {
        name: "number",
        title: "Number",
        type: "string",
        description: "",
        readOnly: false,
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
      { href: INVOICE_COLLECTION_URL, name: "collection" },
      { href: `${INVOICE_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: INVOICE_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: INVOICE_COLLECTION_URL,
      properties: [{ name: "number~prefix", type: "text" }],
    },
  },
};

function registerProfileRootHandler() {
  server.use(
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          curies: [
            {
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              name: "cg",
              templated: true,
            },
          ],
          "cg:entity": [{ href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" }],
        },
      }),
    ),
  );
}

function registerInvoiceProfileHandler() {
  server.use(http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)));
}

function registerInvoiceCollectionHandler(items: Record<string, unknown>[] = []) {
  server.use(
    http.get(INVOICE_COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: {
          item: items.map((item, i) => ({
            ...item,
            _links: { self: { href: `${INVOICE_COLLECTION_URL}/${i}` } },
          })),
        },
        _links: { self: { href: INVOICE_COLLECTION_URL } },
        page: { size: items.length, total_items_exact: items.length },
      }),
    ),
  );
}

function makeApiFetch() {
  return createApiClient(noopSupplier);
}

function makeInvoiceProfileEntity(): ProfileEntity {
  const hal = new HalObject(invoiceProfileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

describe("ensureProfileEntities", () => {
  it("primes the cache with the profile root and every linked entity profile", async () => {
    registerProfileRootHandler();
    registerInvoiceProfileHandler();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const profiles = await ensureProfileEntities(queryClient, apiFetch, PROFILE_URL);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("invoice");
  });

  it("dedupes concurrent calls to a single network round trip per query key", async () => {
    let requestCount = 0;
    server.use(
      http.get(PROFILE_URL, () => {
        requestCount++;
        return HttpResponse.json({
          _links: {
            self: { href: PROFILE_URL },
            curies: [
              {
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                name: "cg",
                templated: true,
              },
            ],
            "cg:entity": [{ href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" }],
          },
        });
      }),
    );
    registerInvoiceProfileHandler();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    await Promise.all([
      ensureProfileEntities(queryClient, apiFetch, PROFILE_URL),
      ensureProfileEntities(queryClient, apiFetch, PROFILE_URL),
    ]);

    expect(requestCount).toBe(1);
  });
});

describe("ensureProfileEntityByName", () => {
  it("returns the profile matching the given name", async () => {
    registerProfileRootHandler();
    registerInvoiceProfileHandler();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const profile = await ensureProfileEntityByName(queryClient, apiFetch, PROFILE_URL, "invoice");

    expect(profile?.name).toBe("invoice");
  });

  it("returns undefined when no profile matches the given name", async () => {
    registerProfileRootHandler();
    registerInvoiceProfileHandler();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const profile = await ensureProfileEntityByName(
      queryClient,
      apiFetch,
      PROFILE_URL,
      "does-not-exist",
    );

    expect(profile).toBeUndefined();
  });
});

describe("ensureEntityItemCollection", () => {
  it("primes the cache with the default (empty-search) collection page", async () => {
    registerInvoiceCollectionHandler([{ id: "inv-001", number: "INV-001" }]);
    const profileEntity = makeInvoiceProfileEntity();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const collection = await ensureEntityItemCollection(queryClient, apiFetch, {
      profileEntity,
    });

    expect(collection?.items).toHaveLength(1);
  });

  it("merges a cursor token onto the request, matching useEntityItemCollection's cursor param", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(INVOICE_COLLECTION_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          _embedded: { item: [] },
          _links: { self: { href: INVOICE_COLLECTION_URL } },
          page: { size: 0, total_items_exact: 0 },
        });
      }),
    );
    const profileEntity = makeInvoiceProfileEntity();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    await ensureEntityItemCollection(queryClient, apiFetch, {
      profileEntity,
      cursor: "abc123",
    });

    expect(capturedUrl?.searchParams.get("_cursor")).toBe("abc123");
  });

  it("returns undefined when the query would be disabled (searchValues undefined)", async () => {
    const profileEntity = makeInvoiceProfileEntity();
    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const collection = await ensureEntityItemCollection(queryClient, apiFetch, {
      profileEntity,
      searchValues: undefined,
    });

    expect(collection).toBeUndefined();
  });
});

describe("ensureEntityItem", () => {
  it("primes the cache with the entity item at the profile's expanded item URL", async () => {
    server.use(
      http.get(`${INVOICE_COLLECTION_URL}/inv-001`, () =>
        HttpResponse.json({
          id: "inv-001",
          number: "INV-001",
          _links: { self: { href: `${INVOICE_COLLECTION_URL}/inv-001` } },
        }),
      ),
    );
    const profileEntity = makeInvoiceProfileEntity();

    const queryClient = makeQueryClient();
    const apiFetch = makeApiFetch();

    const item = await ensureEntityItem(queryClient, apiFetch, profileEntity, "inv-001");

    expect(item.id).toBe("inv-001");
  });
});
