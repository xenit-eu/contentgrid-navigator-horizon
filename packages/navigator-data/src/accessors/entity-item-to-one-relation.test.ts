import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import {
  invoiceProfileBodyWithRelations,
  sampleInvoiceWithRelationTemplates,
  sampleSupplierItem,
} from "../../test-fixtures/hal/fixtures";
import { createEntityHandler, createProblemHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { cgRels } from "../api";
import { createApiClient } from "../api/client";
import type { AuthenticationTokenSupplier } from "../api/client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { EntityItem } from "./entity-item";
import { EntityItemToOneRelation } from "./entity-item-to-one-relation";
import ProfileEntity from "./entity-profile";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ─── URLs ───────────────────────────────────────────────────────────────────────

const BASE = "https://api.example.com";
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
// Used as absolute URL for MSW interception in static fetchQuery tests
const SUPPLIER_RELATION_URL = `${BASE}/invoices/inv-001/supplier`;
const SUPPLIER_ITEM_URL = `${BASE}/suppliers/sup-001`;

// ─── Fixture helpers ───────────────────────────────────────────────────────────

function makeSupplierProfile(): ProfileEntity {
  const json: Record<string, unknown> = {
    name: "supplier",
    description: "",
    _links: {
      self: { href: "/profile/suppliers" },
      describes: [
        { href: "/suppliers", name: "collection" },
        { href: "/suppliers/{id}", name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject<ProfileEntityShape>(
    json as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: "/profile/suppliers", name: "supplier" } as unknown as Link,
    hal,
  );
}

function makeInvoiceProfile(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    invoiceProfileBodyWithRelations as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: "/profile/invoices", name: "invoice" } as unknown as Link, hal);
}

/**
 * Build an EntityItem for inv-001 with ONLY the given HAL-FORMS templates.
 * The item always has cg:relation links for supplier and lineItems.
 * Uses ONLY the explicitly supplied templates (no defaults) so each test controls
 * exactly which operation templates are present — matching the to-many test design.
 */
function makeInvoiceItem(
  templates: Record<string, unknown> = {},
  etag: string | null = '"v1"',
): EntityItem {
  const body = {
    ...sampleInvoiceWithRelationTemplates,
    // Use ONLY the provided templates — do not inherit the fixture defaults.
    _templates: templates,
  };
  const hal = new HalObject<EntityItemShape>(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, makeInvoiceProfile(), etag);
}

const SET_SUPPLIER_TMPL = {
  method: "PUT",
  target: `${INVOICE_ITEM_URL}/supplier`,
  contentType: "text/uri-list",
  properties: [{ name: "supplier", type: "url" }],
};

const CLEAR_SUPPLIER_TMPL = {
  method: "DELETE",
  target: `${INVOICE_ITEM_URL}/supplier`,
  properties: [],
};

/**
 * Build an EntityItemToOneRelation for the "supplier" relation on inv-001.
 * Optionally pass templates to include/override on the source item.
 */
function makeSupplierRelation(
  templates: Record<string, unknown> = {},
  etag: string | null = '"v1"',
): EntityItemToOneRelation {
  const item = makeInvoiceItem(templates, etag);
  const link = item.halItem.links.findLink(cgRels.relation, "supplier");
  if (!link) throw new Error("supplier cg:relation link not found");
  const profileRelation = makeInvoiceProfile().getRelation("supplier");
  if (!profileRelation) throw new Error("supplier profile relation not found");
  return new EntityItemToOneRelation("supplier", link, profileRelation, item);
}

// ─── Template getter tests ─────────────────────────────────────────────────────

describe("EntityItemToOneRelation — setTemplate", () => {
  it("returns non-null when set-<name> template is present", () => {
    const rel = makeSupplierRelation({ "set-supplier": SET_SUPPLIER_TMPL });
    expect(rel.setTemplate).not.toBeNull();
  });

  it("returns null when set-<name> template is absent", () => {
    const rel = makeSupplierRelation();
    expect(rel.setTemplate).toBeNull();
  });
});

describe("EntityItemToOneRelation — canSet", () => {
  it("returns true when set-<name> template is present", () => {
    const rel = makeSupplierRelation({ "set-supplier": SET_SUPPLIER_TMPL });
    expect(rel.canSet).toBe(true);
  });

  it("returns false when set-<name> template is absent", () => {
    const rel = makeSupplierRelation();
    expect(rel.canSet).toBe(false);
  });
});

describe("EntityItemToOneRelation — clearTemplate", () => {
  it("returns non-null when clear-<name> template is present", () => {
    const rel = makeSupplierRelation({ "clear-supplier": CLEAR_SUPPLIER_TMPL });
    expect(rel.clearTemplate).not.toBeNull();
  });

  it("returns null when clear-<name> template is absent", () => {
    const rel = makeSupplierRelation();
    expect(rel.clearTemplate).toBeNull();
  });
});

describe("EntityItemToOneRelation — canClear", () => {
  it("returns true when clear-<name> template is present", () => {
    const rel = makeSupplierRelation({ "clear-supplier": CLEAR_SUPPLIER_TMPL });
    expect(rel.canClear).toBe(true);
  });

  it("returns false when clear-<name> template is absent", () => {
    const rel = makeSupplierRelation();
    expect(rel.canClear).toBe(false);
  });
});

// ─── setRelationRequest tests ──────────────────────────────────────────────────

describe("EntityItemToOneRelation — setRelationRequest", () => {
  it("returns a PUT request with text/uri-list containing the target href", async () => {
    const rel = makeSupplierRelation({ "set-supplier": SET_SUPPLIER_TMPL });
    const req = rel.setRelationRequest(SUPPLIER_ITEM_URL);
    expect(req.method).toBe("PUT");
    expect(req.headers.get("Content-Type")).toContain("text/uri-list");
    const body = await req.text();
    expect(body).toContain(SUPPLIER_ITEM_URL);
  });

  it("targets the relation URL from the template", () => {
    const rel = makeSupplierRelation({ "set-supplier": SET_SUPPLIER_TMPL });
    const req = rel.setRelationRequest(SUPPLIER_ITEM_URL);
    expect(req.url).toBe(`${INVOICE_ITEM_URL}/supplier`);
  });

  it("does NOT attach If-Match (mutation hook is responsible)", () => {
    const rel = makeSupplierRelation({ "set-supplier": SET_SUPPLIER_TMPL });
    const req = rel.setRelationRequest(SUPPLIER_ITEM_URL);
    expect(req.headers.get("If-Match")).toBeNull();
  });

  it("throws with 'template absent' message when set-<name> template is missing", () => {
    const rel = makeSupplierRelation();
    expect(() => rel.setRelationRequest(SUPPLIER_ITEM_URL)).toThrow("template absent");
  });

  it("throws with relation name in the error message when template is missing", () => {
    const rel = makeSupplierRelation();
    expect(() => rel.setRelationRequest(SUPPLIER_ITEM_URL)).toThrow("supplier");
  });

  it("throws when template has no properties", () => {
    const templateNoProps = {
      method: "PUT",
      target: `${INVOICE_ITEM_URL}/supplier`,
      contentType: "text/uri-list",
      properties: [],
    };
    const rel = makeSupplierRelation({ "set-supplier": templateNoProps });
    expect(() => rel.setRelationRequest(SUPPLIER_ITEM_URL)).toThrow(/no properties/);
  });
});

// ─── clearRelationRequest tests ────────────────────────────────────────────────

describe("EntityItemToOneRelation — clearRelationRequest", () => {
  it("returns a DELETE request", () => {
    const rel = makeSupplierRelation({ "clear-supplier": CLEAR_SUPPLIER_TMPL });
    const req = rel.clearRelationRequest();
    expect(req.method).toBe("DELETE");
  });

  it("targets the relation URL from the template", () => {
    const rel = makeSupplierRelation({ "clear-supplier": CLEAR_SUPPLIER_TMPL });
    const req = rel.clearRelationRequest();
    expect(req.url).toBe(`${INVOICE_ITEM_URL}/supplier`);
  });

  it("does NOT attach If-Match (mutation hook is responsible)", () => {
    const rel = makeSupplierRelation({ "clear-supplier": CLEAR_SUPPLIER_TMPL });
    const req = rel.clearRelationRequest();
    expect(req.headers.get("If-Match")).toBeNull();
  });

  it("throws with 'template absent' message when clear-<name> template is missing", () => {
    const rel = makeSupplierRelation();
    expect(() => rel.clearRelationRequest()).toThrow("template absent");
  });

  it("throws with relation name in the error message when template is missing", () => {
    const rel = makeSupplierRelation();
    expect(() => rel.clearRelationRequest()).toThrow("supplier");
  });
});

// ─── Static fetchQuery tests ───────────────────────────────────────────────────

describe("EntityItemToOneRelation.fetchQuery — queryKey", () => {
  it("has the correct toOneRelation.byUrl queryKey", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeSupplierProfile();
    const opts = EntityItemToOneRelation.fetchQuery(apiFetch, SUPPLIER_RELATION_URL, targetProfile);
    expect(opts.queryKey).toEqual(
      queryKeys.toOneRelation.byUrl(targetProfile, SUPPLIER_RELATION_URL),
    );
  });

  it("applies override options — staleTime override wins", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeSupplierProfile();
    const opts = EntityItemToOneRelation.fetchQuery(
      apiFetch,
      SUPPLIER_RELATION_URL,
      targetProfile,
      {
        staleTime: 1234,
      },
    );
    expect(opts.staleTime).toBe(1234);
  });
});

