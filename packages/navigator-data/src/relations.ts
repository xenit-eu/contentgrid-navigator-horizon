import { createRelations } from "@contentgrid/hal/rels";
import UriTemplate from "@contentgrid/uri-template";

export default createRelations(
  new UriTemplate("https://contentgrid.cloud/rels/contentgrid/{rel}"),
  ["entity", "content", "relation"] as const,
);

export const blueprintRelations = createRelations(
  new UriTemplate("https://contentgrid.cloud/rels/blueprint/{rel}"),
  ["attribute", "constraint", "search-param"] as const,
);
