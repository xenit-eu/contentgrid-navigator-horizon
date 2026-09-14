import { describe, expect, it } from "vitest";
import { HalObject, type Link, type SimpleLink } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import type { ProfileEntityShape } from "../shapes";
import ProfileEntity from "./entity-profile";

// ─── Link relation constants (full expanded URIs) ──────────────────────────────

const BLUEPRINT_ATTRIBUTE_REL = "https://contentgrid.cloud/rels/blueprint/attribute";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_CONSTRAINT_REL = "https://contentgrid.cloud/rels/blueprint/constraint";

// ─── Fixture builders ────────────────────────────────────────────────────────

function makeProfileEntityHal(
  overrides: {
    name?: string;
    description?: string;
    title?: string;
    collectionHref?: string;
    itemHref?: string;
    attributes?: Record<string, unknown>[];
    relations?: Record<string, unknown>[];
    templates?: Record<string, unknown>;
  } = {},
): HalObject<ProfileEntityShape> {
  const {
    name = "invoice",
    description = "Invoice entity",
    collectionHref = "/invoices",
    itemHref = "/invoices/{id}",
    attributes = [],
    relations = [],
    templates,
  } = overrides;

  const json: Record<string, unknown> = {
    name,
    description,
    _links: {
      self: { href: `/profile/${collectionHref.slice(1)}` },
      describes: [
        { href: collectionHref, name: "collection", title: "Invoices" },
        { href: itemHref, name: "item", templated: true },
      ],
    },
  };

  if (attributes.length > 0 || relations.length > 0) {
    const embedded: Record<string, unknown> = {};
    if (attributes.length > 0) embedded[BLUEPRINT_ATTRIBUTE_REL] = attributes;
    if (relations.length > 0) embedded[BLUEPRINT_RELATION_REL] = relations;
    json._embedded = embedded;
  }

  if (templates) {
    json._templates = templates;
  }

  return new HalObject<ProfileEntityShape>(json as unknown as HalObjectShape<ProfileEntityShape>);
}

function makeProfileEntity(
  overrides: Parameters<typeof makeProfileEntityHal>[0] = {},
): ProfileEntity {
  const hal = makeProfileEntityHal(overrides);
  return new ProfileEntity(
    { href: `/profile/invoices`, name: overrides.name ?? "invoice" } as unknown as Link,
    hal,
  );
}

