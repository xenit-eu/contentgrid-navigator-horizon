import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import type { ProfileRelationShape } from "../shapes";
import { ProfileRelation } from "./relation-profile";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

function makeRelationHal(
  shape: Partial<ProfileRelationShape> & {
    name: string;
    many_source_per_target: boolean;
    many_target_per_source: boolean;
    required: boolean;
  },
  targetLink?: { href: string; title?: string },
): HalObject<ProfileRelationShape> {
  const json: Record<string, unknown> = {
    name: shape.name,
    title: shape.title,
    description: shape.description ?? "",
    many_source_per_target: shape.many_source_per_target,
    many_target_per_source: shape.many_target_per_source,
    required: shape.required,
  };
  if (targetLink) {
    json._links = {
      [BLUEPRINT_TARGET_ENTITY_REL]: targetLink,
    };
  }
  return new HalObject<ProfileRelationShape>(
    json as unknown as HalObjectShape<ProfileRelationShape>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProfileRelation — basic properties", () => {
  it("returns name", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.name).toBe("supplier");
  });

  it("returns title when set", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        title: "Supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.title).toBe("Supplier");
  });

  it("falls back to name when title is not set", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.title).toBe("supplier");
  });

  it("returns description", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        description: "The supplier entity",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.description).toBe("The supplier entity");
  });

  it("returns isRequired true", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: true,
      }),
    );
    expect(rel.isRequired).toBe(true);
  });

  it("returns isRequired false", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.isRequired).toBe(false);
  });
});

describe("ProfileRelation — cardinality", () => {
  function oneToOne() {
    return new ProfileRelation(
      makeRelationHal({
        name: "rel",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
  }
  function oneToMany() {
    return new ProfileRelation(
      makeRelationHal({
        name: "rel",
        many_source_per_target: false,
        many_target_per_source: true,
        required: false,
      }),
    );
  }
  function manyToOne() {
    return new ProfileRelation(
      makeRelationHal({
        name: "rel",
        many_source_per_target: true,
        many_target_per_source: false,
        required: false,
      }),
    );
  }
  function manyToMany() {
    return new ProfileRelation(
      makeRelationHal({
        name: "rel",
        many_source_per_target: true,
        many_target_per_source: true,
        required: false,
      }),
    );
  }

  it("one-to-one: isToOne = true, isToMany = false", () => {
    expect(oneToOne().isToOne).toBe(true);
    expect(oneToOne().isToMany).toBe(false);
  });

  it("one-to-many: isToMany = true, isToOne = false", () => {
    expect(oneToMany().isToMany).toBe(true);
    expect(oneToMany().isToOne).toBe(false);
  });

  it("isOneToOne: true only for 1:1", () => {
    expect(oneToOne().isOneToOne).toBe(true);
    expect(oneToMany().isOneToOne).toBe(false);
    expect(manyToOne().isOneToOne).toBe(false);
    expect(manyToMany().isOneToOne).toBe(false);
  });

  it("isOneToMany: true only for 1:N", () => {
    expect(oneToMany().isOneToMany).toBe(true);
    expect(oneToOne().isOneToMany).toBe(false);
    expect(manyToMany().isOneToMany).toBe(false);
  });

  it("isManyToOne: true only for N:1", () => {
    expect(manyToOne().isManyToOne).toBe(true);
    expect(oneToOne().isManyToOne).toBe(false);
    expect(manyToMany().isManyToOne).toBe(false);
  });

  it("isManyToMany: true only for N:M", () => {
    expect(manyToMany().isManyToMany).toBe(true);
    expect(oneToOne().isManyToMany).toBe(false);
    expect(manyToOne().isManyToMany).toBe(false);
    expect(oneToMany().isManyToMany).toBe(false);
  });
});

describe("ProfileRelation — target entity", () => {
  it("returns targetProfileLink when present", () => {
    const rel = new ProfileRelation(
      makeRelationHal(
        {
          name: "supplier",
          many_source_per_target: false,
          many_target_per_source: false,
          required: false,
        },
        { href: "/profile/suppliers", title: "Supplier" },
      ),
    );
    expect(rel.targetProfileLink).not.toBeNull();
    expect(rel.targetProfileLink!.href).toBe("/profile/suppliers");
  });

  it("returns null targetProfileLink when no target link", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.targetProfileLink).toBeNull();
  });

  it("returns targetProfileHref when link is present", () => {
    const rel = new ProfileRelation(
      makeRelationHal(
        {
          name: "supplier",
          many_source_per_target: false,
          many_target_per_source: false,
          required: false,
        },
        { href: "/profile/suppliers" },
      ),
    );
    expect(rel.targetProfileHref).toBe("/profile/suppliers");
  });

  it("returns undefined targetProfileHref when no link", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.targetProfileHref).toBeUndefined();
  });

  it("returns targetProfileTitle from link title", () => {
    const rel = new ProfileRelation(
      makeRelationHal(
        {
          name: "supplier",
          many_source_per_target: false,
          many_target_per_source: false,
          required: false,
        },
        { href: "/profile/suppliers", title: "Suppliers" },
      ),
    );
    expect(rel.targetProfileTitle).toBe("Suppliers");
  });

  it("returns undefined targetProfileTitle when no link", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.targetProfileTitle).toBeUndefined();
  });
});

describe("ProfileRelation — getTargetProfile", () => {
  it("returns undefined when no targetProfileLink", () => {
    const rel = new ProfileRelation(
      makeRelationHal({
        name: "supplier",
        many_source_per_target: false,
        many_target_per_source: false,
        required: false,
      }),
    );
    expect(rel.getTargetProfile([])).toBeUndefined();
  });

  it("returns undefined when profiles list is empty", () => {
    const rel = new ProfileRelation(
      makeRelationHal(
        {
          name: "supplier",
          many_source_per_target: false,
          many_target_per_source: false,
          required: false,
        },
        { href: "/profile/suppliers" },
      ),
    );
    expect(rel.getTargetProfile([])).toBeUndefined();
  });
});
