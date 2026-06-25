import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import { type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { invoiceProfileBodyWithRelations } from "../../test-fixtures/hal/fixtures";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import {
  AttributeKind,
  EntityItem,
  EntityItemAttributeContent,
  EntityItemAttributeNested,
  EntityItemAttributePlain,
  EntityItemAttributeUnknown,
  EntityItemRelation,
  RelationCardinalityError,
} from "./entity-item";
import ProfileEntity from "./entity-profile";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ─── Link relation constants ──────────────────────────────────────────────────

const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";
const BLUEPRINT_ATTRIBUTE_REL = "https://contentgrid.cloud/rels/blueprint/attribute";
const BLUEPRINT_CONSTRAINT_REL = "https://contentgrid.cloud/rels/blueprint/constraint";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeProfileEntity(
  attributes: Record<string, unknown>[] = [],
  relations: Record<string, unknown>[] = [],
): ProfileEntity {
  const embedded: Record<string, unknown> = {};
  if (attributes.length > 0)
    embedded["https://contentgrid.cloud/rels/blueprint/attribute"] = attributes;
  if (relations.length > 0)
    embedded["https://contentgrid.cloud/rels/blueprint/relation"] = relations;

  const json: Record<string, unknown> = {
    name: "invoice",
    description: "",
    _links: {
      self: { href: "/profile/invoices" },
      describes: [
        { href: "/invoices", name: "collection" },
        { href: "/invoices/{id}", name: "item", templated: true },
      ],
    },
    ...(Object.keys(embedded).length > 0 ? { _embedded: embedded } : {}),
  };
  const hal = new HalObject<ProfileEntityShape>(
    json as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: "/profile/invoices", name: "invoice" } as unknown as Link, hal);
}

function makeEntityItemHal(
  data: Record<string, unknown>,
  links: Record<string, unknown> = {},
  templates?: Record<string, unknown>,
): HalObject<EntityItemShape> {
  const json: Record<string, unknown> = {
    ...data,
    _links: {
      self: { href: `/invoices/${data.id ?? "inv-001"}` },
      ...links,
    },
  };
  if (templates) {
    json._templates = templates;
  }
  return new HalObject<EntityItemShape>(json as unknown as HalObjectShape<EntityItemShape>);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("EntityItem — id", () => {
  it("returns the id field from the HAL data", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.id).toBe("inv-001");
  });
});

describe("EntityItem — etag", () => {
  it("defaults etag to null when not provided", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.etag).toBeNull();
  });

  it("stores the provided etag", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity(), '"abc123"');
    expect(item.etag).toBe('"abc123"');
  });
});

describe("EntityItem — contentLinks", () => {
  it("returns empty array when no cg:content links", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.contentLinks).toHaveLength(0);
  });

  it("returns content links when present", () => {
    const hal = makeEntityItemHal(
      {
        id: "inv-001",
        document: { filename: "file.pdf", mimetype: "application/pdf", length: 1024 },
      },
      {
        [CG_CONTENT_REL]: [{ href: "/invoices/inv-001/document", name: "document" }],
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.contentLinks).toHaveLength(1);
    expect(item.contentLinks[0].href).toBe("/invoices/inv-001/document");
  });
});

describe("EntityItem — selfLink", () => {
  it("returns the self link", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.selfLink.href).toBe("/invoices/inv-001");
  });
});

