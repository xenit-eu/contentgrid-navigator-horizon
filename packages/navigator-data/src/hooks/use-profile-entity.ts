import { queryOptions, useQuery } from "@tanstack/react-query";
import type ProfileEntity from "../accessors/entity-profile";
import {
  type ProfileEntityFilter,
  getProfileEntities,
  getProfileEntity,
} from "../accessors/entity-profile";
import type { TypedFetch } from "../api/client";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

const profileEntitiesQuery = (apiFetch: TypedFetch, profileUrl: string) =>
  queryOptions({
    queryKey: queryKeys.profileEntities(),
    queryFn: () => getProfileEntities(apiFetch, profileUrl),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

const profileEntityQuery = (
  apiFetch: TypedFetch,
  profileUrl: string,
  filter: ProfileEntityFilter,
) =>
  queryOptions({
    queryKey: queryKeys.profileEntity(filter),
    queryFn: () => getProfileEntity(apiFetch, profileUrl, filter),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

interface UseProfileEntitiesOptions {
  readonly queryOptionsOverride?: Readonly<
    QueryOptionsOverride<
      readonly ProfileEntity[],
      Error,
      readonly ProfileEntity[],
      readonly ["profileEntities"]
    >
  >;
}

export function useProfileEntities(options?: UseProfileEntitiesOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery({
    ...profileEntitiesQuery(apiFetch, profileUrl),
    ...(options?.queryOptionsOverride ?? {}),
  });
}

interface UseProfileEntityOptions {
  readonly queryOptionsOverride?: Readonly<
    QueryOptionsOverride<
      ProfileEntity | null,
      Error,
      ProfileEntity | null,
      readonly ["profileEntity", ProfileEntityFilter]
    >
  >;
}

export function useProfileEntity(filter: ProfileEntityFilter, options?: UseProfileEntityOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();
  const hasFilter = filter.name !== undefined || filter.link !== undefined;

  return useQuery({
    ...profileEntityQuery(apiFetch, profileUrl, filter),
    ...(options?.queryOptionsOverride ?? {}),
    enabled: hasFilter,
  });
}
