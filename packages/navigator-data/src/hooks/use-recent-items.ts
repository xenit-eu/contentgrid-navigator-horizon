import { createValues } from "@contentgrid/hal-forms/values";
import type ProfileEntity from "../accessors/entity-profile";
import { useEntityItemCollection } from "./use-entity-item-collection";

export function useRecentlyCreated(profileEntity: ProfileEntity) {
  const searchTemplate = profileEntity.searchTemplate;

  const searchValues = (() => {
    if (!searchTemplate || !profileEntity.createdAtAttribute || !searchTemplate.sortProperty) {
      return undefined;
    }
    const sortOption = searchTemplate.sortOptions?.find(
      (opt) => opt.profileAttribute?.isCreatedDate && opt.direction === "desc",
    );
    if (!sortOption) {
      return undefined;
    }
    return createValues(searchTemplate.template).withValue(searchTemplate.sortProperty.name, [
      sortOption.value,
    ]);
  })();

  return useEntityItemCollection({ profileEntity, searchValues });
}

export function useRecentlyModified(profileEntity: ProfileEntity) {
  const searchTemplate = profileEntity.searchTemplate;

  const searchValues = (() => {
    if (!searchTemplate || !profileEntity.modifiedAtAttribute || !searchTemplate.sortProperty) {
      return undefined;
    }
    const sortOption = searchTemplate.sortOptions?.find(
      (opt) => opt.profileAttribute?.isModifiedDate && opt.direction === "desc",
    );
    if (!sortOption) {
      return undefined;
    }
    return createValues(searchTemplate.template).withValue(searchTemplate.sortProperty.name, [
      sortOption.value,
    ]);
  })();

  return useEntityItemCollection({ profileEntity, searchValues });
}