describe("EntityItem — attributes", () => {
  it("excludes HAL internal fields starting with underscore", () => {
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    const names = item.attributes.map((a) => a.value.name);
    expect(names).not.toContain("_links");
    expect(names).not.toContain("_embedded");
    expect(names).not.toContain("_templates");
  });

  it("returns plain string attribute with correct kind", () => {
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    const numberAttr = item.attributes.find((a) => a.value.name === "number");
    expect(numberAttr).toBeDefined();
    expect(numberAttr!.value.kind).toBe(AttributeKind.PLAIN);
    expect((numberAttr!.value as EntityItemAttributePlain).value).toBe("INV-001");
  });

  it("returns plain numeric attribute with correct kind", () => {
    const hal = makeEntityItemHal({ id: "inv-001", total: 1250.0 });
    const item = new EntityItem(hal, makeProfileEntity());
    const totalAttr = item.attributes.find((a) => a.value.name === "total");
    expect(totalAttr!.value.kind).toBe(AttributeKind.PLAIN);
    expect((totalAttr!.value as EntityItemAttributePlain).value).toBe(1250.0);
  });

  it("returns plain boolean attribute with correct kind", () => {
    const hal = makeEntityItemHal({ id: "inv-001", active: true });
    const item = new EntityItem(hal, makeProfileEntity());
    const activeAttr = item.attributes.find((a) => a.value.name === "active");
    expect(activeAttr!.value.kind).toBe(AttributeKind.PLAIN);
    expect((activeAttr!.value as EntityItemAttributePlain).value).toBe(true);
  });

  it("returns plain null attribute with correct kind", () => {
    const hal = makeEntityItemHal({ id: "inv-001", deletedAt: null });
    const item = new EntityItem(hal, makeProfileEntity());
    const deletedAttr = item.attributes.find((a) => a.value.name === "deletedAt");
    expect(deletedAttr!.value.kind).toBe(AttributeKind.PLAIN);
    expect((deletedAttr!.value as EntityItemAttributePlain).value).toBeNull();
  });

  it("returns content attribute when cg:content link is present", () => {
    const hal = makeEntityItemHal(
      {
        id: "inv-001",
        document: { filename: "file.pdf", mimetype: "application/pdf", length: 1024 },
      },
      {
        [CG_CONTENT_REL]: [{ href: "/invoices/inv-001/document", name: "document" }],
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    const docAttr = item.attributes.find((a) => a.value.name === "document");
    expect(docAttr).toBeDefined();
    expect(docAttr!.value.kind).toBe(AttributeKind.CONTENT);
    const contentAttr = docAttr!.value as EntityItemAttributeContent;
    expect(contentAttr.metadata?.filename).toBe("file.pdf");
    expect(contentAttr.link.href).toBe("/invoices/inv-001/document");
  });

  it("returns content attribute with null metadata when content is absent", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001", document: null },
      {
        [CG_CONTENT_REL]: [{ href: "/invoices/inv-001/document", name: "document" }],
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    const docAttr = item.attributes.find((a) => a.value.name === "document");
    expect(docAttr!.value.kind).toBe(AttributeKind.CONTENT);
    expect((docAttr!.value as EntityItemAttributeContent).metadata).toBeNull();
  });

  it("returns nested attribute for object values", () => {
    const hal = makeEntityItemHal({ id: "inv-001", address: { street: "Main St", city: "NYC" } });
    const item = new EntityItem(hal, makeProfileEntity());
    const addrAttr = item.attributes.find((a) => a.value.name === "address");
    expect(addrAttr).toBeDefined();
    expect(addrAttr!.value.kind).toBe(AttributeKind.NESTED);
  });

  it("links attributes to profileAttribute when profile has matching attribute", () => {
    const profileEntity = makeProfileEntity([
      { name: "number", type: "string", description: "", readonly: false },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001" });
    const item = new EntityItem(hal, profileEntity);
    const numberAttr = item.attributes.find((a) => a.value.name === "number");
    expect(numberAttr!.profileAttribute).toBeDefined();
    expect(numberAttr!.profileAttribute!.name).toBe("number");
  });

  it("profileAttribute is undefined for attributes not in profile", () => {
    const hal = makeEntityItemHal({ id: "inv-001", unknownField: "value" });
    const item = new EntityItem(hal, makeProfileEntity());
    const unknownAttr = item.attributes.find((a) => a.value.name === "unknownField");
    expect(unknownAttr!.profileAttribute).toBeUndefined();
  });
});

describe("EntityItem — userDefinedAttributes", () => {
  it("returns only user-defined attributes", () => {
    const profileEntity = makeProfileEntity([
      { name: "id", type: "string", description: "", readonly: true },
      { name: "number", type: "string", description: "", readonly: false },
      {
        name: "created_at",
        type: "datetime",
        description: "",
        readonly: true,
        _embedded: {
          [BLUEPRINT_CONSTRAINT_REL]: [{ type: "created-date" }],
        },
      },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001", created_at: "2024-01-01" });
    const item = new EntityItem(hal, profileEntity);
    const userAttrs = item.userDefinedAttributes;
    const names = userAttrs.map((a) => a.value.name);
    expect(names).toContain("number");
    expect(names).not.toContain("created_at");
    expect(names).not.toContain("id");
  });

  it("returns empty array when all attributes are audit or id", () => {
    const profileEntity = makeProfileEntity([
      { name: "id", type: "string", description: "", readonly: true },
      {
        name: "created_at",
        type: "datetime",
        description: "",
        readonly: true,
        _embedded: {
          [BLUEPRINT_CONSTRAINT_REL]: [{ type: "created-date" }],
        },
      },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", created_at: "2024-01-01" });
    const item = new EntityItem(hal, profileEntity);
    expect(item.userDefinedAttributes).toHaveLength(0);
  });

  it("excludes attributes that have no profileAttribute match", () => {
    // Attributes not in profile don't show up in userDefinedAttributes
    const hal = makeEntityItemHal({ id: "inv-001", unknownField: "value" });
    const item = new EntityItem(hal, makeProfileEntity());
    // makeProfileEntity has no profile attributes, so userDefinedAttributeNames is empty
    expect(item.userDefinedAttributes).toHaveLength(0);
  });
});

describe("EntityItem — auditAttributes", () => {
  it("returns audit attributes only", () => {
    const profileEntity = makeProfileEntity([
      { name: "number", type: "string", description: "", readonly: false },
      {
        name: "created_at",
        type: "datetime",
        description: "",
        readonly: true,
        _embedded: {
          [BLUEPRINT_CONSTRAINT_REL]: [{ type: "created-date" }],
        },
      },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001", created_at: "2024-01-01" });
    const item = new EntityItem(hal, profileEntity);
    const auditAttrs = item.auditAttributes;
    const names = auditAttrs.map((a) => a.value.name);
    expect(names).toContain("created_at");
    expect(names).not.toContain("number");
  });

  it("returns empty array when no audit attributes in profile", () => {
    const profileEntity = makeProfileEntity([
      { name: "number", type: "string", description: "", readonly: false },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", number: "INV-001" });
    const item = new EntityItem(hal, profileEntity);
    expect(item.auditAttributes).toHaveLength(0);
  });
});

describe("EntityItem — defaultTemplate", () => {
  it("returns null when no default template on the item", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.defaultTemplate).toBeNull();
  });

  it("returns template when default template is present", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001" },
      {},
      {
        default: {
          method: "PATCH",
          target: "/invoices/inv-001",
          contentType: "application/json",
          properties: [{ name: "number", type: "text" }],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.defaultTemplate).not.toBeNull();
  });
});

describe("EntityItemAttributeNested — attributes", () => {
  it("returns empty array when value is null", () => {
    const nested = new EntityItemAttributeNested("address", null, undefined);
    expect(nested.attributes).toHaveLength(0);
  });

  it("returns sub-attributes for nested object", () => {
    const nested = new EntityItemAttributeNested(
      "address",
      { street: "Main St", city: "NYC" },
      undefined,
    );
    const attrs = nested.attributes;
    expect(attrs).toHaveLength(2);
    const streetAttr = attrs.find((a) => a.value.name === "street");
    expect(streetAttr!.value.kind).toBe(AttributeKind.PLAIN);
    expect((streetAttr!.value as EntityItemAttributePlain).value).toBe("Main St");
  });

  it("links nested attributes to profile when profileAttribute has embedded attributes", () => {
    const profileEntity = makeProfileEntity([
      {
        name: "address",
        type: "object",
        description: "",
        readonly: false,
        _embedded: {
          [BLUEPRINT_ATTRIBUTE_REL]: [
            { name: "street", type: "string", description: "", readonly: false },
          ],
        },
      },
    ]);
    const hal = makeEntityItemHal({ id: "inv-001", address: { street: "Main St" } });
    const item = new EntityItem(hal, profileEntity);
    const addrAttr = item.attributes.find((a) => a.value.name === "address");
    const nested = addrAttr!.value as EntityItemAttributeNested;
    const streetAttr = nested.attributes.find((a) => a.value.name === "street");
    expect(streetAttr!.profileAttribute).toBeDefined();
    expect(streetAttr!.profileAttribute!.name).toBe("street");
  });

  it("returns UNKNOWN kind for non-plain non-object values", () => {
    // Simulate a BigInt or Symbol-like scenario by constructing it manually
    const nested = new EntityItemAttributeUnknown("weird");
    expect(nested.kind).toBe(AttributeKind.UNKNOWN);
    expect(nested.name).toBe("weird");
  });

  it("handles nested null value giving empty attributes", () => {
    const nested = new EntityItemAttributeNested("obj", null, undefined);
    expect(nested.kind).toBe(AttributeKind.NESTED);
    expect(nested.attributes).toEqual([]);
  });
});

describe("EntityItem — static fetchByUrlQuery", () => {
  const ITEM_URL = "https://api.example.com/invoices/inv-001";

  it("returns query options with the correct queryKey", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItem.fetchByUrlQuery(apiFetch, ITEM_URL, profile);
    expect(opts.queryKey).toEqual(queryKeys.entityItem.byUrl(profile, ITEM_URL));
  });

  it("applies override options", () => {
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItem.fetchByUrlQuery(apiFetch, ITEM_URL, profile, { staleTime: 1234 });
    expect(opts.staleTime).toBe(1234);
  });

  it("queryFn fetches and returns an EntityItem", async () => {
    server.use(
      http.get(ITEM_URL, () =>
        HttpResponse.json(
          { id: "inv-001", number: "INV-001", _links: { self: { href: ITEM_URL } } },
          { headers: { ETag: '"v1"' } },
        ),
      ),
    );
    const apiFetch = createApiClient(noopSupplier);
    const profile = makeProfileEntity();
    const opts = EntityItem.fetchByUrlQuery(apiFetch, ITEM_URL, profile);
    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeInstanceOf(EntityItem);
    expect(result.id).toBe("inv-001");
    expect(result.etag).toBe('"v1"');
  });
});

describe("EntityItem — editEntityRequest", () => {
  it("encodes values into a Request using the default template", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001", number: "INV-001" },
      {},
      {
        default: {
          method: "PATCH",
          target: "https://api.example.com/invoices/inv-001",
          contentType: "application/json",
          properties: [{ name: "number", type: "text" }],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity(), '"v1"');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = item.editEntityRequest({ number: "INV-002" } as any);
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("PATCH");
  });

  it("throws with an explicit ABAC message when defaultTemplate is null", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item.editEntityRequest({} as any),
    ).toThrowError("Update not permitted: 'default' template absent");
  });
});

describe("EntityItem — canUpdate", () => {
  it("returns true when the default template is present", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001" },
      {},
      {
        default: {
          method: "PATCH",
          target: "/invoices/inv-001",
          contentType: "application/json",
          properties: [{ name: "number", type: "text" }],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.canUpdate).toBe(true);
  });

  it("returns false when no default template is present", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.canUpdate).toBe(false);
  });
});

describe("EntityItem — deleteTemplate", () => {
  it("returns null when no delete template on the item", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.deleteTemplate).toBeNull();
  });

  it("returns template when delete template is present", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001" },
      {},
      {
        delete: {
          method: "DELETE",
          target: "/invoices/inv-001",
          properties: [],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.deleteTemplate).not.toBeNull();
  });
});

describe("EntityItem — canDelete", () => {
  it("returns true when the delete template is present", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001" },
      {},
      {
        delete: {
          method: "DELETE",
          target: "/invoices/inv-001",
          properties: [],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.canDelete).toBe(true);
  });

  it("returns false when no delete template is present", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.canDelete).toBe(false);
  });
});

describe("EntityItem — deleteEntityItemRequest", () => {
  it("returns a Request with DELETE method", () => {
    const hal = makeEntityItemHal(
      { id: "inv-001" },
      {},
      {
        delete: {
          method: "DELETE",
          target: "https://api.example.com/invoices/inv-001",
          properties: [],
        },
      },
    );
    const item = new EntityItem(hal, makeProfileEntity(), '"v1"');
    const req = item.deleteEntityItemRequest();
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("DELETE");
  });

  it("throws when delete template is absent", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(() => item.deleteEntityItemRequest()).toThrow();
  });
});

