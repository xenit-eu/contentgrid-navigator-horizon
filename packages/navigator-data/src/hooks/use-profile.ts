import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SimpleLink } from "@contentgrid/hal";
import type Profile from "../accessors/profile";
import { getProfiles } from "../accessors/profile";
import type { TypedFetch } from "../api/client";
import type { QueryOptionsOverride } from "../utils/query-options-override";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

const profileQuery = (apiFetch: TypedFetch, profileUrl: string) =>
  queryOptions({
    queryKey: queryKeys.profile(),
    queryFn: () => getProfiles(apiFetch, profileUrl),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

interface UseProfilesOptions {
  readonly queryOptionsOverride?: Readonly<
    QueryOptionsOverride<readonly Profile[], Error, readonly Profile[], readonly ["profile"]>
  >;
}

export function useProfiles(options?: UseProfilesOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery({
    ...profileQuery(apiFetch, profileUrl),
    ...(options?.queryOptionsOverride ?? {}),
  });
}

interface UseProfileFilter {
  name?: string;
  link?: SimpleLink;
}

export function useProfile(filter: UseProfileFilter = {}, options?: UseProfilesOptions) {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery({
    ...profileQuery(apiFetch, profileUrl),
    ...(options?.queryOptionsOverride ?? {}),
    select(data: readonly Profile[]) {
      return data.find(createFilter(filter));
    },
  });
}

function createFilter(filter: UseProfileFilter) {
  const filters: Array<(p: Profile) => boolean> = [];
  if (filter.name) {
    filters.push((a) => a.name === filter.name);
  }
  if (filter.link) {
    filters.push((a) => a.link.href === filter.link!.href);
  }

  return filters.reduce(
    (a, b) => (p: Profile) => a(p) && b(p),
    () => true,
  );
}
