import { createRelations } from "@contentgrid/hal/rels";
import UriTemplate from "@contentgrid/uri-template";

export const cgRels = createRelations(
  new UriTemplate("https://contentgrid.cloud/rels/contentgrid/{rel}"),
  ["entity", "content", "relation", "profile"] as const,
);

export const blueprintRels = createRelations(
  new UriTemplate("https://contentgrid.cloud/rels/blueprint/{rel}"),
  ["attribute", "constraint", "search-param", "relation", "target-entity"] as const,
);