// ─── Relation accessor constants (shared with EntityItemRelation tests below) ─

const INVOICE_ITEM_URL = "https://api.example.com/invoices/inv-001";
const SUPPLIER_URL = "https://api.example.com/suppliers/sup-001";
const LINE_ITEM_URL_1 = "https://api.example.com/line-items/li-001";
const LINE_ITEM_URL_2 = "https://api.example.com/line-items/li-002";

// ─── Content link accessor tests ──────────────────────────────────────────────

const CONTENT_URL = "https://api.example.com/invoices/inv-001/document";

function makeEntityItemWithContentLink(etag: string | null = '"v1"'): EntityItem {
  const hal = makeEntityItemHal(
    {
      id: "inv-001",
      document: { filename: "file.pdf", mimetype: "application/pdf", length: 1024 },
    },
    {
      [CG_CONTENT_REL]: [{ href: CONTENT_URL, name: "document" }],
    },
  );
  return new EntityItem(hal, makeProfileEntity(), etag);
}

function makeEntityItemWithoutContentLink(etag: string | null = '"v1"'): EntityItem {
  const hal = makeEntityItemHal({ id: "inv-001" });
  return new EntityItem(hal, makeProfileEntity(), etag);
}

describe("EntityItem — contentLink", () => {
  it("returns the link when the cg:content link is present", () => {
    const item = makeEntityItemWithContentLink();
    const link = item.contentLink("document");
    expect(link).not.toBeNull();
    expect(link!.href).toBe(CONTENT_URL);
  });

  it("returns null when the cg:content link is absent", () => {
    const item = makeEntityItemWithoutContentLink();
    expect(item.contentLink("document")).toBeNull();
  });

  it("returns null for unknown attribute name", () => {
    const item = makeEntityItemWithContentLink();
    expect(item.contentLink("unknown-attr")).toBeNull();
  });
});

