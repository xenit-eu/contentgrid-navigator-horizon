import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../test-setup";
import { BASE, loadDumpProfile, makeProfileEntity, makeWrapper } from "../test-utils";
import { useRelationTargetSearch } from "./use-relation-target-search";

// Reuses the real, anonymised "customer" profile from the backend dump — same
// fixture use-typeahead.test.tsx uses — because it has a genuine prefix-match
// search property ("name~prefix"); a hand-built profile would need a matching
// `blueprint:search-param` embed to classify as prefixMatch (see search-form.ts's
// `resolveSearchType`), which a minimal fixture easily gets wrong silently.

const CUSTOMER_COLLECTION_URL = `${BASE}/customers`;

function makeCustomerProfile() {
  return makeProfileEntity(loadDumpProfile("customer"), "customers", "customer");
}

function customerCollectionBody(
  items: { name: string }[],
  opts: { selfHref?: string; nextHref?: string } = {},
) {
  return {
    _embedded: {
      item: items.map((item, i) => ({
        ...item,
        _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/${i}` } },
      })),
    },
    _links: {
      self: { href: opts.selfHref ?? CUSTOMER_COLLECTION_URL },
      ...(opts.nextHref ? { next: { href: opts.nextHref } } : {}),
    },
  };
}

function mockCustomerCollection(
  items: { name: string }[],
  onRequest?: (url: URL) => void,
  opts: { nextHref?: string } = {},
) {
  server.use(
    http.get(CUSTOMER_COLLECTION_URL, ({ request }) => {
      onRequest?.(new URL(request.url));
      return HttpResponse.json(customerCollectionBody(items, opts));
    }),
  );
}

describe("useRelationTargetSearch", () => {
  it("fetches the target collection with an empty search on mount", async () => {
    mockCustomerCollection([{ name: "Acme Corp" }]);
    const targetProfile = makeCustomerProfile();

    const { result } = renderHook(() => useRelationTargetSearch({ targetProfile }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it("debounces setSearchQuery and sends the query as the prefix-match parameter", async () => {
    let capturedUrl: URL | undefined;
    mockCustomerCollection([{ name: "Acme Corp" }], (url) => {
      capturedUrl = url;
    });
    const targetProfile = makeCustomerProfile();

    const { result } = renderHook(() => useRelationTargetSearch({ targetProfile }), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.setSearchQuery("Acm"));

    await waitFor(() => expect(capturedUrl?.searchParams.get("name~prefix")).toBe("Acm"), {
      timeout: 3000,
    });
  });

  it("paginates via nextHref/prevHref without re-encoding the search", async () => {
    const nextPageUrl = `${CUSTOMER_COLLECTION_URL}/page2`;
    mockCustomerCollection([{ name: "Acme Corp" }], undefined, { nextHref: nextPageUrl });
    server.use(
      http.get(nextPageUrl, () =>
        HttpResponse.json(
          customerCollectionBody([{ name: "Globex Inc" }], { selfHref: nextPageUrl }),
        ),
      ),
    );
    const targetProfile = makeCustomerProfile();

    const { result } = renderHook(() => useRelationTargetSearch({ targetProfile }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.goToNextPage());
    await waitFor(() => expect(result.current.items[0]?.halItem.data.name).toBe("Globex Inc"));
  });
});
