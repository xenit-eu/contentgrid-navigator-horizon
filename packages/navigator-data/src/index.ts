// @contentgrid/navigator-data — composition layer over @contentgrid/* core packages
// See ADR-007 for the two-layer dependency model.
export * from "./api";
export * from "./auth";
export * from "./hooks";
export * from "./accessors/attribute-profile";
export * from "./accessors/extended-forms/search-form";
export * from "./accessors/extended-forms/create-form";
export * from "./accessors/entity-item";
export * from "./accessors/entity-item-collection";
export * from "./accessors/entity-item-to-one-relation";
export * from "./accessors/entity-item-to-many-relation";
export { ProfileRelation } from "./accessors/relation-profile";
export { default as ProfileEntity, profileRootQuery } from "./accessors/entity-profile";
export type { default as ProfileEntityType } from "./accessors/entity-profile";
export {
  entityDisplayPreferencesSchema,
  entityDisplayPreferencesMapSchema,
  validateEntityDisplayPreferencesMap,
} from "./accessors/entity-display-preferences";
export type {
  EntityDisplayPreferences,
  EntityDisplayPreferencesMap,
} from "./accessors/entity-display-preferences";
export * from "./config";
export { queryKeys } from "./query-keys";
export * from "./search";
export { createValues } from "@contentgrid/hal-forms/values";
export type { HalFormValues } from "@contentgrid/hal-forms/values";
export type { SearchRequestSpec } from "./api/requests";