describe("EntityItem — canUploadContent", () => {
  it("returns true when the cg:content link is present", () => {
    const item = makeEntityItemWithContentLink();
    expect(item.canUploadContent("document")).toBe(true);
  });

  it("returns false when the cg:content link is absent", () => {
    const item = makeEntityItemWithoutContentLink();
    expect(item.canUploadContent("document")).toBe(false);
  });
});

describe("EntityItem — uploadContentRequest", () => {
  it("returns a Request with PUT method pointing to the content link href", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file);
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("PUT");
    expect(req.url).toBe(CONTENT_URL);
  });

  it("uses file.type as Content-Type", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file);
    expect(req.headers.get("Content-Type")).toBe("text/plain");
  });

  it("uses opts.contentType when provided (overrides file.type)", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file, { contentType: "application/pdf" });
    expect(req.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("falls back to application/octet-stream for Blob without type", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const blob = new Blob(["data"]); // no type
    const req = item.uploadContentRequest("document", blob);
    expect(req.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("sets Content-Disposition when filename is available from File", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file);
    expect(req.headers.get("Content-Disposition")).toContain("hello.txt");
    expect(req.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("uses opts.filename when provided", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const blob = new Blob(["data"]);
    const req = item.uploadContentRequest("document", blob, { filename: "override.pdf" });
    expect(req.headers.get("Content-Disposition")).toContain("override.pdf");
  });

  it("omits Content-Disposition when no filename is available (Blob without opts.filename)", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const blob = new Blob(["data"]);
    const req = item.uploadContentRequest("document", blob);
    expect(req.headers.get("Content-Disposition")).toBeNull();
  });

  it("attaches If-Match when etag is set", () => {
    const item = makeEntityItemWithContentLink('"v1"');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file);
    expect(req.headers.get("If-Match")).toBe('"v1"');
  });

  it("omits If-Match when etag is null", () => {
    const item = makeEntityItemWithContentLink(null);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const req = item.uploadContentRequest("document", file);
    expect(req.headers.get("If-Match")).toBeNull();
  });

  it("throws when the cg:content link is absent", () => {
    const item = makeEntityItemWithoutContentLink();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    expect(() => item.uploadContentRequest("document", file)).toThrow();
  });
});

