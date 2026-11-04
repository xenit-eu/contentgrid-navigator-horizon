import {
  CUSTOMER_COLLECTION_URL,
  CUSTOMER_PROFILE_URL,
  createFixtureFetch,
  customerProfileBody,
} from "./item-detail";

/**
 * The item-detail fixture's `customer` entity, extended for the collection view: a search
 * template with one filter (`name~prefix`), a create form, and a collection page of two items
 * with a next link. Every collection request is recorded in `collectionRequests`.
 */
export const CUSTOMER_NEXT_PAGE_URL = `${CUSTOMER_COLLECTION_URL}?_cursor=page2`;

const searchParam = { name: "name~prefix", title: "Name prefix", type: "prefix-match" };

export const searchableCustomerProfileBody = {
  ...customerProfileBody,
  _embedded: {
    ...customerProfileBody._embedded,
    "blueprint:attribute": customerProfileBody._embedded["blueprint:attribute"].map((attribute) =>
      attribute.name === "name"
        ? {
            ...attribute,
            _embedded: { ...attribute._embedded, "blueprint:search-param": [searchParam] },
          }
        : attribute,
    ),
  },
  _templates: {
    search: {
      method: "GET",
      target: CUSTOMER_COLLECTION_URL,
      properties: [{ name: "name~prefix", type: "text" }],
    },
    "create-form": {
      method: "POST",
      target: CUSTOMER_COLLECTION_URL,
      contentType: "application/json",
      properties: [{ name: "name", type: "text" }],
    },
  },
};

export const customerCollectionBody = {
  _embedded: {
    item: [
      {
        id: "cust-001",
        name: "Acme Corp",
        _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-001` } },
      },
      {
        id: "cust-002",
        name: "Globex",
        _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-002` } },
      },
    ],
  },
  _links: {
    self: { href: CUSTOMER_COLLECTION_URL },
    next: { href: CUSTOMER_NEXT_PAGE_URL },
  },
  page: { size: 2, total_items_exact: 2 },
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/hal+json" } });

/** A fetch that answers the collection fixture; anything else goes to the item-detail fixture. */
export function createCollectionFixtureFetch(
  options: Readonly<{ searchable?: boolean; creatable?: boolean }> = {},
) {
  const { searchable = true, creatable = true } = options;
  const itemFixture = createFixtureFetch();
  const collectionRequests: string[] = [];

  const profileBody = {
    ...searchableCustomerProfileBody,
    _templates: {
      ...(searchable ? { search: searchableCustomerProfileBody._templates.search } : {}),
      ...(creatable
        ? { "create-form": searchableCustomerProfileBody._templates["create-form"] }
        : {}),
    },
  };

  const fetchFn = async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === CUSTOMER_PROFILE_URL) {
      return json(profileBody);
    }
    if (url === CUSTOMER_COLLECTION_URL || url.startsWith(`${CUSTOMER_COLLECTION_URL}?`)) {
      collectionRequests.push(url);
      return json(customerCollectionBody);
    }
    return itemFixture.fetch(input);
  };
  return { fetch: fetchFn, collectionRequests };
}
