import type { TypedRequestSpec } from "@contentgrid/typed-fetch";
import type { EntityCollectionShape, EntityInstanceForUpdate, EntityItemShape } from "../shapes";

export type SearchRequestSpec = TypedRequestSpec<void, EntityCollectionShape>;
export type EntityInstanceRequestSpec = TypedRequestSpec<void, EntityItemShape>;
export type EntityInstanceCreateRequestSpec = TypedRequestSpec<
  EntityInstanceForUpdate,
  EntityItemShape
>;
export type EntityInstanceUpdateRequestSpec = TypedRequestSpec<
  EntityInstanceForUpdate,
  EntityItemShape
>;
export type EntityInstanceDeleteRequestSpec = TypedRequestSpec<void, void>;
export type RelationUpdateRequestSpec = TypedRequestSpec<readonly string[], void>;
export type RelationDeleteRequestSpec = TypedRequestSpec<void, void>;
