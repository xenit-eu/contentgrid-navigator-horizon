import {
  API,
  CUSTOMER_COLLECTION_URL,
  CUSTOMER_PROFILE_URL,
  PROFILE_URL,
  createFixtureFetch,
  customerProfileBody,
  profileRootBody,
} from "./item-detail";

/**
 * The item-detail fixture's `customer` entity, extended for the collection view: a search
 * template with one filter (`name~prefix`) and one sort option (`name,asc`), a create form, and a
 * collection page of two items with a next link. Every collection request is recorded in
 * `collectionRequests`.
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
      properties: [
        { name: "name~prefix", type: "text" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            inline: [{ property: "name", direction: "asc", value: "name,asc", prompt: "Name A→Z" }],
          },
        },
      ],
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

export const SUPPLIER_PROFILE_URL = `${API}/profile/suppliers`;
export const SUPPLIER_COLLECTION_URL = `${API}/suppliers`;

/**
 * A second entity, so tests can switch from `customer` to another entity that really exists. It
 * deliberately reuses customer's attributes (only its links differ): it exists for entity-switch tests.
 */
export const supplierProfileBody = {
  ...customerProfileBody,
  name: "supplier",
  title: "Supplier",
  _links: {
    ...customerProfileBody._links,
    self: { href: SUPPLIER_PROFILE_URL, title: "Supplier" },
    describes: [
      { href: SUPPLIER_COLLECTION_URL, title: "Suppliers", name: "collection" },
      { href: `${SUPPLIER_COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
  },
  _templates: {
    search: {
      ...searchableCustomerProfileBody._templates.search,
      target: SUPPLIER_COLLECTION_URL,
    },
  },
};

export const supplierCollectionBody = {
  _embedded: {
    item: [
      {
        id: "sup-001",
        name: "Initech Supplies",
        _links: { self: { href: `${SUPPLIER_COLLECTION_URL}/sup-001` } },
      },
    ],
  },
  _links: { self: { href: SUPPLIER_COLLECTION_URL } },
  page: { size: 1, total_items_exact: 1 },
};

const rootBodyWithSupplier = {
  ...profileRootBody,
  _links: {
    ...profileRootBody._links,
    "cg:entity": [
      ...profileRootBody._links["cg:entity"],
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
    ],
  },
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/hal+json" } });

/** A fetch that answers the collection fixture (customers, plus a second `supplier` entity); anything else goes to the item-detail fixture. */
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
    if (url === PROFILE_URL) {
      return json(rootBodyWithSupplier);
    }
    if (url === CUSTOMER_PROFILE_URL) {
      return json(profileBody);
    }
    if (url === SUPPLIER_PROFILE_URL) {
      return json(supplierProfileBody);
    }
    if (url === SUPPLIER_COLLECTION_URL || url.startsWith(`${SUPPLIER_COLLECTION_URL}?`)) {
      collectionRequests.push(url);
      return json(supplierCollectionBody);
    }
    if (url === CUSTOMER_COLLECTION_URL || url.startsWith(`${CUSTOMER_COLLECTION_URL}?`)) {
      collectionRequests.push(url);
      return json(customerCollectionBody);
    }
    return itemFixture.fetch(input);
  };
  return { fetch: fetchFn, collectionRequests, itemCounts: itemFixture.counts };
}
