import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useRecentActivity } from "./use-recent-activity";

const SCHEMA_URL = `${BASE}/profile/invoices`;
const COLLECTION_URL = `${BASE}/invoices`;

const schemaWithAudit = {
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
        // Real API sends type:"object" with sub-attributes — the hook detects
        // the combination of created_by + created_date to reclassify as "audit_metadata".
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
            {
              name: "last_modified_by",
              title: "Modified By",
              type: "string",
              _embedded: {
                "blueprint:constraint": [],
                "blueprint:search-param": [],
                "blueprint:attribute": [],
              },
              _links: {},
            },
            {
              name: "last_modified_date",
              title: "Modified Date",
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
                prompt: "Newest first",
              },
            ],
          },
        },
      ],
    },
    "create-form": { method: "POST", target: COLLECTION_URL, properties: [] },
  },
};

const listWithAudit = {
  _links: { self: { href: COLLECTION_URL } },
  _embedded: {
    item: [
      {
        id: "inv-1",
        number: "INV-001",
        audit_metadata: {
          created_by: "alice",
          created_date: "2024-01-01T10:00:00Z",
          last_modified_by: "bob",
          last_modified_date: "2024-01-02T12:00:00Z",
        },
        _links: { self: { href: `${COLLECTION_URL}/inv-1` } },
      },
      {
        id: "inv-2",
        number: "INV-002",
        audit_metadata: {
          created_by: "alice",
          created_date: "2024-01-03T10:00:00Z",
          last_modified_by: "alice",
          last_modified_date: "2024-01-03T10:00:00Z",
        },
        _links: { self: { href: `${COLLECTION_URL}/inv-2` } },
      },
    ],
  },
};