describe("EntityItem — downloadContentRequest", () => {
  it("returns a Request with GET method pointing to the content link href", () => {
    const item = makeEntityItemWithContentLink();
    const req = item.downloadContentRequest("document");
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("GET");
    expect(req.url).toBe(CONTENT_URL);
  });

  it("omits Range header when no opts.range provided", () => {
    const item = makeEntityItemWithContentLink();
    const req = item.downloadContentRequest("document");
    expect(req.headers.get("Range")).toBeNull();
  });

  it("adds Range header when opts.range is provided (start and end)", () => {
    const item = makeEntityItemWithContentLink();
    const req = item.downloadContentRequest("document", { range: { start: 0, end: 99 } });
    expect(req.headers.get("Range")).toBe("bytes=0-99");
  });

  it("adds Range header with open end when only start is provided", () => {
    const item = makeEntityItemWithContentLink();
    const req = item.downloadContentRequest("document", { range: { start: 512 } });
    expect(req.headers.get("Range")).toBe("bytes=512-");
  });

  it("throws when the cg:content link is absent", () => {
    const item = makeEntityItemWithoutContentLink();
    expect(() => item.downloadContentRequest("document")).toThrow();
  });
});

// ─── EntityItemRelation tests ─────────────────────────────────────────────────

function makeProfileEntityWithRelations(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    invoiceProfileBodyWithRelations as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: "/profile/invoices", name: "invoice" } as unknown as Link, hal);
}