describe("EntityItemToOneRelation.fetchQuery — success", () => {
  it("returns an EntityItem when the target is found", async () => {
    const absoluteUrl = SUPPLIER_RELATION_URL;
    server.use(
      createEntityHandler({
        url: absoluteUrl,
        body: {
          ...sampleSupplierItem,
          _links: { self: { href: SUPPLIER_ITEM_URL } },
        },
      }),
    );
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeSupplierProfile();
    const opts = EntityItemToOneRelation.fetchQuery(apiFetch, absoluteUrl, targetProfile);
    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeInstanceOf(EntityItem);
    expect((result as EntityItem).id).toBe("sup-001");
  });
});

describe("EntityItemToOneRelation.fetchQuery — 404 returns null", () => {
  it("returns null when the server responds with 404 (empty to-one slot)", async () => {
    const absoluteUrl = SUPPLIER_RELATION_URL;
    server.use(
      createProblemHandler({
        method: "get",
        url: absoluteUrl,
        status: 404,
        type: "not-found/entity-item",
      }),
    );
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeSupplierProfile();
    const opts = EntityItemToOneRelation.fetchQuery(apiFetch, absoluteUrl, targetProfile, {
      retry: false,
    });
    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeNull();
  });
});

// ─── Instance fetchQuery delegate test ────────────────────────────────────────