describe("useRecentActivity", () => {
  it("returns empty activities when profile has no audit entities", () => {
    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper() });
    expect(result.current.activities).toEqual([]);
    expect(result.current.hasAuditEntities).toBe(false);
  });

  it("returns recent activity items with action and modifiedDate when audit schema is present", async () => {
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaWithAudit)),
      http.get(COLLECTION_URL, () => HttpResponse.json(listWithAudit)),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    expect(result.current.hasAuditEntities).toBe(true);

    const modified = result.current.activities.find((a) => a.itemId === "inv-1");
    expect(modified).toBeDefined();
    expect(modified?.action).toBe("modified");
    expect(modified?.modifiedBy).toBe("bob");

    const created = result.current.activities.find((a) => a.itemId === "inv-2");
    expect(created?.action).toBe("created");

    // Activities sorted newest first — use numeric date comparison, not string >=
    expect(new Date(result.current.activities[0].modifiedDate).getTime()).toBeGreaterThanOrEqual(
      new Date(result.current.activities[1].modifiedDate).getTime(),
    );
  });

  it("populates details from displayable scalar attributes, excluding audit/content types", async () => {
    // Schema includes a displayable scalar ("amount") so buildDetails and isDisplayableScalar are exercised.
    const schemaWithDetails = {
      ...schemaWithAudit,
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
          // audit_metadata excluded from details by the type check (line 110)
          schemaWithAudit._embedded["blueprint:attribute"][1],
        ],
        "blueprint:relation": [],
      },
    };

    const listWithAmount = {
      _links: { self: { href: COLLECTION_URL } },
      _embedded: {
        item: [
          {
            id: "inv-3",
            number: "INV-003",
            amount: 999,
            audit_metadata: {
              created_by: "carol",
              created_date: "2024-02-01T10:00:00Z",
              last_modified_by: "carol",
              last_modified_date: "2024-02-01T10:00:00Z",
            },
            _links: { self: { href: `${COLLECTION_URL}/inv-3` } },
          },
        ],
      },
    };

    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaWithDetails)),
      http.get(COLLECTION_URL, () => HttpResponse.json(listWithAmount)),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    const item = result.current.activities.find((a) => a.itemId === "inv-3");
    expect(item).toBeDefined();
    // "amount" is a displayable scalar; its detail should appear (buildDetails ran)
    expect(item!.details.some((d) => d.label === "Amount")).toBe(true);
    expect(item!.details.find((d) => d.label === "Amount")?.value).toBe("999");
  });

  it("falls back to created-date/created-by when the audit roles have no modified-* entries", async () => {
    // Constraint-driven schema whose audit object only carries created-by and
    // created-date roles (no modified-*).  Activity must use the created date
    // as modifiedDate, report action "created", and attribute the change to
    // the created-by value.  Also: no _sort options → no sort param sent, and
    // items with no audit data are skipped.
    const schemaCreatedOnly = {
      ...schemaWithAudit,
      _embedded: {
        "blueprint:attribute": [
          schemaWithAudit._embedded["blueprint:attribute"][0],
          {
            name: "meta",
            title: "Meta",
            type: "object",
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [
                {
                  name: "creator",
                  title: "Creator",
                  type: "string",
                  _embedded: {
                    "blueprint:constraint": [{ type: "created-by" }],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "creation_time",
                  title: "Creation time",
                  type: "datetime",
                  _embedded: {
                    "blueprint:constraint": [{ type: "created-date" }],
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
        ...schemaWithAudit._templates,
        search: { method: "GET", target: COLLECTION_URL, properties: [] },
      },
    };

    const listCreatedOnly = {
      _links: { self: { href: COLLECTION_URL } },
      _embedded: {
        item: [
          {
            id: "inv-5",
            // no "number" value — displayName must fall back to the item id
            meta: { creator: "dave", creation_time: "2024-04-01T09:00:00Z" },
            _links: { self: { href: `${COLLECTION_URL}/inv-5` } },
          },
          {
            id: "inv-6",
            number: "INV-006",
            // No audit data at all — must be skipped (no modifiedDate)
            _links: { self: { href: `${COLLECTION_URL}/inv-6` } },
          },
        ],
      },
    };

    let requestedSort: string | null = "unset";
    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaCreatedOnly)),
      http.get(COLLECTION_URL, ({ request }) => {
        requestedSort = new URL(request.url).searchParams.get("_sort");
        return HttpResponse.json(listCreatedOnly);
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    // No sortable fields → no _sort param sent
    expect(requestedSort).toBeNull();

    // Item without audit data is skipped entirely
    expect(result.current.activities).toHaveLength(1);

    const item = result.current.activities[0];
    expect(item.itemId).toBe("inv-5");
    // created-date doubles as modifiedDate when no modified-date role exists
    expect(item.modifiedDate).toBe("2024-04-01T09:00:00Z");
    expect(item.action).toBe("created");
    // modifiedBy falls back to the created-by value (read via the custom name)
    expect(item.modifiedBy).toBe("dave");
    // No name value on the item → displayName falls back to the id
    expect(item.displayName).toBe("inv-5");
  });

  it("handles audit roles with only modified-* entries and entities without name attributes", async () => {
    // Constraint-driven schema with ONLY modified-by/modified-date roles (no
    // created-*) and no text-like attributes.  modifiedDate must come from the
    // modified-date field, action defaults to "created" (no created-date to
    // compare), modifiedBy comes from the modified-by role, and displayName
    // falls back to the item id (no name attribute in the schema).
    const schemaModifiedOnly = {
      ...schemaWithAudit,
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
          {
            name: "meta",
            title: "Meta",
            type: "object",
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [
                {
                  name: "editor",
                  title: "Editor",
                  type: "string",
                  _embedded: {
                    "blueprint:constraint": [{ type: "modified-by" }],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "edited_at",
                  title: "Edited at",
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
    };

    const listModifiedOnly = {
      _links: { self: { href: COLLECTION_URL } },
      _embedded: {
        item: [
          {
            id: "inv-8",
            amount: 7,
            meta: { editor: "erin", edited_at: "2024-05-01T08:00:00Z" },
            _links: { self: { href: `${COLLECTION_URL}/inv-8` } },
          },
        ],
      },
    };

    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaModifiedOnly)),
      http.get(COLLECTION_URL, () => HttpResponse.json(listModifiedOnly)),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    const item = result.current.activities[0];
    expect(item.itemId).toBe("inv-8");
    expect(item.modifiedDate).toBe("2024-05-01T08:00:00Z");
    // No created-date role → cannot distinguish, defaults to "created"
    expect(item.action).toBe("created");
    expect(item.modifiedBy).toBe("erin");
    // No text-like attribute in the schema → displayName falls back to the id
    expect(item.displayName).toBe("inv-8");
  });

  it("excludes entities without audit attributes from the activity feed", async () => {
    const PLAIN_SCHEMA_URL = `${BASE}/profile/notes`;
    const PLAIN_COLLECTION_URL = `${BASE}/notes`;

    const schemaPlain = {
      name: "note",
      _links: {
        self: { href: PLAIN_SCHEMA_URL },
        describes: [{ href: PLAIN_COLLECTION_URL, name: "collection" }],
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
            name: "body",
            title: "Body",
            type: "string",
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
        default: { method: "HEAD", properties: [] },
        search: { method: "GET", target: PLAIN_COLLECTION_URL, properties: [] },
        "create-form": { method: "POST", target: PLAIN_COLLECTION_URL, properties: [] },
      },
    };

    server.use(
      http.get(SCHEMA_URL, () => HttpResponse.json(schemaWithAudit)),
      http.get(PLAIN_SCHEMA_URL, () => HttpResponse.json(schemaPlain)),
      http.get(COLLECTION_URL, () => HttpResponse.json(listWithAudit)),
    );

    const qc = makeQueryClient();
    seedProfile(qc, [
      { name: "invoice", title: "Invoice", href: SCHEMA_URL, collectionHref: COLLECTION_URL },
      { name: "note", title: "Note", href: PLAIN_SCHEMA_URL, collectionHref: PLAIN_COLLECTION_URL },
    ]);

    const { result } = renderHook(() => useRecentActivity(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.activities.length).toBeGreaterThan(0), {
      timeout: 5000,
    });

    // Only the audited entity contributes activity; the plain entity is excluded
    // (its collection is never even queried — no handler for it is needed).
    expect(result.current.hasAuditEntities).toBe(true);
    expect(result.current.activities.every((a) => a.entityName === "invoice")).toBe(true);
  });
});
