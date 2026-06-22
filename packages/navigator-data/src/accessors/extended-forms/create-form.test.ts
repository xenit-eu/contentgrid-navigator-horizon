/**
 * Unit tests for CreateHalFormTemplate.
 *
 * Tests cover:
 * - userDefinedProperties: filters out url-type, links profileAttribute, isContent, isRequired, allowedValues
 * - contentProperties: derived from userDefinedProperties where isContent is true
 * - toOneRelationProperties: url with maxItems===1, isRequired, targetCollectionHref
 * - toManyRelationProperties: url with maxItems !== 1, targetCollectionHref
 * - relationProperties: union of toOne + toMany
 * - allProperties: union of all
 * - getPropertyByName
 * - getRequiredProperties
 * - target profile resolution via allProfiles
 */
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { ProfileEntityShape } from "../../shapes";
import ProfileEntity from "../entity-profile";
import { CreateHalFormTemplate } from "./create-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfileEntity(
  json: Record<string, unknown>,
  linkHref: string,
  linkName: string,
): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: linkHref, name: linkName } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

// ---------------------------------------------------------------------------
// Rich entity fixture with attributes, content fields, and relations
// ---------------------------------------------------------------------------

const ORDER_PROFILE_URL = "https://example.com/profile/orders";

const orderProfileJson = {
  name: "order",
  description: "",
  _links: {
    self: { href: ORDER_PROFILE_URL },
    describes: [
      { href: "https://example.com/orders", name: "collection" },
      { href: "https://example.com/orders/{id}", name: "item", templated: true },
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
        name: "order_number",
        title: "Order number",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [{ type: "required" }],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "status",
        title: "Status",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [
            { type: "allowed-values", values: ["pending", "shipped", "delivered"] },
          ],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "document",
        title: "Document",
        type: "object",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          // non-empty embedded blueprint:attribute signals content type
          "blueprint:attribute": [
            {
              name: "filename",
              title: "Filename",
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
        },
        _links: {},
      },
    ],
    "blueprint:relation": [
      {
        name: "customer",
        title: "Customer",
        description: "",
        many_source_per_target: true,
        many_target_per_source: false,
        required: true,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/customers" } },
      },
      {
        name: "products",
        title: "Products",
        description: "",
        many_source_per_target: true,
        many_target_per_source: true,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/products" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/orders", properties: [] },
    search: { method: "GET", target: "https://example.com/orders", properties: [] },
    "create-form": {
      method: "POST",
      target: "https://example.com/orders",
      contentType: "multipart/form-data",
      properties: [
        { name: "order_number", type: "text", required: true },
        { name: "status", type: "text" },
        { name: "document", type: "file" },
        {
          name: "customer",
          type: "url",
          required: true,
          options: {
            link: { href: "https://example.com/customers", title: "Customers" },
            maxItems: 1,
            valueField: "/_links/self/href",
          },
        },
        {
          name: "products",
          type: "url",
          options: {
            link: { href: "https://example.com/products", title: "Products" },
            minItems: 0,
            valueField: "/_links/self/href",
          },
        },
      ],
    },
  },
};

function makeCreateTemplate(profileJson = orderProfileJson, allProfiles?: ProfileEntity[]) {
  const profile = makeProfileEntity(profileJson, ORDER_PROFILE_URL, "order");
  const rawTemplate = resolveTemplate(profileJson as ProfileEntityShape, "create-form")!;
  return new CreateHalFormTemplate(rawTemplate, profile, allProfiles);
}

// ---------------------------------------------------------------------------
// userDefinedProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.userDefinedProperties", () => {
  it("excludes url-type properties", () => {
    const tmpl = makeCreateTemplate();
    const names = tmpl.userDefinedProperties.map((p) => p.property.name);
    expect(names).not.toContain("customer");
    expect(names).not.toContain("products");
  });

  it("includes non-url attribute properties", () => {
    const tmpl = makeCreateTemplate();
    const names = tmpl.userDefinedProperties.map((p) => p.property.name);
    expect(names).toContain("order_number");
    expect(names).toContain("status");
    expect(names).toContain("document");
  });

  it("links profileAttribute for named attributes", () => {
    const tmpl = makeCreateTemplate();
    const orderNumber = tmpl.userDefinedProperties.find((p) => p.property.name === "order_number");
    expect(orderNumber?.profileAttribute?.name).toBe("order_number");
  });

  it("isRequired is true for required properties", () => {
    const tmpl = makeCreateTemplate();
    const orderNumber = tmpl.userDefinedProperties.find((p) => p.property.name === "order_number");
    expect(orderNumber?.isRequired).toBe(true);
  });

  it("isRequired is false for non-required properties", () => {
    const tmpl = makeCreateTemplate();
    const status = tmpl.userDefinedProperties.find((p) => p.property.name === "status");
    expect(status?.isRequired).toBe(false);
  });

  it("isContent is true for file-type property", () => {
    const tmpl = makeCreateTemplate();
    const document = tmpl.userDefinedProperties.find((p) => p.property.name === "document");
    expect(document?.isContent).toBe(true);
  });

  it("isContent is false for regular text property", () => {
    const tmpl = makeCreateTemplate();
    const orderNumber = tmpl.userDefinedProperties.find((p) => p.property.name === "order_number");
    expect(orderNumber?.isContent).toBe(false);
  });

  it("extracts allowedValues from inline options", () => {
    // Build a profile with inline allowed values
    const profileWithInline = {
      ...orderProfileJson,
      _templates: {
        ...orderProfileJson._templates,
        "create-form": {
          method: "POST",
          target: "https://example.com/orders",
          contentType: "application/json",
          properties: [
            {
              name: "status",
              type: "text",
              options: {
                maxItems: 1,
                inline: ["pending", "shipped", "delivered"],
              },
            },
          ],
        },
      },
    };
    const profile = makeProfileEntity(profileWithInline, ORDER_PROFILE_URL, "order");
    const rawTemplate = resolveTemplate(profileWithInline as ProfileEntityShape, "create-form")!;
    const tmpl = new CreateHalFormTemplate(rawTemplate, profile);
    const status = tmpl.userDefinedProperties.find((p) => p.property.name === "status");
    expect(status?.allowedValues).toEqual(["pending", "shipped", "delivered"]);
  });

  it("allowedValues is undefined when no inline options", () => {
    const tmpl = makeCreateTemplate();
    const orderNumber = tmpl.userDefinedProperties.find((p) => p.property.name === "order_number");
    expect(orderNumber?.allowedValues).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// contentProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.contentProperties", () => {
  it("returns only content properties", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.contentProperties).toHaveLength(1);
    expect(tmpl.contentProperties[0].property.name).toBe("document");
  });

  it("isContent is true on all returned properties", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.contentProperties.every((p) => p.isContent)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toOneRelationProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.toOneRelationProperties", () => {
  it("returns only url properties with maxItems===1", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toOneRelationProperties).toHaveLength(1);
    expect(tmpl.toOneRelationProperties[0].property.name).toBe("customer");
  });

  it("isRequired is true for required to-one relations", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toOneRelationProperties[0].isRequired).toBe(true);
  });

  it("links targetCollectionHref from options.link.href", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toOneRelationProperties[0].targetCollectionHref).toBe(
      "https://example.com/customers",
    );
  });

  it("links profileRelation for to-one relation", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toOneRelationProperties[0].profileRelation?.name).toBe("customer");
  });

  it("targetCollectionHref falls back to empty string when no options.link", () => {
    const profileNoLink = {
      ...orderProfileJson,
      _templates: {
        ...orderProfileJson._templates,
        "create-form": {
          method: "POST",
          target: "https://example.com/orders",
          contentType: "application/json",
          properties: [
            {
              name: "customer",
              type: "url",
              options: { maxItems: 1 },
            },
          ],
        },
      },
    };
    const profile = makeProfileEntity(profileNoLink, ORDER_PROFILE_URL, "order");
    const rawTemplate = resolveTemplate(profileNoLink as ProfileEntityShape, "create-form")!;
    const tmpl = new CreateHalFormTemplate(rawTemplate, profile);
    expect(tmpl.toOneRelationProperties[0].targetCollectionHref).toBe("");
  });
});