const SET_SUPPLIER_TMPL = {
  method: "PUT",
  target: `${INVOICE_ITEM_URL}/supplier`,
  contentType: "text/uri-list",
  properties: [{ name: "supplier", type: "url" }],
};

const ADD_LINE_ITEM_TMPL = {
  method: "POST",
  target: `${INVOICE_ITEM_URL}/lineItems`,
  contentType: "text/uri-list",
  properties: [{ name: "lineItem", type: "url", options: {} }],
};

const CLEAR_SUPPLIER_TMPL = {
  method: "DELETE",
  target: `${INVOICE_ITEM_URL}/supplier`,
  properties: [],
};

const CG_RELATION_REL_FULL = "https://contentgrid.cloud/rels/contentgrid/relation";

function makeEntityItemWithFullRelations(
  etag: string | null = '"v1"',
  templates: Record<string, unknown> = {},
): EntityItem {
  const profileEntity = makeProfileEntityWithRelations();
  const itemBody = {
    id: "inv-001",
    _links: {
      self: { href: `${INVOICE_ITEM_URL}` },
      [CG_RELATION_REL_FULL]: [
        { href: `${INVOICE_ITEM_URL}/supplier`, name: "supplier" },
        { href: `${INVOICE_ITEM_URL}/lineItems`, name: "lineItems" },
      ],
    },
    _templates: templates,
  };
  const hal = new HalObject<EntityItemShape>(
    itemBody as unknown as HalObjectShape<EntityItemShape>,
  );
  return new EntityItem(hal, profileEntity, etag);
}

