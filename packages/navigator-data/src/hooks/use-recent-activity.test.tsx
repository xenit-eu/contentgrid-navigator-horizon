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
});