// ---------------------------------------------------------------------------
// toManyRelationProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.toManyRelationProperties", () => {
  it("returns url properties without maxItems===1", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toManyRelationProperties).toHaveLength(1);
    expect(tmpl.toManyRelationProperties[0].property.name).toBe("products");
  });

  it("links targetCollectionHref from options.link.href", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toManyRelationProperties[0].targetCollectionHref).toBe(
      "https://example.com/products",
    );
  });

  it("links profileRelation for to-many relation", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.toManyRelationProperties[0].profileRelation?.name).toBe("products");
  });
});

// ---------------------------------------------------------------------------
// relationProperties / allProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.relationProperties", () => {
  it("returns all relations (to-one + to-many)", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.relationProperties).toHaveLength(2);
    const names = tmpl.relationProperties.map((p) => p.property.name);
    expect(names).toContain("customer");
    expect(names).toContain("products");
  });
});

describe("CreateHalFormTemplate.allProperties", () => {
  it("returns user-defined + all relations", () => {
    const tmpl = makeCreateTemplate();
    // order_number, status, document + customer, products = 5
    expect(tmpl.allProperties).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// getPropertyByName
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.getPropertyByName", () => {
  it("finds a user-defined attribute property by name", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.getPropertyByName("order_number")?.property.name).toBe("order_number");
  });

  it("finds a to-one relation property by name", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.getPropertyByName("customer")?.property.name).toBe("customer");
  });

  it("finds a to-many relation property by name", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.getPropertyByName("products")?.property.name).toBe("products");
  });

  it("returns undefined for unknown property name", () => {
    const tmpl = makeCreateTemplate();
    expect(tmpl.getPropertyByName("nonexistent")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRequiredProperties
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate.getRequiredProperties", () => {
  it("returns required user-defined attributes", () => {
    const tmpl = makeCreateTemplate();
    const names = tmpl.getRequiredProperties().map((p) => p.property.name);
    expect(names).toContain("order_number");
  });

  it("returns required to-one relations", () => {
    const tmpl = makeCreateTemplate();
    const names = tmpl.getRequiredProperties().map((p) => p.property.name);
    expect(names).toContain("customer");
  });

  it("does not return non-required properties", () => {
    const tmpl = makeCreateTemplate();
    const names = tmpl.getRequiredProperties().map((p) => p.property.name);
    expect(names).not.toContain("status");
    expect(names).not.toContain("products");
    expect(names).not.toContain("document");
  });
});

// ---------------------------------------------------------------------------
// allProfiles target profile resolution
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate target profile resolution via allProfiles", () => {
  it("resolves targetProfile for to-one relation when allProfiles is provided", () => {
    const customerProfileJson = {
      name: "customer",
      description: "",
      _links: {
        self: { href: "https://example.com/profile/customers" },
        describes: [
          { href: "https://example.com/customers", name: "collection" },
          { href: "https://example.com/customers/{id}", name: "item", templated: true },
        ],
      },
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
        ],
        "blueprint:relation": [],
      },
      _templates: {
        default: { method: "HEAD", target: "https://example.com/customers", properties: [] },
      },
    };
    const customerProfile = makeProfileEntity(
      customerProfileJson,
      "https://example.com/profile/customers",
      "customer",
    );
    const tmpl = makeCreateTemplate(orderProfileJson, [customerProfile]);

    const customerProp = tmpl.toOneRelationProperties.find((p) => p.property.name === "customer");
    expect(customerProp?.targetProfile).toBeDefined();
    expect(customerProp?.targetProfile?.name).toBe("customer");
  });

  it("targetProfile is undefined when allProfiles does not have matching profile", () => {
    const tmpl = makeCreateTemplate(); // no allProfiles
    const customerProp = tmpl.toOneRelationProperties.find((p) => p.property.name === "customer");
    expect(customerProp?.targetProfile).toBeUndefined();
  });

  it("resolves targetProfile for to-many relation when allProfiles is provided", () => {
    const productProfileJson = {
      name: "product",
      description: "",
      _links: {
        self: { href: "https://example.com/profile/products" },
        describes: [
          { href: "https://example.com/products", name: "collection" },
          { href: "https://example.com/products/{id}", name: "item", templated: true },
        ],
      },
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
        ],
        "blueprint:relation": [],
      },
      _templates: {
        default: { method: "HEAD", target: "https://example.com/products", properties: [] },
      },
    };
    const productProfile = makeProfileEntity(
      productProfileJson,
      "https://example.com/profile/products",
      "product",
    );
    const tmpl = makeCreateTemplate(orderProfileJson, [productProfile]);

    const productsProp = tmpl.toManyRelationProperties.find((p) => p.property.name === "products");
    expect(productsProp?.targetProfile?.name).toBe("product");
  });
});

// ---------------------------------------------------------------------------
// Empty template (no properties)
// ---------------------------------------------------------------------------

describe("CreateHalFormTemplate with empty create-form", () => {
  it("returns empty arrays when template has no properties", () => {
    const emptyProfile = {
      ...orderProfileJson,
      _templates: {
        ...orderProfileJson._templates,
        "create-form": {
          method: "POST",
          target: "https://example.com/orders",
          contentType: "application/json",
          properties: [],
        },
      },
    };
    const profile = makeProfileEntity(emptyProfile, ORDER_PROFILE_URL, "order");
    const rawTemplate = resolveTemplate(emptyProfile as ProfileEntityShape, "create-form")!;
    const tmpl = new CreateHalFormTemplate(rawTemplate, profile);
    expect(tmpl.userDefinedProperties).toHaveLength(0);
    expect(tmpl.toOneRelationProperties).toHaveLength(0);
    expect(tmpl.toManyRelationProperties).toHaveLength(0);
    expect(tmpl.allProperties).toHaveLength(0);
    expect(tmpl.getRequiredProperties()).toHaveLength(0);
  });
});
