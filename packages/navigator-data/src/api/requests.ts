import type { TypedRequestSpec } from "@contentgrid/typed-fetch";
import type {
  EntityCollectionShape,
  EntityInstanceForUpdate,
  EntityInstanceShape,
} from "../shapes";

export type SearchRequestSpec = TypedRequestSpec<void, EntityCollectionShape>;
export type EntityInstanceRequestSpec = TypedRequestSpec<void, EntityInstanceShape>;
export type EntityInstanceCreateRequestSpec = TypedRequestSpec<
  EntityInstanceForUpdate,
  EntityInstanceShape
>;
export type EntityInstanceUpdateRequestSpec = TypedRequestSpec<
  EntityInstanceForUpdate,
  EntityInstanceShape
>;
export type EntityInstanceDeleteRequestSpec = TypedRequestSpec<void, void>;
export type RelationUpdateRequestSpec = TypedRequestSpec<readonly string[], void>;
export type RelationDeleteRequestSpec = TypedRequestSpec<void, void>;
