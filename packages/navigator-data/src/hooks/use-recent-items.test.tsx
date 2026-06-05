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
});
