import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { BooleanAttributeRenderer } from "./boolean-attribute-renderer";
import { CreatedByAttributeRenderer } from "./created-by-attribute-renderer";
import { CreatedDateAttributeRenderer } from "./created-date-attribute-renderer";
import { ModifiedByAttributeRenderer } from "./modified-by-attribute-renderer";
import { ModifiedDateAttributeRenderer } from "./modified-date-attribute-renderer";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

describe("isTableVariant", () => {
  it("is true for both table variants only", () => {
    expect(isTableVariant("table")).toBe(true);
    expect(isTableVariant("attribute-table")).toBe(true);
    expect(isTableVariant("default")).toBe(false);
    expect(isTableVariant("item-reference")).toBe(false);
  });
});

// Every renderer except the string-set one renders the detail page's attribute table exactly
// like the collection table.
const DATE = "2021-03-04T05:06:07.000Z";
const cases: Record<string, (variant: AttributeRendererVariant) => ReactElement> = {
  boolean: (variant) => <BooleanAttributeRenderer value={true} label="Active" variant={variant} />,
  createdBy: (variant) => (
    <CreatedByAttributeRenderer value="alice" label="Creator" variant={variant} />
  ),
  modifiedBy: (variant) => (
    <ModifiedByAttributeRenderer value="bob" label="Modifier" variant={variant} />
  ),
  createdDate: (variant) => (
    <CreatedDateAttributeRenderer
      value={DATE}
      label="Created"
      type={ProfileAttributeType.datetime}
      variant={variant}
    />
  ),
  modifiedDate: (variant) => (
    <ModifiedDateAttributeRenderer
      value={DATE}
      label="Modified"
      type={ProfileAttributeType.datetime}
      variant={variant}
    />
  ),
};

describe.each(Object.entries(cases))("%s renderer", (_name, renderWith) => {
  it("renders the attribute-table variant like the table variant", () => {
    const table = render(renderWith("table")).container.innerHTML;
    const attributeTable = render(renderWith("attribute-table")).container.innerHTML;
    expect(attributeTable).toBe(table);
  });

  it("renders the table variant differently from the default variant", () => {
    const table = render(renderWith("table")).container.innerHTML;
    const defaultVariant = render(renderWith("default")).container.innerHTML;
    expect(table).not.toBe(defaultVariant);
  });
});