function makeAuditConstraintAttr(name: string, constraintType: string) {
  return {
    name,
    type: "datetime",
    description: "",
    readonly: true,
    _embedded: {
      [BLUEPRINT_CONSTRAINT_REL]: [{ type: constraintType }],
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProfileEntity — basic properties", () => {
  it("returns name from link", () => {
    expect(makeProfileEntity().name).toBe("invoice");
  });

  it("returns title from link when set", () => {
    const hal = makeProfileEntityHal();
    const entity = new ProfileEntity(
      { href: "/profile/invoices", name: "invoice", title: "Invoice" } as unknown as Link,
      hal,
    );
    expect(entity.title).toBe("Invoice");
  });

  it("falls back to name when title is not set on link", () => {
    expect(makeProfileEntity().title).toBe("invoice");
  });

  it("returns description from profile data", () => {
    expect(makeProfileEntity({ description: "Invoice entity" }).description).toBe("Invoice entity");
  });

  it("returns singularName from profile data", () => {
    expect(makeProfileEntity({ name: "invoice" }).singularName).toBe("invoice");
  });

  it("returns pluralName from describes collection link title", () => {
    expect(makeProfileEntity().pluralName).toBe("Invoices");
  });

  it("falls back to title when no collection link with title", () => {
    // Construct entity without a title on the collection link
    const json: Record<string, unknown> = {
      name: "invoice",
      description: "",
      _links: {
        self: { href: "/profile/invoices" },
        describes: [
          { href: "/invoices", name: "collection" }, // no title
          { href: "/invoices/{id}", name: "item", templated: true },
        ],
      },
    };
    const hal = new HalObject<ProfileEntityShape>(
      json as unknown as HalObjectShape<ProfileEntityShape>,
    );
    const entity = new ProfileEntity(
      { href: "/profile/invoices", name: "invoice", title: "Invoices" } as unknown as Link,
      hal,
    );
    expect(entity.pluralName).toBe("Invoices");
  });
});

describe("ProfileEntity — collectionUrl and itemUrl", () => {
  it("collectionUrl returns the collection href", () => {
    expect(makeProfileEntity({ collectionHref: "/invoices" }).collectionUrl).toBe("/invoices");
  });

  it("itemUrl expands the URI template with the given id", () => {
    const entity = makeProfileEntity({ itemHref: "/invoices/{id}" });
    const url = entity.itemUrl("inv-001");
    expect(url).toBe("/invoices/inv-001");
  });

  it("collectionLink href matches collectionUrl", () => {
    const entity = makeProfileEntity();
    expect(entity.collectionLink.href).toBe(entity.collectionUrl);
  });
});

describe("ProfileEntity — attributes", () => {
  const entityWithAttrs = () =>
    makeProfileEntity({
      attributes: [
        { name: "id", type: "string", description: "", readonly: true },
        { name: "number", type: "string", description: "", readonly: false },
        { name: "total", type: "long", description: "", readonly: false },
        makeAuditConstraintAttr("created_at", "created-date"),
        makeAuditConstraintAttr("created_by", "created-by"),
        makeAuditConstraintAttr("modified_at", "modified-date"),
        makeAuditConstraintAttr("modified_by", "modified-by"),
      ],
    });

  it("returns all attributes", () => {
    expect(entityWithAttrs().attributes).toHaveLength(7);
  });

  it("getAttribute returns the matching attribute", () => {
    const attr = entityWithAttrs().getAttribute("number");
    expect(attr).toBeDefined();
    expect(attr!.name).toBe("number");
  });

  it("getAttribute returns undefined for unknown attribute", () => {
    expect(entityWithAttrs().getAttribute("nonexistent")).toBeUndefined();
  });

  it("idAttribute returns the id attribute", () => {
    expect(entityWithAttrs().idAttribute.name).toBe("id");
  });

  it("userDefinedAttributes excludes id and audit attributes", () => {
    const userAttrs = entityWithAttrs().userDefinedAttributes;
    const names = userAttrs.map((a) => a.name);
    expect(names).toContain("number");
    expect(names).toContain("total");
    expect(names).not.toContain("id");
    expect(names).not.toContain("created_at");
    expect(names).not.toContain("modified_at");
  });

  it("userDefinedAttributeNames is a Set for O(1) lookup", () => {
    const names = entityWithAttrs().userDefinedAttributeNames;
    expect(names).toBeInstanceOf(Set);
    expect(names.has("number")).toBe(true);
    expect(names.has("id")).toBe(false);
  });
});

describe("ProfileEntity — audit attributes", () => {
  const entityWithAudit = () =>
    makeProfileEntity({
      attributes: [
        { name: "id", type: "string", description: "", readonly: true },
        makeAuditConstraintAttr("created_at", "created-date"),
        makeAuditConstraintAttr("created_by", "created-by"),
        makeAuditConstraintAttr("modified_at", "modified-date"),
        makeAuditConstraintAttr("modified_by", "modified-by"),
      ],
    });

  it("createdAtAttribute returns attribute with created-date constraint", () => {
    expect(entityWithAudit().createdAtAttribute?.name).toBe("created_at");
  });

  it("createdByAttribute returns attribute with created-by constraint", () => {
    expect(entityWithAudit().createdByAttribute?.name).toBe("created_by");
  });

  it("modifiedAtAttribute returns attribute with modified-date constraint", () => {
    expect(entityWithAudit().modifiedAtAttribute?.name).toBe("modified_at");
  });

  it("modifiedByAttribute returns attribute with modified-by constraint", () => {
    expect(entityWithAudit().modifiedByAttribute?.name).toBe("modified_by");
  });

  it("auditAttributes contains all four audit fields", () => {
    const auditNames = entityWithAudit().auditAttributes.map((a) => a.name);
    expect(auditNames).toContain("created_at");
    expect(auditNames).toContain("created_by");
    expect(auditNames).toContain("modified_at");
    expect(auditNames).toContain("modified_by");
  });

  it("auditAttributeNames is a Set", () => {
    const auditNames = entityWithAudit().auditAttributeNames;
    expect(auditNames).toBeInstanceOf(Set);
    expect(auditNames.has("created_at")).toBe(true);
  });

  it("createdAtAttribute returns undefined when no audit attributes", () => {
    expect(makeProfileEntity().createdAtAttribute).toBeUndefined();
  });

  it("createdByAttribute returns undefined when no audit attributes", () => {
    expect(makeProfileEntity().createdByAttribute).toBeUndefined();
  });

  it("modifiedAtAttribute returns undefined when no audit attributes", () => {
    expect(makeProfileEntity().modifiedAtAttribute).toBeUndefined();
  });

  it("modifiedByAttribute returns undefined when no audit attributes", () => {
    expect(makeProfileEntity().modifiedByAttribute).toBeUndefined();
  });

  it("auditAttributes is empty when no audit constraints", () => {
    expect(makeProfileEntity().auditAttributes).toHaveLength(0);
  });
});

describe("ProfileEntity — relations", () => {
  const entityWithRelations = () =>
    makeProfileEntity({
      relations: [
        {
          name: "supplier",
          description: "",
          many_source_per_target: false,
          many_target_per_source: false,
          required: false,
        },
        {
          name: "line-items",
          description: "",
          many_source_per_target: false,
          many_target_per_source: true,
          required: false,
        },
      ],
    });

  it("returns all relations", () => {
    expect(entityWithRelations().relations).toHaveLength(2);
  });

  it("getRelation returns matching relation", () => {
    const rel = entityWithRelations().getRelation("supplier");
    expect(rel).toBeDefined();
    expect(rel!.name).toBe("supplier");
  });

  it("getRelation returns undefined for unknown relation", () => {
    expect(entityWithRelations().getRelation("nonexistent")).toBeUndefined();
  });

  it("toOneRelations filters to-one relations", () => {
    const toOne = entityWithRelations().toOneRelations;
    expect(toOne).toHaveLength(1);
    expect(toOne[0].name).toBe("supplier");
  });

  it("toManyRelations filters to-many relations", () => {
    const toMany = entityWithRelations().toManyRelations;
    expect(toMany).toHaveLength(1);
    expect(toMany[0].name).toBe("line-items");
  });

  it("relationNames is a Set", () => {
    const names = entityWithRelations().relationNames;
    expect(names).toBeInstanceOf(Set);
    expect(names.has("supplier")).toBe(true);
    expect(names.has("line-items")).toBe(true);
  });

  it("returns empty relations when none exist", () => {
    expect(makeProfileEntity().relations).toHaveLength(0);
  });
});

describe("ProfileEntity — describes()", () => {
  it("returns true when a link href matches the collection URL", () => {
    const entity = makeProfileEntity({ collectionHref: "/invoices" });
    expect(entity.describes({ href: "/invoices" } as unknown as SimpleLink)).toBe(true);
  });

  it("returns true when a link href matches the item template after stripping query string", () => {
    const entity = makeProfileEntity({ itemHref: "/invoices/{id}" });
    // The describes call strips the query string for template matching
    expect(entity.describes({ href: "/invoices/inv-001" } as unknown as SimpleLink)).toBe(true);
  });

  it("returns false when link href does not match", () => {
    const entity = makeProfileEntity({ collectionHref: "/invoices" });
    expect(entity.describes({ href: "/suppliers" } as unknown as SimpleLink)).toBe(false);
  });
});

describe("ProfileEntity — searchTemplate", () => {
  it("returns null when no search template in profile", () => {
    expect(makeProfileEntity().searchTemplate).toBeNull();
  });

  it("returns a SearchHalFormTemplate when search template is present", () => {
    const entity = makeProfileEntity({
      templates: {
        search: {
          method: "GET",
          target: "/invoices",
          properties: [{ name: "number", type: "text" }],
        },
      },
    });
    expect(entity.searchTemplate).not.toBeNull();
  });

  it("throws when searchEntityRequest is called without a search template", () => {
    expect(() => makeProfileEntity().searchEntityRequest({} as never)).toThrow();
  });
});

describe("ProfileEntity — createTemplate", () => {
  it("returns null when no create-form template in profile", () => {
    expect(makeProfileEntity().createTemplate).toBeNull();
  });

  it("returns a CreateHalFormTemplate when create-form template is present", () => {
    const entity = makeProfileEntity({
      templates: {
        "create-form": {
          method: "POST",
          target: "/invoices",
          contentType: "application/json",
          properties: [{ name: "number", type: "text", required: true }],
        },
      },
    });
    expect(entity.createTemplate).not.toBeNull();
  });

  it("throws when createEntityItemRequest is called without a create template", () => {
    expect(() => makeProfileEntity().createEntityItemRequest({} as never)).toThrow(
      "No create template available",
    );
  });
});
