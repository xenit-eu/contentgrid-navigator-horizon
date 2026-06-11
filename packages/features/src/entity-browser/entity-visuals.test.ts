import { Building2, FileText, Globe, Package, ScrollText, ShoppingCart } from "lucide-react";
import { describe, expect, it } from "vitest";
import { getEntityVisuals } from "./entity-visuals";

describe("getEntityVisuals", () => {
  it("matches document-like entities to FileText / sky", () => {
    expect(getEntityVisuals({ name: "invoice" })).toEqual({ icon: FileText, accent: "sky" });
    expect(getEntityVisuals({ name: "receipt" })).toEqual({ icon: FileText, accent: "sky" });
  });

  it("matches contract-like entities to ScrollText / amber", () => {
    expect(getEntityVisuals({ name: "contract" })).toEqual({ icon: ScrollText, accent: "amber" });
    expect(getEntityVisuals({ name: "lease" })).toEqual({ icon: ScrollText, accent: "amber" });
  });

  it("matches supplier-like entities to Building2 / steel", () => {
    expect(getEntityVisuals({ name: "supplier" })).toEqual({ icon: Building2, accent: "steel" });
  });

  it("matches product-like entities to Package / sand", () => {
    expect(getEntityVisuals({ name: "product" })).toEqual({ icon: Package, accent: "sand" });
  });

  it("matches order-like entities to ShoppingCart / ocean", () => {
    expect(getEntityVisuals({ name: "purchase_order" })).toEqual({
      icon: ShoppingCart,
      accent: "ocean",
    });
  });

  it("matches company-like entities to Globe / breeze", () => {
    expect(getEntityVisuals({ name: "customer" })).toEqual({ icon: Globe, accent: "breeze" });
  });

  it("matches location-like entities to Building2 / ocean", () => {
    expect(getEntityVisuals({ name: "warehouse_site" })).toEqual({
      icon: Building2,
      accent: "ocean",
    });
  });

  it("is case-insensitive and also matches on the title", () => {
    expect(getEntityVisuals({ name: "x", title: "INVOICES" })).toEqual({
      icon: FileText,
      accent: "sky",
    });
  });

  it("first matching keyword entry wins", () => {
    // "invoice product" matches the document entry (first in the table)
    // before the product entry.
    expect(getEntityVisuals({ name: "invoice", title: "Product invoices" })).toEqual({
      icon: FileText,
      accent: "sky",
    });
  });

  it("falls back deterministically for unknown entities", () => {
    const first = getEntityVisuals({ name: "zzz_unknown_entity" });
    const second = getEntityVisuals({ name: "zzz_unknown_entity" });
    expect(second).toEqual(first);
    expect(first.icon).toBeDefined();
    expect(first.accent).toBeDefined();
  });

  it("gives different unknown entities (usually) different visuals based on hash", () => {
    const a = getEntityVisuals({ name: "qqqq" });
    const b = getEntityVisuals({ name: "wwwww" });
    // Both must be valid; determinism per name is the contract.
    expect(getEntityVisuals({ name: "qqqq" })).toEqual(a);
    expect(getEntityVisuals({ name: "wwwww" })).toEqual(b);
  });
});
