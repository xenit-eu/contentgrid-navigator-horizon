import { describe, expect, it } from "vitest";
import { type ProfileAttribute, ProfileAttributeType } from "@contentgrid/navigator-data";
import { columnTraits } from "./column-traits";

function attribute(type: ProfileAttributeType): ProfileAttribute {
  return { type } as ProfileAttribute;
}

describe("columnTraits", () => {
  it.each([ProfileAttributeType.long, ProfileAttributeType.double])(
    "right-aligns %s columns and sorts them as numbers",
    (type) => {
      expect(columnTraits(attribute(type))).toEqual({ sortKind: "number", align: "end" });
    },
  );

  it.each([ProfileAttributeType.date, ProfileAttributeType.datetime])(
    "sorts %s columns as dates",
    (type) => {
      expect(columnTraits(attribute(type))).toEqual({ sortKind: "date" });
    },
  );

  it("sorts strings and the id column as text", () => {
    expect(columnTraits(attribute(ProfileAttributeType.string))).toEqual({ sortKind: "text" });
    expect(columnTraits(undefined)).toEqual({ sortKind: "text" });
  });

  it("gives booleans and content no sort wording", () => {
    expect(columnTraits(attribute(ProfileAttributeType.boolean))).toEqual({});
    expect(columnTraits(attribute(ProfileAttributeType.object))).toEqual({});
  });
});
