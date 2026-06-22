import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import { type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
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
