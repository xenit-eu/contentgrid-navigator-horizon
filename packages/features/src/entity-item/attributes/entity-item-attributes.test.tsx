import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type EntityItem,
  type EntityItemAttribute,
  EntityItemAttributeNested,
  EntityItemAttributePlain,
  type ProfileAttribute,
  ProfileAttributeType,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { EntityItemAttributes } from "./entity-item-attributes";

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

function makeProfile(attributes: { name: string; title: string }[]): ProfileEntity {
  return { attributes } as unknown as ProfileEntity;
}

function makeItem(
  userDefinedAttributes: EntityItemAttribute[],
  auditAttributes: EntityItemAttribute[] = [],
): EntityItem {
  return { userDefinedAttributes, auditAttributes } as unknown as EntityItem;
}

describe("EntityItemAttributes", () => {
  it("renders nothing but the empty wrapper when there are no attributes", () => {
    render(<EntityItemAttributes profile={makeProfile([])} item={makeItem([])} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders audit attributes above the table, separated by a middle dot", () => {
    render(
      <EntityItemAttributes
        profile={makeProfile([])}
        item={makeItem(
          [],
          [
            {
              value: new EntityItemAttributePlain("createdBy", "jane@example.com"),
              profileAttribute: makeProfileAttribute({ name: "createdBy", isCreatedBy: true }),
            },
            {
              value: new EntityItemAttributePlain("createdAt", "2016-01-01T00:00:00.000Z"),
              profileAttribute: makeProfileAttribute({ name: "createdAt", isCreatedDate: true }),
            },
          ],
        )}
      />,
    );
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText(/^created /)).toBeInTheDocument();
    expect(screen.getByText("·")).toBeInTheDocument();
  });

  it("filters nested attributes out of both the audit row and the table", () => {
    render(
      <EntityItemAttributes
        profile={makeProfile([{ name: "name", title: "Name" }])}
        item={makeItem(
          [
            {
              value: new EntityItemAttributePlain("name", "Acme"),
              profileAttribute: makeProfileAttribute({ name: "name" }),
            },
            { value: new EntityItemAttributeNested("address", { city: "Ghent" }) },
          ],
          [new EntityItemAttributeNested("meta", { x: 1 })].map((value) => ({ value })),
        )}
      />,
    );
    expect(screen.queryByText("address")).not.toBeInTheDocument();
    expect(screen.queryByText("meta")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });

  it("shows the profile title as the row label, falling back to the raw name", () => {
    render(
      <EntityItemAttributes
        profile={makeProfile([{ name: "supplier_name", title: "Supplier name" }])}
        item={makeItem([
          {
            value: new EntityItemAttributePlain("supplier_name", "Acme"),
            profileAttribute: makeProfileAttribute({ name: "supplier_name" }),
          },
          {
            value: new EntityItemAttributePlain("untitled_field", "raw"),
            profileAttribute: makeProfileAttribute({ name: "untitled_field" }),
          },
        ])}
      />,
    );
    expect(screen.getByText("Supplier name")).toBeInTheDocument();
    expect(screen.getByText("untitled_field")).toBeInTheDocument();
  });

  it("renders boolean attributes as a chip row using the profile title as the label", () => {
    render(
      <EntityItemAttributes
        profile={makeProfile([{ name: "active", title: "Active" }])}
        item={makeItem([
          {
            value: new EntityItemAttributePlain("active", true),
            profileAttribute: makeProfileAttribute({
              name: "active",
              type: ProfileAttributeType.boolean,
            }),
          },
        ])}
      />,
    );
    const chips = screen
      .getAllByText("Active")
      .map((el) => el.closest('[data-slot="status-pill"]'))
      .filter((el) => el !== null);
    expect(chips).toHaveLength(1);
  });

  it("renders boolean values as plain true/false/unset text in the table, not a chip", () => {
    render(
      <EntityItemAttributes
        profile={makeProfile([
          { name: "active", title: "Active" },
          { name: "verified", title: "Verified" },
          { name: "archived", title: "Archived" },
        ])}
        item={makeItem([
          {
            value: new EntityItemAttributePlain("active", true),
            profileAttribute: makeProfileAttribute({
              name: "active",
              type: ProfileAttributeType.boolean,
            }),
          },
          {
            value: new EntityItemAttributePlain("verified", false),
            profileAttribute: makeProfileAttribute({
              name: "verified",
              type: ProfileAttributeType.boolean,
            }),
          },
          {
            value: new EntityItemAttributePlain("archived", null),
            profileAttribute: makeProfileAttribute({
              name: "archived",
              type: ProfileAttributeType.boolean,
            }),
          },
        ])}
      />,
    );
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(screen.getByText("unset")).toBeInTheDocument();
  });
});
