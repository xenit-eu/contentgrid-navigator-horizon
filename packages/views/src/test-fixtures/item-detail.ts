/**
 * Hand-built HAL responses and a fetch over them, for the item detail view's tests and story.
 * One entity (`customer`) with `id` and `name`, one item, no relations or content.
 */
export const API = "https://api.example.com";
export const PROFILE_URL = `${API}/profile`;
export const CUSTOMER_PROFILE_URL = `${API}/profile/customers`;
export const CUSTOMER_COLLECTION_URL = `${API}/customers`;
export const CUSTOMER_ITEM_URL = `${CUSTOMER_COLLECTION_URL}/cust-001`;

const stringAttribute = (name: string, title: string, readOnly: boolean) => ({
  name,
  title,
  type: "string",
  description: null,
  readOnly,
  required: false,
  _embedded: {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": [],
  },
  _links: {},
});

export const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [{ href: CUSTOMER_PROFILE_URL, name: "customer", title: "Customer" }],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

export const customerProfileBody = {
  name: "customer",
  title: "Customer",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      stringAttribute("id", "id", true),
      stringAttribute("name", "Name", false),
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: CUSTOMER_PROFILE_URL, title: "Customer" },
    describes: [
      { href: CUSTOMER_COLLECTION_URL, title: "Customers", name: "collection" },
      { href: `${CUSTOMER_COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {},
};

export const customerItemBody = {
  id: "cust-001",
  name: "Acme Corp",
  _links: { self: { href: CUSTOMER_ITEM_URL } },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status === 200 ? "application/hal+json" : "application/problem+json",
    },
  });

/** A `TypedFetch`-shaped function that answers from the bodies above and counts item requests. */
export function createFixtureFetch() {
  const counts = { item: 0 };
  const fetchFn = async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === PROFILE_URL) return json(profileRootBody);
    if (url === CUSTOMER_PROFILE_URL) return json(customerProfileBody);
    if (url === CUSTOMER_ITEM_URL) {
      counts.item++;
      return json(customerItemBody);
    }
    return json(
      {
        type: "https://contentgrid.cloud/problems/not-found/endpoint",
        title: "Not found",
        status: 404,
      },
      404,
    );
  };
  return { fetch: fetchFn, counts };
}
