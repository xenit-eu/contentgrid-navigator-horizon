/**
 * Unit tests for `fetchEntitySchema` — focused on the attribute-classification
 * region (content vs. audit_metadata detection) introduced in the
 * "profile-driven attribute detection" PR.
 *
 * These tests exercise the three detection paths:
 *  1. Constraint-driven (primary): system-managed blueprint:constraint entries
 *     on audit sub-attributes → `type === "audit_metadata"` + populated auditRoles.
 *  2. Sub-attribute-name fallback: legacy fixtures with no constraints but
 *     well-known names (created_by / created_date).
 *  3. Content attribute detection: sub-attributes filename/mimetype/length.
 *  4. No-audit entity: graceful absence of any audit attribute.
 *
 * Per ADR-014, fixtures ARE the contract tests.  The JSON fixtures used here
 * live in test-fixtures/halforms/.
 */
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import allAttributeFixture from "../../test-fixtures/halforms/all-attribute.json";
import auditCustomNamesFixture from "../../test-fixtures/halforms/audit-custom-names.json";
import emptyFixture from "../../test-fixtures/halforms/empty.json";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { fetchEntitySchema } from "./use-entity-schema";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ---------------------------------------------------------------------------
// Content attribute detection
// ---------------------------------------------------------------------------

describe("fetchEntitySchema — content attribute detection", () => {
  it("classifies an object attribute with filename/mimetype/length sub-attributes as 'content'", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/all-attributes", () =>
        HttpResponse.json(allAttributeFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/all-attributes",
    );

    const contentAttr = schema.attributes.find((a) => a.name === "content");
    expect(contentAttr).toBeDefined();
    expect(contentAttr?.type).toBe("content");
    // Content attributes do not carry auditRoles
    expect(contentAttr?.auditRoles).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Audit attribute detection — constraint-driven path (primary)
// ---------------------------------------------------------------------------

describe("fetchEntitySchema — audit_metadata detection (constraint-driven path)", () => {
  it("classifies an object attribute with system-managed constraints as 'audit_metadata'", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/all-attributes", () =>
        HttpResponse.json(allAttributeFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/all-attributes",
    );

    const auditAttr = schema.attributes.find((a) => a.name === "audit_metadata");
    expect(auditAttr).toBeDefined();
    expect(auditAttr?.type).toBe("audit_metadata");
  });

  it("populates auditRoles from system-managed constraints (default names)", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/all-attributes", () =>
        HttpResponse.json(allAttributeFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/all-attributes",
    );

    const auditAttr = schema.attributes.find((a) => a.name === "audit_metadata");
    expect(auditAttr?.auditRoles).toEqual({
      "created-by": "created_by",
      "created-date": "created_date",
      "modified-by": "last_modified_by",
      "modified-date": "last_modified_date",
    });
  });

  it("populates auditRoles correctly when sub-attribute names are non-default", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/audit-custom-names", () =>
        HttpResponse.json(auditCustomNamesFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/audit-custom-names",
    );

    const auditAttr = schema.attributes.find((a) => a.name === "tracking");
    expect(auditAttr).toBeDefined();
    expect(auditAttr?.type).toBe("audit_metadata");
    expect(auditAttr?.auditRoles).toEqual({
      "created-by": "author",
      "created-date": "created_at",
      "modified-by": "editor",
      "modified-date": "updated_at",
    });
  });
});

// ---------------------------------------------------------------------------
// Entity with no audit attributes — graceful absence
// ---------------------------------------------------------------------------

describe("fetchEntitySchema — entity with no audit attributes", () => {
  it("returns no audit_metadata attribute for an entity without audit constraints", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/empties", () =>
        HttpResponse.json(emptyFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/empties",
    );

    const auditAttr = schema.attributes.find((a) => a.type === "audit_metadata");
    expect(auditAttr).toBeUndefined();
  });

  it("returns only the 'id' attribute for the empty entity", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/empties", () =>
        HttpResponse.json(emptyFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/empties",
    );

    expect(schema.attributes).toHaveLength(1);
    expect(schema.attributes[0]?.name).toBe("id");
  });
});

// ---------------------------------------------------------------------------
// Plain object attributes and partial/fallback paths
// ---------------------------------------------------------------------------

