import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import {
  invoiceAddLineItemTemplate,
  invoiceProfileBodyWithRelations,
  sampleInvoiceWithRelationTemplates,
  sampleLineItemList,
} from "../../test-fixtures/hal/fixtures";
import { createListHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { cgRels } from "../api";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { EntityItem } from "./entity-item";
import { EntityItemCollection } from "./entity-item-collection";
import { EntityItemToManyRelation } from "./entity-item-to-many-relation";
import ProfileEntity from "./entity-profile";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const LINE_ITEM_URL_1 = "https://api.example.com/line-items/li-001";
const LINE_ITEM_URL_2 = "https://api.example.com/line-items/li-002";
const LINE_ITEMS_REL_URL = "https://api.example.com/invoices/inv-001/lineItems";
const CLEAR_LINE_ITEMS_TMPL = {
  method: "DELETE",
  target: LINE_ITEMS_REL_URL,
  properties: [],
};

/**
 * Like `invoiceAddLineItemTemplate` but with an absolute `target` URL so the
 * HAL-FORMS codec can build a valid `Request` (the codec requires an absolute URL).
 * The shared fixture uses a relative path; request-builder tests need absolute.
 */
const ADD_LINE_ITEM_TMPL_ABS = {
  ...invoiceAddLineItemTemplate,
  target: LINE_ITEMS_REL_URL,
} as const;

function makeProfileEntityWithRelations(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    invoiceProfileBodyWithRelations as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: "/profile/invoices", name: "invoice" } as unknown as Link, hal);
}