describe("EntityItem — getRelation", () => {
  it("returns undefined for an unknown relation name", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("nonexistent")).toBeUndefined();
  });

  it("returns an EntityItemRelation for a known to-one relation", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("supplier");
    expect(rel).toBeInstanceOf(EntityItemRelation);
    expect(rel?.name).toBe("supplier");
    expect(rel?.isToOne).toBe(true);
    expect(rel?.isToMany).toBe(false);
  });

  it("returns an EntityItemRelation for a known to-many relation", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("lineItems");
    expect(rel).toBeInstanceOf(EntityItemRelation);
    expect(rel?.name).toBe("lineItems");
    expect(rel?.isToMany).toBe(true);
    expect(rel?.isToOne).toBe(false);
  });

  it("exposes the cg:relation navigation link", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("supplier");
    expect(rel?.link).not.toBeNull();
    expect(rel?.link?.href).toBe(`${INVOICE_ITEM_URL}/supplier`);
  });

  it("link is null when cg:relation link is absent (ABAC hidden)", () => {
    // Item has profile relation but no cg:relation link for 'supplier'
    const profileEntity = makeProfileEntityWithRelations();
    const itemBody = {
      id: "inv-001",
      _links: { self: { href: INVOICE_ITEM_URL } },
    };
    const hal = new HalObject<EntityItemShape>(
      itemBody as unknown as HalObjectShape<EntityItemShape>,
    );
    const item = new EntityItem(hal, profileEntity, null);
    const rel = item.getRelation("supplier");
    expect(rel).toBeInstanceOf(EntityItemRelation);
    expect(rel?.link).toBeNull();
  });
});

describe("EntityItem — relations getter", () => {
  it("returns one EntityItemRelation per profile relation", () => {
    const item = makeEntityItemWithFullRelations();
    const rels = item.relations;
    expect(rels).toHaveLength(2);
    expect(rels[0]).toBeInstanceOf(EntityItemRelation);
    expect(rels[1]).toBeInstanceOf(EntityItemRelation);
  });

  it("names match profile relation order", () => {
    const item = makeEntityItemWithFullRelations();
    const names = item.relations.map((r) => r.name);
    expect(names).toContain("supplier");
    expect(names).toContain("lineItems");
  });

  it("returns empty array when profile has no relations", () => {
    const hal = makeEntityItemHal({ id: "inv-001" });
    const item = new EntityItem(hal, makeProfileEntity());
    expect(item.relations).toHaveLength(0);
  });
});

describe("EntityItemRelation — capability flags (ABAC via template presence)", () => {
  it("canSet is true when set-<rel> template is present", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "set-supplier": SET_SUPPLIER_TMPL });
    expect(item.getRelation("supplier")?.canSet).toBe(true);
  });

  it("canSet is false when set-<rel> template is absent", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("supplier")?.canSet).toBe(false);
  });

  it("canAdd is true when add-<rel> template is present", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "add-lineItems": ADD_LINE_ITEM_TMPL });
    expect(item.getRelation("lineItems")?.canAdd).toBe(true);
  });

  it("canAdd is false when add-<rel> template is absent", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("lineItems")?.canAdd).toBe(false);
  });

  it("canClear is true when clear-<rel> template is present", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "clear-supplier": CLEAR_SUPPLIER_TMPL });
    expect(item.getRelation("supplier")?.canClear).toBe(true);
  });

  it("canClear is false when clear-<rel> template is absent", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("supplier")?.canClear).toBe(false);
  });
});

describe("EntityItemRelation — setRequest", () => {
  it("returns a PUT request with text/uri-list containing the target href", async () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "set-supplier": SET_SUPPLIER_TMPL });
    const rel = item.getRelation("supplier")!;
    const req = rel.setRequest(SUPPLIER_URL);
    expect(req.method).toBe("PUT");
    expect(req.headers.get("Content-Type")).toContain("text/uri-list");
    const body = await req.text();
    expect(body).toContain(SUPPLIER_URL);
  });

  it("throws RelationCardinalityError when called on a to-many relation", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "add-lineItems": ADD_LINE_ITEM_TMPL });
    const rel = item.getRelation("lineItems")!;
    expect(() => rel.setRequest(LINE_ITEM_URL_1)).toThrow(RelationCardinalityError);
    expect(() => rel.setRequest(LINE_ITEM_URL_1)).toThrow(/to-many/);
  });

  it("throws an ABAC error (not RelationCardinalityError) when template is absent on to-one", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("supplier")!;
    let thrown: Error | undefined;
    try {
      rel.setRequest(SUPPLIER_URL);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(RelationCardinalityError);
    expect(thrown?.message).toContain("template absent");
  });
});