/** Build a minimal entity-profile body with a single object attribute. */
function profileWithObjectAttribute(subAttributes: unknown[] | undefined) {
  return {
    name: "thing",
    title: "Thing",
    _links: {
      self: { href: "https://api.example.contentgrid.com/profile/things" },
      describes: [
        { href: "https://api.example.contentgrid.com/things", name: "collection" },
        { href: "https://api.example.contentgrid.com/things/{id}", name: "item", templated: true },
      ],
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
          name: "payload",
          title: "Payload",
          type: "object",
          readOnly: false,
          required: false,
          ...(subAttributes !== undefined
            ? {
                _embedded: {
                  "blueprint:constraint": [],
                  "blueprint:search-param": [],
                  "blueprint:attribute": subAttributes,
                },
              }
            : {}),
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {
      default: { method: "HEAD", properties: [] },
      search: { method: "GET", properties: [] },
    },
  };
}

function subAttr(name: string, constraints: unknown[] = []) {
  return {
    name,
    title: name,
    type: "string",
    readOnly: true,
    required: false,
    _embedded: {
      "blueprint:constraint": constraints,
      "blueprint:search-param": [],
      "blueprint:attribute": [],
    },
    _links: {},
  };
}

const THING_PROFILE_URL = "https://api.example.contentgrid.com/profile/things";

async function fetchThingSchema(body: Record<string, unknown>) {
  server.use(http.get(THING_PROFILE_URL, () => HttpResponse.json(body)));
  return fetchEntitySchema(createApiClient(noopSupplier), THING_PROFILE_URL);
}

describe("fetchEntitySchema — plain object attributes stay 'object'", () => {
  it("keeps type 'object' when sub-attributes match neither content nor audit shapes", async () => {
    const schema = await fetchThingSchema(
      profileWithObjectAttribute([subAttr("foo"), subAttr("bar")]),
    );

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("object");
    expect(attr?.auditRoles).toBeUndefined();
  });

  it("keeps type 'object' when the attribute has no embedded sub-attributes at all", async () => {
    const schema = await fetchThingSchema(profileWithObjectAttribute(undefined));

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("object");
    expect(attr?.auditRoles).toBeUndefined();
  });

  it("ignores non-system-managed constraint types on sub-attributes", async () => {
    // A sub-attribute with only a non-audit constraint (e.g. "required") must
    // NOT trigger audit detection.
    const schema = await fetchThingSchema(
      profileWithObjectAttribute([subAttr("foo", [{ type: "required" }])]),
    );

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("object");
    expect(attr?.auditRoles).toBeUndefined();
  });
});

describe("fetchEntitySchema — partial audit constraints", () => {
  it("detects audit_metadata from a single system-managed constraint and maps only that role", async () => {
    const schema = await fetchThingSchema(
      profileWithObjectAttribute([
        subAttr("stamp", [{ type: "modified-date" }]),
        // Sibling with a non-audit constraint is ignored by role discovery.
        subAttr("note", [{ type: "required" }]),
      ]),
    );

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("audit_metadata");
    expect(attr?.auditRoles).toEqual({ "modified-date": "stamp" });
  });
});

describe("fetchEntitySchema — fallback name-probe path (no constraints)", () => {
  it("detects audit_metadata from default names and maps created roles only when modified names are absent", async () => {
    const schema = await fetchThingSchema(
      profileWithObjectAttribute([subAttr("created_by"), subAttr("created_date")]),
    );

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("audit_metadata");
    expect(attr?.auditRoles).toEqual({
      "created-by": "created_by",
      "created-date": "created_date",
    });
  });

  it("includes modified roles in the fallback map when last_modified_* names are present", async () => {
    const schema = await fetchThingSchema(
      profileWithObjectAttribute([
        subAttr("created_by"),
        subAttr("created_date"),
        subAttr("last_modified_by"),
        subAttr("last_modified_date"),
      ]),
    );

    const attr = schema.attributes.find((a) => a.name === "payload");
    expect(attr?.type).toBe("audit_metadata");
    expect(attr?.auditRoles).toEqual({
      "created-by": "created_by",
      "created-date": "created_date",
      "modified-by": "last_modified_by",
      "modified-date": "last_modified_date",
    });
  });
});

// ---------------------------------------------------------------------------
// auditRoles absent on non-audit attributes
// ---------------------------------------------------------------------------

describe("fetchEntitySchema — auditRoles absent on non-audit attributes", () => {
  it("scalar attributes do not carry auditRoles", async () => {
    server.use(
      http.get("https://api.example.contentgrid.com/profile/all-attributes", () =>
        HttpResponse.json(allAttributeFixture),
      ),
    );

    const schema = await fetchEntitySchema(
      createApiClient(noopSupplier),
      "https://api.example.contentgrid.com/profile/all-attributes",
    );

    const textAttr = schema.attributes.find((a) => a.name === "text");
    expect(textAttr?.auditRoles).toBeUndefined();
  });
});
