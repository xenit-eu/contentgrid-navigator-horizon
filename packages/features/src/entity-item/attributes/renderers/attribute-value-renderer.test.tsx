import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type EntityItemAttribute,
  EntityItemAttributeContent,
  EntityItemAttributeNested,
  EntityItemAttributePlain,
  EntityItemAttributeUnknown,
  type ProfileAttribute,
  ProfileAttributeType,
} from "@contentgrid/navigator-data";
import { AttributeValueRenderer } from "./attribute-value-renderer";
import { type AttributeRendererComponents, AttributeRendererProvider } from "./registry";

const DUMMY_LINK = {} as ConstructorParameters<typeof EntityItemAttributeContent>[2];

function makeProfileAttribute(overrides: Partial<ProfileAttribute> = {}): ProfileAttribute {
  return {
    name: "attr",
    title: "Attr",
    type: ProfileAttributeType.string,
    isCreatedDate: false,
    isModifiedDate: false,
    isCreatedBy: false,
    isModifiedBy: false,
    isContent: false,
    ...overrides,
  } as unknown as ProfileAttribute;
}

const spyRenderers: AttributeRendererComponents = {
  boolean: ({ value, label }) => <span data-testid="r-boolean">{`${value}:${label}`}</span>,
  string: ({ value }) => <span data-testid="r-string">{String(value)}</span>,
  number: ({ value, type }) => <span data-testid="r-number">{`${value}:${type}`}</span>,
  date: ({ value }) => <span data-testid="r-date">{String(value)}</span>,
  datetime: ({ value }) => <span data-testid="r-datetime">{String(value)}</span>,
  createdDate: ({ value, label }) => <span data-testid="r-createdDate">{`${label}:${value}`}</span>,
  modifiedDate: ({ value, label }) => (
    <span data-testid="r-modifiedDate">{`${label}:${value}`}</span>
  ),
  createdBy: ({ value, label }) => <span data-testid="r-createdBy">{`${label}:${value}`}</span>,
  modifiedBy: ({ value, label }) => <span data-testid="r-modifiedBy">{`${label}:${value}`}</span>,
  content: ({ metadata }) => <span data-testid="r-content">{JSON.stringify(metadata)}</span>,
  unknown: () => <span data-testid="r-unknown" />,
};

function renderAttr(attr: EntityItemAttribute) {
  return render(
    <AttributeRendererProvider overrides={spyRenderers}>
      <AttributeValueRenderer attr={attr} />
    </AttributeRendererProvider>,
  );
}

