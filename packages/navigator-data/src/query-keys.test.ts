import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import ProfileEntity from "./accessors/entity-profile";
import { queryKeys } from "./query-keys";
import type { ProfileEntityShape } from "./shapes";

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

function makeProfileEntity(name: string, profileHref: string): ProfileEntity {
  const json: HalObjectShape<ProfileEntityShape> = {
    name,
    description: "",
    _links: {
      self: { href: profileHref },
      describes: [
        { href: `/${name}s`, name: "collection" },
        { href: `/${name}s/{id}`, name: "item", templated: true },
      ],
    },
  } as unknown as HalObjectShape<ProfileEntityShape>;
  const hal = new HalObject<ProfileEntityShape>(json);
  return new ProfileEntity({ href: profileHref, name } as unknown as Link, hal);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("queryKeys.entityItem", () => {
  const profile = makeProfileEntity("invoice", "/profile/invoices");

  it("forEntity returns prefix key with entity name", () => {
    const key = queryKeys.entityItem.forEntity(profile);
    expect(key).toEqual(["EntityItem", "invoice"]);
  });

  it("byUrl returns key including entity name and URL", () => {
    const key = queryKeys.entityItem.byUrl(profile, "/invoices/inv-001");
    expect(key).toEqual(["EntityItem", "invoice", "/invoices/inv-001"]);
  });

  it("forEntity key is a prefix of byUrl key", () => {
    const prefix = queryKeys.entityItem.forEntity(profile);
    const full = queryKeys.entityItem.byUrl(profile, "/invoices/inv-001");
    expect(full.slice(0, prefix.length)).toEqual([...prefix]);
  });
});

describe("queryKeys.entityItemCollection", () => {
  const profile = makeProfileEntity("invoice", "/profile/invoices");

  it("all returns a single-element array", () => {
    expect(queryKeys.entityItemCollection.all()).toEqual(["EntitySearch"]);
  });

  it("forEntity returns prefix key with entity name", () => {
    const key = queryKeys.entityItemCollection.forEntity(profile);
    expect(key).toEqual(["EntitySearch", "invoice"]);
  });

  it("byUrl returns key including entity name and URL", () => {
    const key = queryKeys.entityItemCollection.byUrl(profile, "/invoices?status=pending");
    expect(key).toEqual(["EntitySearch", "invoice", "/invoices?status=pending"]);
  });

  it("infiniteByUrl appends 'infinite' discriminator", () => {
    const key = queryKeys.entityItemCollection.infiniteByUrl(profile, "/invoices");
    expect(key).toEqual(["EntitySearch", "invoice", "/invoices", "infinite"]);
  });

  it("forEntity is a prefix of both byUrl and infiniteByUrl", () => {
    const prefix = queryKeys.entityItemCollection.forEntity(profile);
    const paged = queryKeys.entityItemCollection.byUrl(profile, "/invoices");
    const infinite = queryKeys.entityItemCollection.infiniteByUrl(profile, "/invoices");
    expect(paged.slice(0, prefix.length)).toEqual([...prefix]);
    expect(infinite.slice(0, prefix.length)).toEqual([...prefix]);
  });

  it("all is a prefix of forEntity key", () => {
    const all = queryKeys.entityItemCollection.all();
    const forEntity = queryKeys.entityItemCollection.forEntity(profile);
    expect(forEntity.slice(0, all.length)).toEqual([...all]);
  });
});

describe("queryKeys.entityProfile", () => {
  it("all returns single-element array", () => {
    expect(queryKeys.entityProfile.all()).toEqual(["ProfileEntity"]);
  });

  it("byLink returns key with link name and href", () => {
    const key = queryKeys.entityProfile.byLink({
      href: "/profile/invoices",
      name: "invoice",
    } as unknown as Link);
    expect(key).toEqual(["ProfileEntity", "invoice", "/profile/invoices"]);
  });

  it("byLink works with a link without a name (undefined)", () => {
    const key = queryKeys.entityProfile.byLink({ href: "/profile/invoices" } as unknown as Link);
    expect(key).toEqual(["ProfileEntity", undefined, "/profile/invoices"]);
  });
});

describe("queryKeys.profileRoot", () => {
  it("byUrl returns key with URL", () => {
    const key = queryKeys.profileRoot.byUrl("/profile");
    expect(key).toEqual(["ProfileRoot", "/profile"]);
  });

  it("different URLs produce different keys", () => {
    const key1 = queryKeys.profileRoot.byUrl("https://app1.example.com/profile");
    const key2 = queryKeys.profileRoot.byUrl("https://app2.example.com/profile");
    expect(key1).not.toEqual(key2);
  });
});

describe("queryKeys.toOneRelation", () => {
  it("forRelationName returns prefix key with relation name", () => {
    const key = queryKeys.toOneRelation.forRelationName("supplier");
    expect(key).toEqual(["ToOneRelation", "supplier"]);
  });

  it("byUrl returns key including relation name and URL", () => {
    const key = queryKeys.toOneRelation.byUrl("supplier", "/invoices/inv-001/supplier");
    expect(key).toEqual(["ToOneRelation", "supplier", "/invoices/inv-001/supplier"]);
  });

  it("forRelationName key is a prefix of byUrl key", () => {
    const prefix = queryKeys.toOneRelation.forRelationName("supplier");
    const full = queryKeys.toOneRelation.byUrl("supplier", "/invoices/inv-001/supplier");
    expect(full.slice(0, prefix.length)).toEqual([...prefix]);
  });

  it("different URLs produce different byUrl keys", () => {
    const key1 = queryKeys.toOneRelation.byUrl("supplier", "/invoices/inv-001/supplier");
    const key2 = queryKeys.toOneRelation.byUrl("supplier", "/invoices/inv-002/supplier");
    expect(key1).not.toEqual(key2);
  });

  it("root string does not collide with entityItem namespace", () => {
    const profile = makeProfileEntity("supplier", "/profile/suppliers");
    const toOneKey = queryKeys.toOneRelation.forRelationName("supplier");
    const entityItemKey = queryKeys.entityItem.forEntity(profile);
    expect(toOneKey[0]).not.toEqual(entityItemKey[0]);
  });
});

describe("queryKeys.toManyRelation", () => {
  it("forRelationName returns prefix key with relation name", () => {
    const key = queryKeys.toManyRelation.forRelationName("lineItems");
    expect(key).toEqual(["ToManyRelation", "lineItems"]);
  });

  it("byUrl returns key including relation name and URL", () => {
    const key = queryKeys.toManyRelation.byUrl("lineItems", "/invoices/inv-001/lineItems");
    expect(key).toEqual(["ToManyRelation", "lineItems", "/invoices/inv-001/lineItems"]);
  });

  it("forRelationName key is a prefix of byUrl key", () => {
    const prefix = queryKeys.toManyRelation.forRelationName("lineItems");
    const full = queryKeys.toManyRelation.byUrl("lineItems", "/invoices/inv-001/lineItems");
    expect(full.slice(0, prefix.length)).toEqual([...prefix]);
  });

  it("different URLs produce different byUrl keys", () => {
    const key1 = queryKeys.toManyRelation.byUrl("lineItems", "/invoices/inv-001/lineItems");
    const key2 = queryKeys.toManyRelation.byUrl("lineItems", "/invoices/inv-002/lineItems");
    expect(key1).not.toEqual(key2);
  });

  it("root string does not collide with toOneRelation namespace", () => {
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const toOneKey = queryKeys.toOneRelation.forRelationName("lineItems");
    expect(toManyKey[0]).not.toEqual(toOneKey[0]);
  });

  it("root string does not collide with entityItem namespace", () => {
    const profile = makeProfileEntity("lineItem", "/profile/line-items");
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const entityItemKey = queryKeys.entityItem.forEntity(profile);
    expect(toManyKey[0]).not.toEqual(entityItemKey[0]);
  });
});
