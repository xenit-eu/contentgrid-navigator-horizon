/**
 * HAL contract tests (ADR-014).
 *
 * These tests parse known-good fixture objects against minimal Zod schemas that
 * mirror the fields this package actually depends on from the upstream
 * @contentgrid/hal and @contentgrid/hal-forms packages.
 *
 * If an upstream release changes a shape that we rely on (e.g. renames `_links`
 * or replaces `properties` with `fields`), the fixture will no longer match the
 * schema and the test will fail in CI — surfacing the breakage before it ships.
 *
 * Scope: covers HalObject (links + embedded), HalSlice (pagination + embedded
 * items), HAL-Forms create template (create-form), HAL-Forms update/default
 * template (default), and Phase 0.5 entity-profile fixtures (halforms/*.json).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  invoiceCreateTemplate,
  invoiceSearchTemplate,
  invoiceUpdateTemplate,
  sampleInvoice,
  sampleInvoiceList,
} from "./hal/fixtures";
import profileRootFixture from "./halforms/_profile-root.json";
// Phase 0.5 halforms entity-profile fixtures (ACC-2865 AC#4)
import allAttributeFixture from "./halforms/all-attribute.json";
import allRequiredFixture from "./halforms/all-required.json";
import createAllowedFixture from "./halforms/create-allowed.json";
import customerFixture from "./halforms/customer.json";
import employeeFixture from "./halforms/employee.json";
import emptyFixture from "./halforms/empty.json";
import manyRelationFixture from "./halforms/many-relation.json";
import notAllowedFixture from "./halforms/not-allowed.json";
import orderFixture from "./halforms/order.json";
import partiallyAllowedFixture from "./halforms/partially-allowed.json";
import productFixture from "./halforms/product.json";
import readAllowedFixture from "./halforms/read-allowed.json";
import relatedItemFixture from "./halforms/related-item.json";
import supplierFixture from "./halforms/supplier.json";
import updateAllowedFixture from "./halforms/update-allowed.json";

// ---------------------------------------------------------------------------
// Minimal Zod schemas — assert ONLY the fields we depend on.
// ---------------------------------------------------------------------------

/** Mirror of LinkShape: href is the only mandatory field we depend on. */
const LinkSchema = z.object({
  href: z.string(),
  name: z.string().optional(),
  templated: z.boolean().optional(),
  title: z.string().optional(),
});

/**
 * Mirror of HalObjectShape: _links is optional (may be absent on some resources)
 * but when present must be a record of link-or-array-of-links.
 */
const HalObjectSchema = z.object({
  _links: z.record(z.string(), z.union([LinkSchema, z.array(LinkSchema)])).optional(),
  _embedded: z
    .record(
      z.string(),
      z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]),
    )
    .optional(),
});

/**
 * Mirror of HalSliceShape: _embedded.item must be an array; _links must contain
 * at least a self link. page is platform-specific metadata we also depend on.
 */
const HalSliceSchema = z.object({
  _links: z
    .object({
      self: z.union([LinkSchema, z.array(LinkSchema)]),
      next: z.union([LinkSchema, z.array(LinkSchema)]).optional(),
      prev: z.union([LinkSchema, z.array(LinkSchema)]).optional(),
      first: z.union([LinkSchema, z.array(LinkSchema)]).optional(),
    })
    .optional(),
  _embedded: z
    .object({
      item: z.array(HalObjectSchema),
    })
    .optional(),
  page: z
    .object({
      size: z.number().optional(),
      total_items_exact: z.number().optional(),
      total_items_estimate: z.number().optional(),
    })
    .optional(),
});

/**
 * Mirror of HalFormsPropertyShape: name is mandatory; type, required, readOnly,
 * prompt are the fields we render/apply in forms. options covers relation fields
 * (options.link) and allowed-values constraints (options.inline).
 */
const HalFormsPropertySchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  // Real fixtures use "prompt" as the display label (not "title")
  prompt: z.string().optional(),
  title: z.string().optional(),
  // options covers relation link fields and allowed-values constraints
  options: z
    .object({
      link: z
        .object({
          href: z.string(),
          title: z.string().optional(),
        })
        .optional(),
      inline: z.array(z.unknown()).optional(),
      minItems: z.number().optional(),
      maxItems: z.number().optional(),
      promptField: z.string().optional(),
      valueField: z.string().optional(),
    })
    .optional(),
});

/**
 * Mirror of HalFormsTemplateShape: method and properties are the two fields
 * the navigator unconditionally reads when processing any template.
 */
const HalFormsTemplateSchema = z.object({
  method: z.string(),
  target: z.string().optional(),
  contentType: z.string().optional(),
  title: z.string().optional(),
  properties: z.array(HalFormsPropertySchema),
});

/**
 * Shape of a HAL-FORMS entity-profile response (GET /profile/<entity>).
 * Asserts the fields the navigator depends on: name, _links.self,
 * _links.describes (collection + item URLs), and _templates map.
 * _embedded is passthrough — we verify presence but not internal structure.
 */
const EntityProfileSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  _links: z.object({
    self: LinkSchema,
    // describes must contain at least collection and item URL entries
    describes: z.array(
      z.object({
        href: z.string(),
        name: z.string(),
        templated: z.boolean().optional(),
        title: z.string().optional(),
        profile: z.string().optional(),
      }),
    ),
  }),
  // _templates is a record of template key → template; standard keys include
  // "default", "create-form", "search", "delete"
  _templates: z.record(z.string(), HalFormsTemplateSchema),
  // _embedded present on all real fixtures; internal structure tested separately
  _embedded: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Shape of the HAL-FORMS profile-root response (GET /profile).
 * Asserts _links.self and the cg:entity array driving entity discovery.
 */
const ProfileRootSchema = z.object({
  _links: z.object({
    self: LinkSchema,
    "cg:entity": z.array(
      z.object({
        href: z.string(),
        name: z.string(),
        title: z.string().optional(),
      }),
    ),
  }),
  _templates: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Contract tests — parse known-good fixtures; expect success.
// ---------------------------------------------------------------------------

describe("HAL contract tests — upstream shape assertions (ADR-014)", () => {
  describe("HalObject shape", () => {
    it("sampleInvoice matches HalObjectSchema", () => {
      const result = HalObjectSchema.safeParse(sampleInvoice);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("sampleInvoice._links.self has an href", () => {
      const result = HalObjectSchema.safeParse(sampleInvoice);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data._links?.self).toMatchObject({ href: expect.any(String) });
      }
    });
  });

  describe("HalSlice shape", () => {
    it("sampleInvoiceList matches HalSliceSchema", () => {
      const result = HalSliceSchema.safeParse(sampleInvoiceList);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("sampleInvoiceList._embedded.item is an array", () => {
      const result = HalSliceSchema.safeParse(sampleInvoiceList);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data._embedded?.item)).toBe(true);
      }
    });
  });

  describe("HAL-Forms create-form template shape", () => {
    it("invoiceCreateTemplate matches HalFormsTemplateSchema", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceCreateTemplate);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("invoiceCreateTemplate has method POST and properties array", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceCreateTemplate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.method).toBe("POST");
        expect(Array.isArray(result.data.properties)).toBe(true);
        expect(result.data.properties.length).toBeGreaterThan(0);
      }
    });
  });

  describe("HAL-Forms search template shape", () => {
    it("invoiceSearchTemplate matches HalFormsTemplateSchema", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceSearchTemplate);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("invoiceSearchTemplate covers all documented blueprint:search-param operator names", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceSearchTemplate);
      expect(result.success).toBe(true);
      if (result.success) {
        const names = result.data.properties.map((p) => p.name);
        expect(names).toContain("number~prefix-match");
        expect(names).toContain("date~greater-than");
        expect(names).toContain("date~less-than");
        expect(names).toContain("date~greater-than-or-equal");
        expect(names).toContain("date~less-than-or-equal");
        expect(names).toContain("total.~from");
        expect(names).toContain("total.~until");
        // Guard: the -to suffix is not part of the documented vocabulary
        expect(names).not.toContain("date~greater-than-or-equal-to");
        expect(names).not.toContain("date~less-than-or-equal-to");
      }
    });
  });

  describe("HAL-Forms default (update) template shape", () => {
    it("invoiceUpdateTemplate matches HalFormsTemplateSchema", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceUpdateTemplate);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("invoiceUpdateTemplate has method PATCH and properties array", () => {
      const result = HalFormsTemplateSchema.safeParse(invoiceUpdateTemplate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.method).toBe("PATCH");
        expect(Array.isArray(result.data.properties)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Phase 0.5 entity-profile fixtures — table-driven positive contract tests
  // -------------------------------------------------------------------------

  describe("Phase 0.5 entity-profile fixtures (ADR-014 AC#4)", () => {
    it("_profile-root.json matches ProfileRootSchema", () => {
      const result = ProfileRootSchema.safeParse(profileRootFixture);
      expect(
        result.success,
        `Parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it("_profile-root.json has non-empty cg:entity list", () => {
      const result = ProfileRootSchema.safeParse(profileRootFixture);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data._links["cg:entity"].length).toBeGreaterThan(0);
      }
    });

    // Table-driven: one row per entity fixture file (15 fixtures)
    const entityFixtures: Array<[string, unknown]> = [
      ["all-attribute.json", allAttributeFixture],
      ["all-required.json", allRequiredFixture],
      ["create-allowed.json", createAllowedFixture],
      ["customer.json", customerFixture],
      ["employee.json", employeeFixture],
      ["empty.json", emptyFixture],
      ["many-relation.json", manyRelationFixture],
      ["not-allowed.json", notAllowedFixture],
      ["order.json", orderFixture],
      ["partially-allowed.json", partiallyAllowedFixture],
      ["product.json", productFixture],
      ["read-allowed.json", readAllowedFixture],
      ["related-item.json", relatedItemFixture],
      ["supplier.json", supplierFixture],
      ["update-allowed.json", updateAllowedFixture],
    ];

    it.each(entityFixtures)("%s matches EntityProfileSchema", (name, fixture) => {
      const result = EntityProfileSchema.safeParse(fixture);
      expect(
        result.success,
        `${name} parse failed: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true);
    });

    it.each(entityFixtures)(
      "%s: _links.describes has collection and item entries",
      (name, fixture) => {
        const result = EntityProfileSchema.safeParse(fixture);
        expect(result.success).toBe(true);
        if (result.success) {
          const describes = result.data._links.describes;
          const collection = describes.find((d) => d.name === "collection");
          const item = describes.find((d) => d.name === "item");
          expect(collection, `${name}: missing collection describes link`).toBeDefined();
          expect(item, `${name}: missing item describes link`).toBeDefined();
        }
      },
    );

    it.each(entityFixtures)("%s: _templates.default exists with method HEAD", (name, fixture) => {
      const result = EntityProfileSchema.safeParse(fixture);
      expect(result.success).toBe(true);
      if (result.success) {
        const defaultTemplate = result.data._templates["default"];
        expect(defaultTemplate, `${name}: missing _templates.default`).toBeDefined();
        expect(defaultTemplate?.method, `${name}: default template method`).toBe("HEAD");
      }
    });

    // Spot-check: relation field (type=url + options.link) parses in customer.json
    it("customer.json create-form has relation field with options.link", () => {
      const result = EntityProfileSchema.safeParse(customerFixture);
      expect(result.success).toBe(true);
      if (result.success) {
        const createForm = result.data._templates["create-form"];
        expect(createForm).toBeDefined();
        if (createForm) {
          const relationProp = createForm.properties.find(
            (p) => p.type === "url" && p.options?.link !== undefined,
          );
          expect(
            relationProp,
            "customer create-form: missing url field with options.link",
          ).toBeDefined();
          expect(relationProp?.options?.link?.href).toEqual(expect.any(String));
        }
      }
    });

    // Spot-check: content/file field present in all-attribute.json create-form
    it("all-attribute.json create-form has content/file field", () => {
      const result = EntityProfileSchema.safeParse(allAttributeFixture);
      expect(result.success).toBe(true);
      if (result.success) {
        const createForm = result.data._templates["create-form"];
        expect(createForm).toBeDefined();
        if (createForm) {
          const fileProp = createForm.properties.find((p) => p.type === "file");
          expect(fileProp, "all-attribute create-form: missing file field").toBeDefined();
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Negative tests — simulate upstream breaking shape changes; parse MUST fail.
  // These prove the contract layer would catch a real upstream regression.
  // -------------------------------------------------------------------------

  describe("Negative — simulated upstream breaking changes", () => {
    it("HalObject: renaming _links → links breaks the contract", () => {
      // Simulate a hypothetical upstream change where _links is renamed to links.
      const brokenInvoice = {
        ...sampleInvoice,
        links: sampleInvoice._links, // upstream renames the field
        _links: undefined, // original key removed
      };

      const strictSchema = z.object({
        _links: z.object({ self: z.union([LinkSchema, z.array(LinkSchema)]) }),
      });

      const result = strictSchema.safeParse(brokenInvoice);
      expect(result.success).toBe(false);
    });

    it("HAL-Forms template: renaming properties → fields breaks the contract", () => {
      // Simulate a hypothetical upstream change where properties is renamed to fields.
      const brokenTemplate = {
        ...invoiceCreateTemplate,
        fields: invoiceCreateTemplate.properties, // upstream renames the field
        properties: undefined, // original key removed
      };

      const strictTemplateSchema = z.object({
        method: z.string(),
        properties: z.array(HalFormsPropertySchema),
      });

      const result = strictTemplateSchema.safeParse(brokenTemplate);
      expect(result.success).toBe(false);
    });

    it("HalSlice: removing _embedded.item breaks the contract", () => {
      // Simulate a hypothetical upstream change where embedded items move to a
      // different key (e.g. _embedded.items instead of _embedded.item).
      const brokenList = {
        ...sampleInvoiceList,
        _embedded: {
          items: sampleInvoiceList._embedded?.item, // wrong key
        },
      };

      const strictSliceSchema = z.object({
        _embedded: z.object({
          item: z.array(z.unknown()),
        }),
      });

      const result = strictSliceSchema.safeParse(brokenList);
      expect(result.success).toBe(false);
    });

    it("EntityProfile: removing _links.describes breaks the profile contract", () => {
      // Simulate a hypothetical upstream change where describes links are removed,
      // which would break collection/item URL discovery.
      const brokenProfile = {
        ...customerFixture,
        _links: {
          ...customerFixture._links,
          describes: undefined, // upstream removes describes links
        },
      };

      const result = EntityProfileSchema.safeParse(brokenProfile);
      expect(result.success).toBe(false);
    });
  });
});
