import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EntityAttribute } from "@contentgrid/navigator-data";
import {
  EXCLUDED_TYPES,
  SYSTEM_FIELDS,
  formatAttributeValue,
  isDisplayableAttribute,
  pickDisplayAttributes,
} from "./attribute-format";

function attr(overrides: Partial<EntityAttribute>): EntityAttribute {
  return {
    name: "field",
    title: "Field",
    type: "string",
    readOnly: false,
    required: false,
    unique: false,
    searchable: false,
    prefixSearchable: false,
    ...overrides,
  };
}

describe("isDisplayableAttribute", () => {
  it("excludes content and audit_metadata types", () => {
    expect(isDisplayableAttribute(attr({ type: "content" }))).toBe(false);
    expect(isDisplayableAttribute(attr({ type: "audit_metadata" }))).toBe(false);
    expect(EXCLUDED_TYPES.has("content")).toBe(true);
  });

  it("excludes read-only system fields, keeps writable fields with system names", () => {
    expect(isDisplayableAttribute(attr({ name: "created_at", readOnly: true }))).toBe(false);
    expect(isDisplayableAttribute(attr({ name: "created_at", readOnly: false }))).toBe(true);
    expect(SYSTEM_FIELDS.has("modified_by")).toBe(true);
  });

  it("keeps regular attributes", () => {
    expect(isDisplayableAttribute(attr({ name: "reference" }))).toBe(true);
  });
});

describe("pickDisplayAttributes", () => {
  it("filters non-displayable attributes and caps at the default of 6", () => {
    const attrs = [
      attr({ name: "a1" }),
      attr({ name: "doc", type: "content" }),
      attr({ name: "a2" }),
      attr({ name: "a3" }),
      attr({ name: "a4" }),
      attr({ name: "a5" }),
      attr({ name: "a6" }),
      attr({ name: "a7" }),
    ];
    const picked = pickDisplayAttributes(attrs);
    expect(picked).toHaveLength(6);
    expect(picked.map((a) => a.name)).toEqual(["a1", "a2", "a3", "a4", "a5", "a6"]);
  });

  it("respects a custom max", () => {
    const picked = pickDisplayAttributes([attr({ name: "a" }), attr({ name: "b" })], 1);
    expect(picked.map((a) => a.name)).toEqual(["a"]);
  });
});

describe("formatAttributeValue", () => {
  it("renders an em-dash for null / undefined / empty values", () => {
    const { container } = render(<>{formatAttributeValue(null, "string")}</>);
    expect(container.textContent).toBe("—");
    const { container: c2 } = render(<>{formatAttributeValue(undefined, "string")}</>);
    expect(c2.textContent).toBe("—");
    const { container: c3 } = render(<>{formatAttributeValue("", "string")}</>);
    expect(c3.textContent).toBe("—");
  });

  it("applies italic styling to the em-dash when requested", () => {
    const { container } = render(<>{formatAttributeValue(null, "string", { italic: true })}</>);
    expect(container.querySelector("span")).toHaveClass("italic");
  });

  it("renders booleans as Yes / No badges", () => {
    render(<>{formatAttributeValue(true, "boolean")}</>);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    render(<>{formatAttributeValue(false, "boolean")}</>);
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("localises date values without a time component", () => {
    const { container } = render(<>{formatAttributeValue("2026-05-14", "date")}</>);
    expect(container.textContent).toMatch(/14/);
    expect(container.textContent).toMatch(/2026/);
    expect(container.textContent).not.toMatch(/:/);
  });

  it("localises datetime values with a time component", () => {
    const { container } = render(<>{formatAttributeValue("2026-05-14T10:30:00Z", "datetime")}</>);
    expect(container.textContent).toMatch(/2026/);
    expect(container.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("falls back to the raw string for unparsable dates", () => {
    const { container } = render(<>{formatAttributeValue("not-a-date", "date")}</>);
    expect(container.textContent).toBe("not-a-date");
  });

  it("formats numbers with thousands separators", () => {
    const { container } = render(<>{formatAttributeValue(24800, "double")}</>);
    expect(container.textContent).toBe((24800).toLocaleString());
  });

  it("falls back to String() for non-numeric values typed as number", () => {
    const { container } = render(<>{formatAttributeValue("abc", "long")}</>);
    expect(container.textContent).toBe("abc");
  });

  it("renders objects as JSON, optionally monospaced", () => {
    const { container } = render(<>{formatAttributeValue({ a: 1 }, "object")}</>);
    expect(container.textContent).toBe('{"a":1}');
    const { container: mono } = render(
      <>{formatAttributeValue({ a: 1 }, "object", { mono: true })}</>,
    );
    expect(mono.querySelector("span")).toHaveClass("font-mono");
  });

  it("renders an empty string for circular (non-serialisable) objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const { container } = render(<>{formatAttributeValue(circular, "object")}</>);
    expect(container.textContent).toBe("");
  });

  it("detects ISO-date-looking strings even when typed as string", () => {
    const { container } = render(<>{formatAttributeValue("2026-05-14", "string")}</>);
    expect(container.textContent).toMatch(/2026/);
    const { container: dt } = render(<>{formatAttributeValue("2026-05-14T10:30:00Z", "string")}</>);
    expect(dt.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("returns plain strings unchanged", () => {
    const { container } = render(<>{formatAttributeValue("hello", "string")}</>);
    expect(container.textContent).toBe("hello");
  });
});