function makeLineItemProfileEntity(): ProfileEntity {
  const json: Record<string, unknown> = {
    name: "lineItem",
    description: "",
    _links: {
      self: { href: "/profile/line-items" },
      describes: [
        { href: "/line-items", name: "collection" },
        { href: "/line-items/{id}", name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject<ProfileEntityShape>(
    json as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: "/profile/line-items", name: "lineItem" } as unknown as Link,
    hal,
  );
}

/**
 * Build an EntityItem that has the cg:relation navigation links for supplier and lineItems,
 * but only the HAL-FORMS templates explicitly provided in `templates`.
 * This isolates each test from the default templates in sampleInvoiceWithRelationTemplates.
 */
function makeEntityItemWithRelationTemplates(
  templates: Record<string, unknown> = {},
  etag: string | null = '"v1"',
): EntityItem {
  const body = {
    ...sampleInvoiceWithRelationTemplates,
    // Use ONLY the provided templates — do not inherit the fixture defaults.
    _templates: templates,
  };
  const hal = new HalObject<EntityItemShape>(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, makeProfileEntityWithRelations(), etag);
}

/** Build a to-many relation instance from an EntityItem by name. */
function makeToManyRelation(
  item: EntityItem,
  name: string = "lineItems",
): EntityItemToManyRelation {
  const profileRelation = item.profileEntity.getRelation(name)!;
  const link = item.halItem.links.findLink(cgRels.relation, name)!;
  return new EntityItemToManyRelation(name, link, profileRelation, item);
}

// ─── addTemplate getter ───────────────────────────────────────────────────────

describe("EntityItemToManyRelation — addTemplate", () => {
  it("returns the add-<rel> template when present", () => {
    const item = makeEntityItemWithRelationTemplates({
      "add-lineItems": invoiceAddLineItemTemplate,
    });
    const rel = makeToManyRelation(item);
    expect(rel.addTemplate).not.toBeNull();
  });

  it("returns null when add-<rel> template is absent", () => {
    const item = makeEntityItemWithRelationTemplates();
    const rel = makeToManyRelation(item);
    expect(rel.addTemplate).toBeNull();
  });
});

// ─── clearTemplate getter ─────────────────────────────────────────────────────

describe("EntityItemToManyRelation — clearTemplate", () => {
  it("returns the clear-<rel> template when present", () => {
    const item = makeEntityItemWithRelationTemplates({
      "clear-lineItems": CLEAR_LINE_ITEMS_TMPL,
    });
    const rel = makeToManyRelation(item);
    expect(rel.clearTemplate).not.toBeNull();
  });

  it("returns null when clear-<rel> template is absent", () => {
    const item = makeEntityItemWithRelationTemplates();
    const rel = makeToManyRelation(item);
    expect(rel.clearTemplate).toBeNull();
  });
});

// ─── canAdd / canClear flags ──────────────────────────────────────────────────

describe("EntityItemToManyRelation — canAdd", () => {
  it("returns true when add-<rel> template is present", () => {
    const item = makeEntityItemWithRelationTemplates({
      "add-lineItems": invoiceAddLineItemTemplate,
    });
    expect(makeToManyRelation(item).canAdd).toBe(true);
  });

  it("returns false when add-<rel> template is absent", () => {
    const item = makeEntityItemWithRelationTemplates();
    expect(makeToManyRelation(item).canAdd).toBe(false);
  });
});

describe("EntityItemToManyRelation — canClear", () => {
  it("returns true when clear-<rel> template is present", () => {
    const item = makeEntityItemWithRelationTemplates({
      "clear-lineItems": CLEAR_LINE_ITEMS_TMPL,
    });
    expect(makeToManyRelation(item).canClear).toBe(true);
  });

  it("returns false when clear-<rel> template is absent", () => {
    const item = makeEntityItemWithRelationTemplates();
    expect(makeToManyRelation(item).canClear).toBe(false);
  });
});

// ─── addRelationRequest ───────────────────────────────────────────────────────

describe("EntityItemToManyRelation — addRelationRequest", () => {
  it("returns a POST request with text/uri-list containing all target hrefs", async () => {
    const item = makeEntityItemWithRelationTemplates({
      "add-lineItems": ADD_LINE_ITEM_TMPL_ABS,
    });
    const rel = makeToManyRelation(item);
    const req = rel.addRelationRequest([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("POST");
    expect(req.headers.get("Content-Type")).toContain("text/uri-list");
    const body = await req.text();
    expect(body).toContain(LINE_ITEM_URL_1);
    expect(body).toContain(LINE_ITEM_URL_2);
  });

  it("throws when add-<rel> template is absent (ABAC deny)", () => {
    const item = makeEntityItemWithRelationTemplates();
    const rel = makeToManyRelation(item);
    expect(() => rel.addRelationRequest([LINE_ITEM_URL_1])).toThrow(/template absent/);
  });

  it("does NOT attach If-Match (that is the mutation hook's responsibility)", async () => {
    const item = makeEntityItemWithRelationTemplates({
      "add-lineItems": ADD_LINE_ITEM_TMPL_ABS,
    });
    const rel = makeToManyRelation(item);
    const req = rel.addRelationRequest([LINE_ITEM_URL_1]);
    // The builder must not attach If-Match; the mutation base does that from source.etag
    expect(req.headers.get("If-Match")).toBeNull();
  });

  it("throws a clear error when add template has no properties", () => {
    const templateWithNoProps = {
      method: "POST",
      target: LINE_ITEMS_REL_URL,
      contentType: "text/uri-list",
      properties: [],
    };
    const item = makeEntityItemWithRelationTemplates({ "add-lineItems": templateWithNoProps });
    const rel = makeToManyRelation(item);
    expect(() => rel.addRelationRequest([LINE_ITEM_URL_1])).toThrow(/no properties/);
  });
});

// ─── clearRelationRequest ─────────────────────────────────────────────────────

describe("EntityItemToManyRelation — clearRelationRequest", () => {
  it("returns a DELETE request", () => {
    const item = makeEntityItemWithRelationTemplates({
      "clear-lineItems": CLEAR_LINE_ITEMS_TMPL,
    });
    const rel = makeToManyRelation(item);
    const req = rel.clearRelationRequest();
    expect(req).toBeInstanceOf(Request);
    expect(req.method).toBe("DELETE");
  });

  it("target URL comes from the template", () => {
    const item = makeEntityItemWithRelationTemplates({
      "clear-lineItems": CLEAR_LINE_ITEMS_TMPL,
    });
    const rel = makeToManyRelation(item);
    const req = rel.clearRelationRequest();
    expect(req.url).toBe(CLEAR_LINE_ITEMS_TMPL.target);
  });

  it("throws when clear-<rel> template is absent (ABAC deny)", () => {
    const item = makeEntityItemWithRelationTemplates();
    const rel = makeToManyRelation(item);
    expect(() => rel.clearRelationRequest()).toThrow(/template absent/);
  });

  it("does NOT attach If-Match (that is the mutation hook's responsibility)", () => {
    const item = makeEntityItemWithRelationTemplates({
      "clear-lineItems": CLEAR_LINE_ITEMS_TMPL,
    });
    const rel = makeToManyRelation(item);
    const req = rel.clearRelationRequest();
    expect(req.headers.get("If-Match")).toBeNull();
  });
});

// ─── static fetchQuery ────────────────────────────────────────────────────────

describe("EntityItemToManyRelation.fetchQuery — static", () => {
  const ABS_LINE_ITEMS_URL = "https://api.example.com/invoices/inv-001/lineItems";

  it("returns query options keyed under toManyRelation.byUrl", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = EntityItemToManyRelation.fetchQuery(apiFetch, ABS_LINE_ITEMS_URL, targetProfile);
    expect(opts.queryKey).toEqual(
      queryKeys.toManyRelation.byUrl(targetProfile, ABS_LINE_ITEMS_URL),
    );
  });

  it("queryKey differs from entityItemCollection.byUrl for the same url", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = EntityItemToManyRelation.fetchQuery(apiFetch, ABS_LINE_ITEMS_URL, targetProfile);
    const collectionKey = queryKeys.entityItemCollection.byUrl(targetProfile, ABS_LINE_ITEMS_URL);
    expect(opts.queryKey).not.toEqual(collectionKey);
  });

  it("applies override options (e.g. staleTime)", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = EntityItemToManyRelation.fetchQuery(apiFetch, ABS_LINE_ITEMS_URL, targetProfile, {
      staleTime: 9999,
    });
    expect(opts.staleTime).toBe(9999);
  });

  it("override does not overwrite toManyRelation queryKey", () => {
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = EntityItemToManyRelation.fetchQuery(
      apiFetch,
      ABS_LINE_ITEMS_URL,
      targetProfile,
      // Cast via unknown so TS excess-property check does not block the queryKey field;
      // the test intentionally verifies our namespace key wins over a caller-supplied one.
      { queryKey: ["custom", "key"] } as unknown as QueryOptionsOverride<
        EntityItemCollection,
        Error
      >,
    );
    // Our to-many namespace key always wins
    expect(opts.queryKey).toEqual(
      queryKeys.toManyRelation.byUrl(targetProfile, ABS_LINE_ITEMS_URL),
    );
  });

  it("queryFn fetches and returns an EntityItemCollection", async () => {
    server.use(
      createListHandler({
        url: ABS_LINE_ITEMS_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );
    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = EntityItemToManyRelation.fetchQuery(apiFetch, ABS_LINE_ITEMS_URL, targetProfile);
    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeInstanceOf(EntityItemCollection);
    expect(result.items).toHaveLength(2);
  });
});

// ─── instance fetchQuery ──────────────────────────────────────────────────────

describe("EntityItemToManyRelation — instance fetchQuery", () => {
  const ABS_LINE_ITEMS_URL = "https://api.example.com/invoices/inv-001/lineItems";

  it("delegates to the static factory using this.link.href", async () => {
    server.use(
      createListHandler({
        url: ABS_LINE_ITEMS_URL,
        items: sampleLineItemList._embedded!.item as Record<string, unknown>[],
      }),
    );
    const item = makeEntityItemWithRelationTemplates(
      { "add-lineItems": invoiceAddLineItemTemplate },
      '"v1"',
    );

    // Build a relation with an absolute link href for the MSW handler to intercept
    const profileRelation = item.profileEntity.getRelation("lineItems")!;
    const link: Link = { href: ABS_LINE_ITEMS_URL, name: "lineItems" } as unknown as Link;
    const rel = new EntityItemToManyRelation("lineItems", link, profileRelation, item);

    const apiFetch = createApiClient(noopSupplier);
    const targetProfile = makeLineItemProfileEntity();
    const opts = rel.fetchQuery(apiFetch, targetProfile);

    expect(opts.queryKey).toEqual(
      queryKeys.toManyRelation.byUrl(targetProfile, ABS_LINE_ITEMS_URL),
    );

    const result = await opts.queryFn!({
      queryKey: opts.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    } as unknown as Parameters<NonNullable<typeof opts.queryFn>>[0]);
    expect(result).toBeInstanceOf(EntityItemCollection);
    expect(result.items).toHaveLength(2);
  });
});

// ─── constructor properties ───────────────────────────────────────────────────

describe("EntityItemToManyRelation — constructor properties", () => {
  it("exposes name, link, profileRelation, and source", () => {
    const item = makeEntityItemWithRelationTemplates();
    const rel = makeToManyRelation(item);
    expect(rel.name).toBe("lineItems");
    expect(rel.link.href).toBe("/invoices/inv-001/lineItems");
    expect(rel.profileRelation.name).toBe("lineItems");
    expect(rel.source).toBe(item);
  });

  it("source.etag is accessible (used by mutation hooks for If-Match)", () => {
    const item = makeEntityItemWithRelationTemplates({}, '"v2"');
    const rel = makeToManyRelation(item);
    expect(rel.source.etag).toBe('"v2"');
  });
});