describe("EntityItemRelation — addRequest", () => {
  it("returns a POST request with text/uri-list containing all target hrefs", async () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "add-lineItems": ADD_LINE_ITEM_TMPL });
    const rel = item.getRelation("lineItems")!;
    const req = rel.addRequest([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    expect(req.method).toBe("POST");
    expect(req.headers.get("Content-Type")).toContain("text/uri-list");
    const body = await req.text();
    expect(body).toContain(LINE_ITEM_URL_1);
    expect(body).toContain(LINE_ITEM_URL_2);
  });

  it("throws RelationCardinalityError when called on a to-one relation", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "set-supplier": SET_SUPPLIER_TMPL });
    const rel = item.getRelation("supplier")!;
    expect(() => rel.addRequest([SUPPLIER_URL])).toThrow(RelationCardinalityError);
    expect(() => rel.addRequest([SUPPLIER_URL])).toThrow(/to-one/);
  });

  it("throws an ABAC error (not RelationCardinalityError) when template is absent on to-many", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("lineItems")!;
    let thrown: Error | undefined;
    try {
      rel.addRequest([LINE_ITEM_URL_1]);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(RelationCardinalityError);
    expect(thrown?.message).toContain("template absent");
  });
});

describe("EntityItemRelation — clearRequest", () => {
  it("returns a DELETE request", () => {
    const item = makeEntityItemWithFullRelations('"v1"', { "clear-supplier": CLEAR_SUPPLIER_TMPL });
    const rel = item.getRelation("supplier")!;
    const req = rel.clearRequest();
    expect(req.method).toBe("DELETE");
  });

  it("throws an ABAC error when clear template is absent", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("supplier")!;
    expect(() => rel.clearRequest()).toThrow(/template absent/);
  });
});

describe("EntityItemRelation — empty properties guard", () => {
  it("setRequest throws a clear error when set template has no properties", () => {
    const templateWithNoProps = {
      method: "PUT",
      target: `${INVOICE_ITEM_URL}/supplier`,
      contentType: "text/uri-list",
      properties: [],
    };
    const item = makeEntityItemWithFullRelations('"v1"', { "set-supplier": templateWithNoProps });
    const rel = item.getRelation("supplier")!;
    expect(() => rel.setRequest(SUPPLIER_URL)).toThrow(/no properties/);
  });

  it("addRequest throws a clear error when add template has no properties", () => {
    const templateWithNoProps = {
      method: "POST",
      target: `${INVOICE_ITEM_URL}/lineItems`,
      contentType: "text/uri-list",
      properties: [],
    };
    const item = makeEntityItemWithFullRelations('"v1"', { "add-lineItems": templateWithNoProps });
    const rel = item.getRelation("lineItems")!;
    expect(() => rel.addRequest([LINE_ITEM_URL_1])).toThrow(/no properties/);
  });
});

describe("EntityItemRelation — profile metadata", () => {
  it("exposes title from the profile relation", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("supplier")?.title).toBe("Supplier");
    expect(item.getRelation("lineItems")?.title).toBe("Line Items");
  });

  it("exposes the ProfileRelation via .profile", () => {
    const item = makeEntityItemWithFullRelations();
    const rel = item.getRelation("supplier")!;
    expect(rel.profile.name).toBe("supplier");
    expect(rel.profile.isToOne).toBe(true);
  });

  it("targetProfileLink.name carries the target entity name", () => {
    const item = makeEntityItemWithFullRelations();
    expect(item.getRelation("supplier")?.profile.targetProfileLink?.name).toBe("supplier");
    expect(item.getRelation("lineItems")?.profile.targetProfileLink?.name).toBe("lineItem");
  });
});
