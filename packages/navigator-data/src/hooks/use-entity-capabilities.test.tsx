import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import {
  BASE,
  INVOICE_ENTITY,
  makeQueryClient,
  makeWrapper,
  mockProfileResponse,
  seedProfile,
} from "./test-utils";
import { useEntityCapabilities } from "./use-entity-capabilities";

const ITEM_URL = `${BASE}/invoices/inv-1`;
const PROFILE_HREF = INVOICE_ENTITY.href;

/** Minimal invoice profile with a create-form template. */
const profileWithCreate = {
  name: "invoice",
  title: "Invoice",
  _links: {
    self: { href: PROFILE_HREF },
    describes: [{ href: `${BASE}/invoices`, name: "collection" }],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
  _templates: {
    "create-form": { method: "POST", properties: [] },
    search: { method: "GET", properties: [] },
  },
};

/** Same profile but WITHOUT create-form (ABAC denied). */
const profileWithoutCreate = {
  ...profileWithCreate,
  _templates: {
    search: { method: "GET", properties: [] },
  },
};

/** Item body with default + delete templates (full access). */
const itemWithTemplates = {
  id: "inv-1",
  number: "INV-001",
  _links: { self: { href: ITEM_URL } },
  _templates: {
    default: { method: "PATCH", contentType: "application/json", properties: [] },
    delete: { method: "DELETE", properties: [] },
    "set-supplier": { method: "PUT", contentType: "text/uri-list", properties: [] },
  },
};

/** Item body with NO item-level templates (ABAC read-only). */
const itemWithoutTemplates = {
  id: "inv-1",
  number: "INV-001",
  _links: { self: { href: ITEM_URL } },
};

describe("useEntityCapabilities", () => {
  describe("canCreate (from entity profile)", () => {
    it("is true when create-form template is present in the profile", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.canCreate).toBeDefined());
      expect(result.current.canCreate).toBe(true);
    });

    it("is false when create-form template is absent (ABAC denied)", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithoutCreate)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        // wait for schema data to arrive
        expect(result.current.canCreate).toBe(false);
      });
    });

    it("defaults to true while schema is loading (permissive fallback)", () => {
      // Don't register any handlers — schema will stay pending.
      const qc = makeQueryClient();
      seedProfile(qc);

      const { result } = renderHook(() => useEntityCapabilities("invoice"), {
        wrapper: makeWrapper(qc),
      });

      // Still loading — fallback is true.
      expect(result.current.canCreate).toBe(true);
    });
  });

  describe("collection-level context (no itemId)", () => {
    it("returns undefined for item-level caps when no itemId", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.canCreate).toBeDefined());
      expect(result.current.canEdit).toBeUndefined();
      expect(result.current.canDelete).toBeUndefined();
      expect(result.current.canLinkRelation("supplier")).toBeUndefined();
    });
  });

  describe("canEdit + canDelete (from item templates)", () => {
    it("are true when default + delete templates are present", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
        http.get(ITEM_URL, () => HttpResponse.json(itemWithTemplates)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice", "inv-1"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.canEdit).toBeDefined());
      expect(result.current.canEdit).toBe(true);
      expect(result.current.canDelete).toBe(true);
    });

    it("are false when default + delete templates are absent (ABAC read-only)", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
        http.get(ITEM_URL, () => HttpResponse.json(itemWithoutTemplates)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice", "inv-1"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(result.current.canEdit).toBe(false);
      });
      expect(result.current.canDelete).toBe(false);
    });

    it("defaults to true while item is loading (permissive fallback)", () => {
      const qc = makeQueryClient();
      seedProfile(qc);

      const { result } = renderHook(() => useEntityCapabilities("invoice", "inv-1"), {
        wrapper: makeWrapper(qc),
      });

      // Item is still loading — fallback is true.
      expect(result.current.canEdit).toBe(true);
      expect(result.current.canDelete).toBe(true);
    });
  });

  describe("canLinkRelation", () => {
    it("is true when set-<rel> template is present", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
        http.get(ITEM_URL, () => HttpResponse.json(itemWithTemplates)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice", "inv-1"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.canEdit).toBeDefined());
      expect(result.current.canLinkRelation("supplier")).toBe(true);
    });

    it("is false when no set-/add-/clear- templates are present for the relation", async () => {
      server.use(
        http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
        http.get(PROFILE_HREF, () => HttpResponse.json(profileWithCreate)),
        http.get(ITEM_URL, () => HttpResponse.json(itemWithoutTemplates)),
      );

      const { result } = renderHook(() => useEntityCapabilities("invoice", "inv-1"), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(result.current.canLinkRelation("supplier")).toBe(false);
      });
    });
  });
});