describe("EntityItemToOneRelation — instance fetchQuery", () => {
  it("delegates to static fetchQuery with this.link.href", () => {
    // The link href from sampleInvoiceWithRelationTemplates is the relative path.
    const RELATION_HREF = "/invoices/inv-001/supplier";
    const rel = makeSupplierRelation();
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeSupplierProfile();
    const opts = rel.fetchQuery(apiFetch, targetProfile);
    // queryKey must use the link href, not the full absolute URL constant
    expect(opts.queryKey).toEqual(queryKeys.toOneRelation.byUrl(targetProfile, RELATION_HREF));
  });
});

// ─── Constructor property access tests ───────────────────────────────────────

describe("EntityItemToOneRelation — properties", () => {
  it("exposes name", () => {
    const rel = makeSupplierRelation();
    expect(rel.name).toBe("supplier");
  });

  it("exposes link href (relative path from fixture)", () => {
    const rel = makeSupplierRelation();
    expect(rel.link.href).toBe("/invoices/inv-001/supplier");
  });

  it("exposes profileRelation", () => {
    const rel = makeSupplierRelation();
    expect(rel.profileRelation.name).toBe("supplier");
    expect(rel.profileRelation.isToOne).toBe(true);
  });

  it("exposes source item", () => {
    const rel = makeSupplierRelation();
    expect(rel.source).toBeInstanceOf(EntityItem);
    expect(rel.source.id).toBe("inv-001");
  });
});
