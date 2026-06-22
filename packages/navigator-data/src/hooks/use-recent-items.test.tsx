/**
 * Tests for useRecentlyCreated and useRecentlyModified hooks.
 *
 * Covers:
 * - Returns disabled query when entity has no created-at / modified-at attribute
 * - Returns disabled query when search template is missing
 * - Returns disabled query when no matching desc sort option exists
 * - Fetches successfully when audit attribute + sort option are available
 *
 * Note: useRecentlyCreated/Modified call useEntityItemCollection which calls
 * EntityItemCollection.fetchByUrlQuery (retry:3). Success tests use MSW to serve the
 * collection. The MSW handler is registered on the base collection URL and MSW v2
 * matches by pathname so query-param variants are also matched.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { server } from "../../test-setup";
import ProfileEntity from "../accessors/entity-profile";
import type { ProfileEntityShape } from "../shapes";
import { BASE, makeWrapper } from "./test-utils";
import { useRecentlyCreated, useRecentlyModified } from "./use-recent-items";

// ---------------------------------------------------------------------------
// Profile fixtures
// ---------------------------------------------------------------------------

const ENTITY_PROFILE_URL = `${BASE}/profile/logs`;
const ENTITY_COLLECTION_URL = `${BASE}/logs`;

/**
 * Profile with both created-date and modified-date audit attributes,
 * plus a search template with _sort options for both directions.
 */
const logProfileWithAudit = {
  name: "log",
  title: "Log",
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
      {
        name: "title",
        title: "Title",
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
      // Audit: created-date
      {
        name: "created_at",
        title: "Created at",
        type: "datetime",
        description: "",
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [{ type: "created-date" }],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      // Audit: modified-date
      {
        name: "modified_at",
        title: "Modified at",
        type: "datetime",
        description: "",
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [{ type: "modified-date" }],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: ENTITY_PROFILE_URL, title: "Log" },
    describes: [
      { href: ENTITY_COLLECTION_URL, name: "collection" },
      { href: `${ENTITY_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: ENTITY_COLLECTION_URL,
      properties: [
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            promptField: "prompt",
            valueField: "value",
            inline: [
              {
                property: "created_at",
                direction: "asc",
                prompt: "Created oldest first",
                value: "created_at,asc",
              },
              {
                property: "created_at",
                direction: "desc",
                prompt: "Created newest first",
                value: "created_at,desc",
              },
              {
                property: "modified_at",
                direction: "asc",
                prompt: "Modified oldest first",
                value: "modified_at,asc",
              },
              {
                property: "modified_at",
                direction: "desc",
                prompt: "Modified newest first",
                value: "modified_at,desc",
              },
            ],
          },
        },
      ],
    },
  },
};

/**
 * Profile WITHOUT audit attributes — hooks should produce disabled queries.
 */
const noAuditProfile = {
  name: "item",
  title: "Item",
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
      {
        name: "label",
        title: "Label",
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
    self: { href: ENTITY_PROFILE_URL, title: "Item" },
    describes: [
      { href: ENTITY_COLLECTION_URL, name: "collection" },
      { href: `${ENTITY_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
    default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: ENTITY_COLLECTION_URL,
      properties: [{ name: "label", type: "text" }],
    },
  },
};

/**
 * Profile WITH audit attributes but WITHOUT _sort in search template.
 */
const auditNoSortProfile = {
  ...logProfileWithAudit,
  _templates: {
    default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: ENTITY_COLLECTION_URL,
      // No _sort property
      properties: [{ name: "title", type: "text" }],
    },
  },
};

/**
 * Profile with audit attributes and sort but only ASC options (no DESC for created_at).
 */
const auditAscOnlySortProfile = {
  ...logProfileWithAudit,
  _templates: {
    default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: ENTITY_COLLECTION_URL,
      properties: [
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            promptField: "prompt",
            valueField: "value",
            inline: [
              {
                property: "created_at",
                direction: "asc",
                prompt: "Created oldest first",
                value: "created_at,asc",
              },
            ],
          },
        },
      ],
    },
  },
};

/**
 * Collection response fixture — one item.
 */
const logCollectionBody = {
  _embedded: {
    item: [
      {
        id: "log-001",
        title: "Recent entry",
        _links: { self: { href: `${ENTITY_COLLECTION_URL}/log-001` } },
      },
    ],
  },
  _links: { self: { href: ENTITY_COLLECTION_URL } },
  page: { size: 5, total_items_exact: 1 },
};

function makeProfile(json: Record<string, unknown>): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  return new ProfileEntity(
    {
      href: ENTITY_PROFILE_URL,
      name: json["name"] as string,
      title: json["title"] as string,
    } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

// ---------------------------------------------------------------------------
// useRecentlyCreated
// ---------------------------------------------------------------------------

describe("useRecentlyCreated", () => {
  it("fetches the collection sorted by created-date desc when audit attr + sort exist", async () => {
    server.use(http.get(ENTITY_COLLECTION_URL, () => HttpResponse.json(logCollectionBody)));
    const profileEntity = makeProfile(logProfileWithAudit);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyCreated(profileEntity), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
  });

  it("query is disabled (isPending, no fetch) when entity has no created-at audit attribute", async () => {
    const profileEntity = makeProfile(noAuditProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyCreated(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when search template has no _sort property", async () => {
    const profileEntity = makeProfile(auditNoSortProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyCreated(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when no desc sort option for created-date", async () => {
    const profileEntity = makeProfile(auditAscOnlySortProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyCreated(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when profile has no search template at all", async () => {
    const noSearchProfile = {
      ...logProfileWithAudit,
      _templates: {
        default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
      },
    };
    const profileEntity = makeProfile(noSearchProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyCreated(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useRecentlyModified
// ---------------------------------------------------------------------------

describe("useRecentlyModified", () => {
  it("fetches the collection sorted by modified-date desc when audit attr + sort exist", async () => {
    server.use(http.get(ENTITY_COLLECTION_URL, () => HttpResponse.json(logCollectionBody)));
    const profileEntity = makeProfile(logProfileWithAudit);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyModified(profileEntity), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
  });

  it("query is disabled when entity has no modified-at audit attribute", async () => {
    const profileEntity = makeProfile(noAuditProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyModified(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when search template has no _sort property", async () => {
    const profileEntity = makeProfile(auditNoSortProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyModified(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when no desc sort option for modified-date", async () => {
    // ASC-only profile has no desc for modified_at either
    const profileEntity = makeProfile(auditAscOnlySortProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyModified(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("query is disabled when profile has no search template at all", async () => {
    const noSearchProfile = {
      ...logProfileWithAudit,
      _templates: {
        default: { method: "HEAD", target: ENTITY_COLLECTION_URL, properties: [] },
      },
    };
    const profileEntity = makeProfile(noSearchProfile);
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useRecentlyModified(profileEntity), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });
});
