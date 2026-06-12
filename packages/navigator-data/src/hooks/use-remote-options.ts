import { useQuery } from "@tanstack/react-query";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHalSlice } from "../api/hal-client";
import type { OptionEntry } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

/**
 * Fetch a remote options resource (application/hal+json with embedded `item` resources)
 * and return normalised { value, prompt }[] pairs.
 *
 * Per the HAL-FORMS contract (root CLAUDE.md "HAL-FORMS Templates"):
 *   options.link.href points to an application/hal+json resource whose embedded `item`
 *   entries are the allowed values. The `self` link href of each item is used as the
 *   value; the item's `title` or first string field is used as the prompt.
 *
 * @param href - Full URL of the remote options resource. Pass undefined/null to disable.
 */
export function useRemoteOptions(href: string | null | undefined) {
  const { apiFetch } = useNavigatorData();

  return useQuery({
    queryKey: queryKeys.remoteOptions(href ?? ""),
    queryFn: async (): Promise<OptionEntry[]> => {
      const slice = await fetchHalSlice<Record<string, unknown>>(apiFetch, href!);
      return slice.items.flatMap((item) => {
        const selfLink = item.links.findLink(ianaRelations.self);
        const selfHref = selfLink?.href;
        if (!selfHref) return [];

        // Use title field if present, else fall back to the last path segment of the self href.
        const data = item.data as Record<string, unknown>;
        const title =
          typeof data.title === "string" && data.title
            ? data.title
            : (selfHref.split("/").pop() ?? selfHref);

        return [{ value: selfHref, prompt: title }];
      });
    },
    staleTime: 5 * 60_000, // remote option lists change infrequently
    gcTime: 10 * 60_000,
    enabled: !!href,
  });
}
