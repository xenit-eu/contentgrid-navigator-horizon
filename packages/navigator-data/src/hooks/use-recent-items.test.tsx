import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useRecentlyCreated } from "./use-recent-items";

const SCHEMA_URL = `${BASE}/profile/invoices`;
const COLLECTION_URL = `${BASE}/invoices`;

const schemaSimple = {
  name: "invoice",
  _links: {
    self: { href: SCHEMA_URL },
    describes: [{ href: COLLECTION_URL, name: "collection" }],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: {
    "blueprint:attribute": [
      {
        name: "number",
        title: "Number",
        type: "string",
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "audit_metadata",
        title: "Audit",
        type: "object",
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [
            {
              name: "created_by",
              title: "Created By",
              type: "string",
              _embedded: {
                "blueprint:constraint": [],
                "blueprint:search-param": [],
                "blueprint:attribute": [],
              },
              _links: {},
            },
            {
              name: "created_date",
              title: "Created Date",
              type: "datetime",
              _embedded: {
                "blueprint:constraint": [],
                "blueprint:search-param": [],
                "blueprint:attribute": [],
              },
              _links: {},
            },
          ],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        {
          name: "_sort",
          type: "text",
          options: {
            inline: [
              {
                value: "audit_metadata.last_modified_date,desc",
                property: "audit_metadata.last_modified_date",
                direction: "desc",
                prompt: "Newest",
              },
            ],
          },
        },
      ],
    },
    "create-form": { method: "POST", target: COLLECTION_URL, properties: [] },
  },
};

describe("useRecentlyCreated", () => {
  it("returns empty items when profile is not loaded yet", () => {
    const { result } = renderHook(() => useRecentlyCreated(), { wrapper: makeWrapper() });
    expect(result.current.items).toEqual([]);
    expect(result.current.hasEntities).toBe(false);
  });

  it("returns recently created items sorted newest-first with createdDate and displayName", async () => {
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaSimple)),
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "inv-1",
                number: "INV-001",
                audit_metadata: { created_by: "alice", created_date: "2024-02-01T10:00:00Z" },
                _links: { self: { href: `${COLLECTION_URL}/inv-1` } },
              },
              {
                id: "inv-2",
                number: "INV-002",
                audit_metadata: { created_by: "bob", created_date: "2024-01-01T10:00:00Z" },
                _links: { self: { href: `${COLLECTION_URL}/inv-2` } },
              },
              {
                id: "inv-3",
                number: "INV-003",
                // No audit data — should appear after dated items
                _links: { self: { href: `${COLLECTION_URL}/inv-3` } },
              },
            ],
          },
        }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentlyCreated(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0), { timeout: 5000 });

    expect(result.current.hasEntities).toBe(true);

    // Dated items come first, sorted newest-first
    expect(result.current.items[0].itemId).toBe("inv-1");
    expect(result.current.items[0].createdDate).toBe("2024-02-01T10:00:00Z");
    expect(result.current.items[1].itemId).toBe("inv-2");

    // Item without a date appears last
    expect(result.current.items[2].itemId).toBe("inv-3");
    expect(result.current.items[2].createdDate).toBeUndefined();
  });

  it("sorts by the constraint-discovered modified-date field and reads custom audit names", async () => {
    // Audit sub-attributes use NON-default names; roles come from system-managed
    // constraints.  The hook must sort by the discovered modified-date field and
    // read created-date/created-by through the discovered names.
    const schemaCustomAudit = {
      ...schemaSimple,
      _embedded: {
        "blueprint:attribute": [
          schemaSimple._embedded["blueprint:attribute"][0],
          {
            name: "tracking",
            title: "Tracking",
            type: "object",
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [
                {
                  name: "author",
                  title: "Author",
                  type: "string",
                  _embedded: {
                    "blueprint:constraint": [{ type: "created-by" }],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "created_at",
                  title: "Created at",
                  type: "datetime",
                  _embedded: {
                    "blueprint:constraint": [{ type: "created-date" }],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "updated_at",
                  title: "Updated at",
                  type: "datetime",
                  _embedded: {
                    "blueprint:constraint": [{ type: "modified-date" }],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        ...schemaSimple._templates,
        search: {
          method: "GET",
          target: COLLECTION_URL,
          properties: [
            {
              name: "_sort",
              type: "text",
              options: {
                inline: [
                  {
                    value: "tracking.updated_at,desc",
                    property: "tracking.updated_at",
                    direction: "desc",
                    prompt: "Newest",
                  },
                ],
              },
            },
          ],
        },
      },
    };

    let requestedSort: string | null = null;
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaCustomAudit)),
      http.get(COLLECTION_URL, ({ request }) => {
        requestedSort = new URL(request.url).searchParams.get("_sort");
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "inv-9",
                number: "INV-009",
                tracking: { author: "carol", created_at: "2024-03-01T10:00:00Z" },
                _links: { self: { href: `${COLLECTION_URL}/inv-9` } },
              },
            ],
          },
        });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentlyCreated(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0), { timeout: 5000 });

    // Sorted by the discovered modified-date sortable field, not a hardcoded name
    expect(requestedSort).toBe("tracking.updated_at,desc");
    // created-date / created-by read through the discovered custom names
    expect(result.current.items[0].createdDate).toBe("2024-03-01T10:00:00Z");
    expect(result.current.items[0].createdBy).toBe("carol");
  });

  it("degrades gracefully for entities without audit attributes or sort options", async () => {
    // No audit attribute, no _sort options, and no name value on the item:
    // items must still be returned with no createdDate/createdBy and the
    // displayName falling back to the item id.
    const schemaNoAudit = {
      ...schemaSimple,
      _embedded: {
        "blueprint:attribute": [
          {
            name: "amount",
            title: "Amount",
            type: "long",
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
      _templates: {
        ...schemaSimple._templates,
        search: { method: "GET", target: COLLECTION_URL, properties: [] },
      },
    };

    let requestedSort: string | null = "unset";
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaNoAudit)),
      http.get(COLLECTION_URL, ({ request }) => {
        requestedSort = new URL(request.url).searchParams.get("_sort");
        return HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "inv-7",
                amount: 42,
                _links: { self: { href: `${COLLECTION_URL}/inv-7` } },
              },
            ],
          },
        });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentlyCreated(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0), { timeout: 5000 });

    // No sortable fields → no _sort param sent
    expect(requestedSort).toBeNull();
    expect(result.current.hasEntities).toBe(true);
    expect(result.current.items[0].itemId).toBe("inv-7");
    expect(result.current.items[0].createdDate).toBeUndefined();
    expect(result.current.items[0].createdBy).toBeUndefined();
    // No name attribute value → displayName falls back to the item id
    expect(result.current.items[0].displayName).toBe("inv-7");
  });
});
