import { describe, expect, it } from "vitest";
import type { EntityAttribute } from "../types/entity";
import { findNameAttribute, resolveDisplayName } from "./entity-display-name";

const attr = (name: string, type = "string"): EntityAttribute => ({
  name,
  title: name,
  type,
  readOnly: false,
  required: false,
  unique: false,
  searchable: false,
  prefixSearchable: false,
});

describe("findNameAttribute", () => {
  it("returns the configured attribute when specified", () => {
    const attrs = [attr("code"), attr("label")];
    expect(findNameAttribute(attrs, "label")?.name).toBe("label");
  });

  it("falls back when configured attribute is not found", () => {
    const attrs = [attr("name")];
    expect(findNameAttribute(attrs, "nonexistent")?.name).toBe("name");
  });

  it("prefers an attribute named 'name'", () => {
    const attrs = [attr("code"), attr("name"), attr("description")];
    expect(findNameAttribute(attrs)?.name).toBe("name");
  });

  it("prefers an attribute named 'title'", () => {
    const attrs = [attr("code"), attr("title"), attr("description")];
    expect(findNameAttribute(attrs)?.name).toBe("title");
  });

  it("falls back to the first text-like attribute", () => {
    const attrs = [attr("id"), attr("reference"), attr("count", "long")];
    expect(findNameAttribute(attrs)?.name).toBe("reference");
  });

  it("returns undefined when no text attribute exists", () => {
    const attrs = [attr("id"), attr("count", "long")];
    expect(findNameAttribute(attrs)).toBeUndefined();
  });
});

describe("resolveDisplayName", () => {
  const attrs = [attr("id"), attr("title"), attr("code")];

  it("returns the configured attribute value", () => {
    expect(resolveDisplayName({ title: "My Title", code: "C1" }, "x1", attrs, "code")).toBe("C1");
  });

  it("uses the name attribute when no configuredAttribute", () => {
    expect(resolveDisplayName({ title: "My Title" }, "x1", attrs)).toBe("My Title");
  });

  it("falls back to data.title", () => {
    expect(resolveDisplayName({ title: "Fallback" }, "x1", [])).toBe("Fallback");
  });

  it("falls back to data.name", () => {
    expect(resolveDisplayName({ name: "ByName" }, "x1", [])).toBe("ByName");
  });

  it("falls back to the first non-id string attribute", () => {
    expect(resolveDisplayName({ code: "C1" }, "x1", [attr("id"), attr("code")])).toBe("C1");
  });

  it("falls back to truncated itemId when no string data found", () => {
    expect(resolveDisplayName({}, "abcdefgh1234", [])).toBe("abcdefgh...");
  });
});
