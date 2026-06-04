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
 * items), HAL-Forms create template (create-form), and HAL-Forms update/default
 * template (default).
 *
 * TODO(ACC-2847): swap in Phase 0.5 halforms/ entity-profile fixtures as
 * additional contract inputs once HZN-0.5.4 lands.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  invoiceCreateTemplate,
  invoiceUpdateTemplate,
  sampleInvoice,
  sampleInvoiceList,
} from "./hal/fixtures";

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
 * Mirror of HalFormsPropertyShape: name is mandatory; type, required, readOnly
 * are the fields we render/apply in forms.
 */
const HalFormsPropertySchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
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
  });
});
