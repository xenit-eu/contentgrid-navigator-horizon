import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import type { ProfileAttributeShape } from "../shapes";
import {
  ProfileAttribute,
  ProfileAttributeSearchType,
  ProfileAttributeType,
} from "./attribute-profile";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeAttributeHal(
  shape: {
    name: string;
    type: string;
    description: string;
    readonly: boolean;
    required?: boolean;
    title?: string;
  },
  embedded?: Record<string, unknown[]>,
): HalObject<ProfileAttributeShape> {
  const json: Record<string, unknown> = {
    name: shape.name,
    type: shape.type,
    title: shape.title,
    description: shape.description,
    readonly: shape.readonly,
    required: shape.required,
    ...(embedded ? { _embedded: embedded } : {}),
  };
  return new HalObject<ProfileAttributeShape>(
    json as unknown as HalObjectShape<ProfileAttributeShape>,
  );
}

const BLUEPRINT_ATTRIBUTE_REL = "https://contentgrid.cloud/rels/blueprint/attribute";
const BLUEPRINT_CONSTRAINT_REL = "https://contentgrid.cloud/rels/blueprint/constraint";
const BLUEPRINT_SEARCH_PARAM_REL = "https://contentgrid.cloud/rels/blueprint/search-param";

function simpleTextAttribute(): ProfileAttribute {
  return new ProfileAttribute(
    makeAttributeHal({
      name: "title",
      type: "string",
      description: "Title field",
      readonly: false,
      required: false,
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProfileAttribute — basic properties", () => {
  it("returns name", () => {
    expect(simpleTextAttribute().name).toBe("title");
  });

  it("returns type as ProfileAttributeType", () => {
    expect(simpleTextAttribute().type).toBe(ProfileAttributeType.string);
  });

  it("returns title when set", () => {
    const attr = new ProfileAttribute(
      makeAttributeHal({
        name: "ref",
        type: "string",
        description: "",
        readonly: false,
        title: "Reference",
      }),
    );
    expect(attr.title).toBe("Reference");
  });

  it("returns undefined title when not set", () => {
    expect(simpleTextAttribute().title).toBeUndefined();
  });

  it("returns description", () => {
    const attr = new ProfileAttribute(
      makeAttributeHal({
        name: "ref",
        type: "string",
        description: "A description",
        readonly: false,
      }),
    );
    expect(attr.description).toBe("A description");
  });

  it("returns isReadOnly true", () => {
    const attr = new ProfileAttribute(
      makeAttributeHal({ name: "createdAt", type: "datetime", description: "", readonly: true }),
    );
    expect(attr.isReadOnly).toBe(true);
  });

  it("returns isReadOnly false", () => {
    expect(simpleTextAttribute().isReadOnly).toBe(false);
  });

  it("returns isRequired true when set", () => {
    const attr = new ProfileAttribute(
      makeAttributeHal({
        name: "name",
        type: "string",
        description: "",
        readonly: false,
        required: true,
      }),
    );
    expect(attr.isRequired).toBe(true);
  });

  it("returns isRequired false when not set", () => {
    expect(simpleTextAttribute().isRequired).toBeFalsy();
  });
});

describe("ProfileAttribute — isContent", () => {
  it("returns false for plain string attribute (no embedded attributes)", () => {
    expect(simpleTextAttribute().isContent).toBe(false);
  });

  it("returns true for object attribute with embedded attributes", () => {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "document",
      type: "object",
      description: "A document",
      readonly: false,
      _embedded: {
        [BLUEPRINT_ATTRIBUTE_REL]: [
          {
            name: "filename",
            type: "string",
            description: "Filename",
            readonly: false,
          },
        ],
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    expect(new ProfileAttribute(hal).isContent).toBe(true);
  });

  it("returns false for object attribute without embedded attributes", () => {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "metadata",
      type: "object",
      description: "",
      readonly: false,
    } as HalObjectShape<ProfileAttributeShape>);
    expect(new ProfileAttribute(hal).isContent).toBe(false);
  });
});

describe("ProfileAttribute — constraints", () => {
  function attributeWithConstraints(
    constraints: { type: string; values?: string[] }[],
  ): ProfileAttribute {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "status",
      type: "string",
      description: "",
      readonly: false,
      _embedded: {
        [BLUEPRINT_CONSTRAINT_REL]: constraints,
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    return new ProfileAttribute(hal);
  }

  it("returns empty constraints when none exist", () => {
    expect(simpleTextAttribute().constraints).toEqual([]);
  });

  it("returns constraints array", () => {
    const attr = attributeWithConstraints([{ type: "unique" }]);
    expect(attr.constraints).toHaveLength(1);
    expect(attr.constraints[0].type).toBe("unique");
  });

  it("isUnique returns true when unique constraint present", () => {
    expect(attributeWithConstraints([{ type: "unique" }]).isUnique).toBe(true);
  });

  it("isUnique returns false when no unique constraint", () => {
    expect(simpleTextAttribute().isUnique).toBe(false);
  });

  it("allowedValues returns values when allowed-values constraint exists", () => {
    const attr = attributeWithConstraints([
      { type: "allowed-values", values: ["draft", "pending", "paid"] },
    ]);
    expect(attr.allowedValues).toEqual(["draft", "pending", "paid"]);
  });

  it("allowedValues returns undefined when no allowed-values constraint", () => {
    expect(simpleTextAttribute().allowedValues).toBeUndefined();
  });

  it("isCreatedDate returns true for created-date constraint", () => {
    expect(attributeWithConstraints([{ type: "created-date" }]).isCreatedDate).toBe(true);
  });

  it("isCreatedDate returns false when constraint absent", () => {
    expect(simpleTextAttribute().isCreatedDate).toBe(false);
  });

  it("isCreatedBy returns true for created-by constraint", () => {
    expect(attributeWithConstraints([{ type: "created-by" }]).isCreatedBy).toBe(true);
  });

  it("isCreatedBy returns false when constraint absent", () => {
    expect(simpleTextAttribute().isCreatedBy).toBe(false);
  });

  it("isModifiedDate returns true for modified-date constraint", () => {
    expect(attributeWithConstraints([{ type: "modified-date" }]).isModifiedDate).toBe(true);
  });

  it("isModifiedDate returns false when constraint absent", () => {
    expect(simpleTextAttribute().isModifiedDate).toBe(false);
  });

  it("isModifiedBy returns true for modified-by constraint", () => {
    expect(attributeWithConstraints([{ type: "modified-by" }]).isModifiedBy).toBe(true);
  });

  it("isModifiedBy returns false when constraint absent", () => {
    expect(simpleTextAttribute().isModifiedBy).toBe(false);
  });
});

describe("ProfileAttribute — search params", () => {
  function attributeWithSearchParams(
    params: { name: string; title: string; type: string }[],
  ): ProfileAttribute {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "number",
      type: "string",
      description: "",
      readonly: false,
      _embedded: {
        [BLUEPRINT_SEARCH_PARAM_REL]: params,
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    return new ProfileAttribute(hal);
  }

  it("returns empty searchParams when none exist", () => {
    expect(simpleTextAttribute().searchParams).toEqual([]);
  });

  it("availableSearchTypes returns mapped search types", () => {
    const attr = attributeWithSearchParams([
      { name: "number", title: "Exact match", type: "exact-match" },
      { name: "number", title: "Prefix match", type: "prefix-match" },
    ]);
    expect(attr.availableSearchTypes).toContain(ProfileAttributeSearchType.exactMatch);
    expect(attr.availableSearchTypes).toContain(ProfileAttributeSearchType.prefixMatch);
  });

  it("hasExactSearch returns true when exact-match is present", () => {
    const attr = attributeWithSearchParams([
      { name: "number", title: "Exact", type: "exact-match" },
    ]);
    expect(attr.hasExactSearch).toBe(true);
  });

  it("hasExactSearch returns false when not present", () => {
    expect(simpleTextAttribute().hasExactSearch).toBe(false);
  });

  it("hasPrefixSearch returns true when prefix-match is present", () => {
    const attr = attributeWithSearchParams([
      { name: "name", title: "Prefix", type: "prefix-match" },
    ]);
    expect(attr.hasPrefixSearch).toBe(true);
  });

  it("hasPrefixSearch returns false when not present", () => {
    expect(simpleTextAttribute().hasPrefixSearch).toBe(false);
  });

  it("hasFullTextSearch returns true when full-text is present", () => {
    const attr = attributeWithSearchParams([
      { name: "body", title: "Full text", type: "full-text" },
    ]);
    expect(attr.hasFullTextSearch).toBe(true);
  });

  it("hasFullTextSearch returns false when not present", () => {
    expect(simpleTextAttribute().hasFullTextSearch).toBe(false);
  });

  it("hasSearchType returns false for a type that is not present", () => {
    const attr = attributeWithSearchParams([
      { name: "body", title: "Full text", type: "full-text" },
    ]);
    expect(attr.hasSearchType(ProfileAttributeSearchType.exactMatch)).toBe(false);
  });
});

describe("ProfileAttribute — embedded attributes", () => {
  it("returns empty embeddedAttributes for non-content attribute", () => {
    expect(simpleTextAttribute().embeddedAttributes).toHaveLength(0);
  });

  it("getEmbeddedAttribute returns undefined when no embedded attributes", () => {
    expect(simpleTextAttribute().getEmbeddedAttribute("filename")).toBeUndefined();
  });

  it("returns embedded attributes for content type", () => {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "document",
      type: "object",
      description: "",
      readonly: false,
      _embedded: {
        [BLUEPRINT_ATTRIBUTE_REL]: [
          { name: "filename", type: "string", description: "", readonly: true },
          { name: "mimetype", type: "string", description: "", readonly: true },
        ],
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    const attr = new ProfileAttribute(hal);
    expect(attr.embeddedAttributes).toHaveLength(2);
    expect(attr.embeddedAttributes[0].name).toBe("filename");
  });

  it("getEmbeddedAttribute returns the matching attribute", () => {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "document",
      type: "object",
      description: "",
      readonly: false,
      _embedded: {
        [BLUEPRINT_ATTRIBUTE_REL]: [
          { name: "filename", type: "string", description: "", readonly: true },
        ],
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    const attr = new ProfileAttribute(hal);
    const embedded = attr.getEmbeddedAttribute("filename");
    expect(embedded).toBeDefined();
    expect(embedded!.name).toBe("filename");
  });

  it("getEmbeddedAttribute returns undefined for unknown name", () => {
    const hal = new HalObject<ProfileAttributeShape>({
      name: "document",
      type: "object",
      description: "",
      readonly: false,
      _embedded: {
        [BLUEPRINT_ATTRIBUTE_REL]: [
          { name: "filename", type: "string", description: "", readonly: true },
        ],
      },
    } as unknown as HalObjectShape<ProfileAttributeShape>);
    const attr = new ProfileAttribute(hal);
    expect(attr.getEmbeddedAttribute("length")).toBeUndefined();
  });
});