describe("AttributeValueRenderer", () => {
  it("dispatches CONTENT attributes to the content renderer, regardless of profileAttribute", () => {
    const metadata = { filename: "invoice.pdf", length: 1024, mimetype: "application/pdf" };
    renderAttr({
      value: new EntityItemAttributeContent("file", metadata, DUMMY_LINK),
      profileAttribute: makeProfileAttribute(),
    });
    expect(screen.getByTestId("r-content")).toHaveTextContent(JSON.stringify(metadata));
  });

  it("renders nothing for NESTED attributes", () => {
    const { container } = renderAttr({
      value: new EntityItemAttributeNested("address", { city: "Ghent" }),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("dispatches UNKNOWN attributes to the unknown renderer", () => {
    renderAttr({ value: new EntityItemAttributeUnknown("weird") });
    expect(screen.getByTestId("r-unknown")).toBeInTheDocument();
  });

  it("dispatches created-date attributes ahead of the plain type switch", () => {
    renderAttr({
      value: new EntityItemAttributePlain("createdAt", "2021-01-01T00:00:00.000Z"),
      profileAttribute: makeProfileAttribute({
        isCreatedDate: true,
        type: ProfileAttributeType.datetime,
      }),
    });
    expect(screen.getByTestId("r-createdDate")).toHaveTextContent("Attr:2021-01-01T00:00:00.000Z");
    expect(screen.queryByTestId("r-datetime")).not.toBeInTheDocument();
  });

  it("dispatches modified-date attributes to the modifiedDate renderer", () => {
    renderAttr({
      value: new EntityItemAttributePlain("updatedAt", "2021-01-02T00:00:00.000Z"),
      profileAttribute: makeProfileAttribute({ isModifiedDate: true }),
    });
    expect(screen.getByTestId("r-modifiedDate")).toHaveTextContent("Attr:2021-01-02T00:00:00.000Z");
  });

  it("dispatches created-by attributes to the createdBy renderer", () => {
    renderAttr({
      value: new EntityItemAttributePlain("createdBy", "jane@example.com"),
      profileAttribute: makeProfileAttribute({ isCreatedBy: true }),
    });
    expect(screen.getByTestId("r-createdBy")).toHaveTextContent("Attr:jane@example.com");
  });

  it("dispatches modified-by attributes to the modifiedBy renderer", () => {
    renderAttr({
      value: new EntityItemAttributePlain("modifiedBy", "jane@example.com"),
      profileAttribute: makeProfileAttribute({ isModifiedBy: true }),
    });
    expect(screen.getByTestId("r-modifiedBy")).toHaveTextContent("Attr:jane@example.com");
  });

  it("gives created-date precedence over the other audit flags", () => {
    renderAttr({
      value: new EntityItemAttributePlain("weird", "value"),
      profileAttribute: makeProfileAttribute({
        isCreatedDate: true,
        isModifiedDate: true,
        isCreatedBy: true,
        isModifiedBy: true,
      }),
    });
    expect(screen.getByTestId("r-createdDate")).toBeInTheDocument();
    expect(screen.queryByTestId("r-modifiedDate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("r-createdBy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("r-modifiedBy")).not.toBeInTheDocument();
  });

  it.each([
    [true, "true:Yes"],
    [false, "false:No"],
    [null, "null:Not set"],
  ])("dispatches boolean attributes with a derived label (value=%s)", (value, expected) => {
    renderAttr({
      value: new EntityItemAttributePlain("active", value),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.boolean }),
    });
    expect(screen.getByTestId("r-boolean")).toHaveTextContent(expected);
  });

  it("dispatches long attributes to the number renderer with type=long", () => {
    renderAttr({
      value: new EntityItemAttributePlain("count", 5),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.long }),
    });
    expect(screen.getByTestId("r-number")).toHaveTextContent(`5:${ProfileAttributeType.long}`);
  });

  it("dispatches double attributes to the number renderer with type=double", () => {
    renderAttr({
      value: new EntityItemAttributePlain("price", 5.5),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.double }),
    });
    expect(screen.getByTestId("r-number")).toHaveTextContent(`5.5:${ProfileAttributeType.double}`);
  });

  it("dispatches date attributes to the date renderer", () => {
    renderAttr({
      value: new EntityItemAttributePlain("dueDate", "2021-01-01"),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.date }),
    });
    expect(screen.getByTestId("r-date")).toHaveTextContent("2021-01-01");
  });

  it("dispatches datetime attributes to the datetime renderer", () => {
    renderAttr({
      value: new EntityItemAttributePlain("timestamp", "2021-01-01T00:00:00.000Z"),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.datetime }),
    });
    expect(screen.getByTestId("r-datetime")).toHaveTextContent("2021-01-01T00:00:00.000Z");
  });

  it("falls back to the string renderer for string-typed attributes", () => {
    renderAttr({
      value: new EntityItemAttributePlain("name", "Acme"),
      profileAttribute: makeProfileAttribute({ type: ProfileAttributeType.string }),
    });
    expect(screen.getByTestId("r-string")).toHaveTextContent("Acme");
  });

  it("falls back to the string renderer when there is no profileAttribute at all", () => {
    renderAttr({ value: new EntityItemAttributePlain("name", "Acme") });
    expect(screen.getByTestId("r-string")).toHaveTextContent("Acme");
  });
});
