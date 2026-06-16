import { useQuery } from "@tanstack/react-query";
import { HalSlice } from "@contentgrid/hal";
import { ianaRelations } from "@contentgrid/hal/rels";
import { fetchHalSlice } from "../api/hal-client";
import type { OptionEntry } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";

/**
 * Map a single page's items from a HAL slice into normalised OptionEntry pairs.
 * Skips items without a `self` link.
 */
function mapSliceItems(slice: HalSlice<Record<string, unknown>>): OptionEntry[] {
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
}

/**
 * Fetch a remote options resource (application/hal+json with embedded `item` resources)
 * and return normalised { value, prompt }[] pairs.
 *
 * Per the HAL-FORMS contract (root CLAUDE.md "HAL-FORMS Templates"):
 *   options.link.href points to an application/hal+json resource whose embedded `item`
 *   entries are the allowed values. The `self` link href of each item is used as the
 *   value; the item's `title` or first string field is used as the prompt.
 *
 * All pages are fetched by following `next` links until exhausted, so paginated
 * option resources are always returned in full.
 *
 * @param href - Full URL of the remote options resource. Pass undefined/null to disable.
 */
export function useRemoteOptions(href: string | null | undefined) {
  const { apiFetch } = useNavigatorData();

  return useQuery({
    queryKey: queryKeys.remoteOptions(href ?? ""),
    queryFn: async (): Promise<OptionEntry[]> => {
      const entries: OptionEntry[] = [];

      let nextHref: string | null = href!;
      while (nextHref) {
        const slice: HalSlice<Record<string, unknown>> = await fetchHalSlice<
          Record<string, unknown>
        >(apiFetch, nextHref);
        entries.push(...mapSliceItems(slice));
        nextHref = slice.next?.href ?? null;
      }

      return entries;
    },
    staleTime: 5 * 60_000, // remote option lists change infrequently
    gcTime: 10 * 60_000,
    enabled: !!href,
  });
}
