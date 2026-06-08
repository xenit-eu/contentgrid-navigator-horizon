import { createRelation } from "@contentgrid/hal/rels";

export const cgRels = {
  entity: createRelation("https://contentgrid.cloud/rels/contentgrid/entity"),
  profile: createRelation("https://contentgrid.cloud/rels/contentgrid/profile"),
  content: createRelation("https://contentgrid.cloud/rels/contentgrid/content"),
  relation: createRelation("https://contentgrid.cloud/rels/contentgrid/relation"),
} as const;

export const blueprintRels = {
  attribute: createRelation("https://contentgrid.cloud/rels/blueprint/attribute"),
  relation: createRelation("https://contentgrid.cloud/rels/blueprint/relation"),
  targetEntity: createRelation("https://contentgrid.cloud/rels/blueprint/target-entity"),
  constraint: createRelation("https://contentgrid.cloud/rels/blueprint/constraint"),
} as const;

export const datamodelRels = {
  // Add specific datamodel relations as needed
} as const;
