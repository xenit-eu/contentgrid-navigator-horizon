/**
 * Hand-built HAL responses and a fetch over them, for the item detail view's tests and story
 * (also reused as the base `customer` entity by `../test-fixtures/collection.ts` for the
 * collection view's own tests). One entity (`customer`) with `id` and `name`, one item, no
 * relations or content. `createFixtureFetch({ withRelation: true })` opts in to a to-many `orders`
 * relation (an `order` entity with two items) on that customer, for the side-by-side layout, which
 * only splits into columns when the item has relations; the base bodies stay relation-free.
 */
export const API = "https://api.example.com";
export const PROFILE_URL = `${API}/profile`;
export const CUSTOMER_PROFILE_URL = `${API}/profile/customers`;
export const CUSTOMER_COLLECTION_URL = `${API}/customers`;
export const CUSTOMER_ITEM_URL = `${CUSTOMER_COLLECTION_URL}/cust-001`;

export const ORDER_PROFILE_URL = `${API}/profile/orders`;
export const ORDER_COLLECTION_URL = `${API}/orders`;
/** The `orders` relation of `cust-001`: the `cg:relation` link on the item points here. */
export const CUSTOMER_ORDERS_URL = `${CUSTOMER_ITEM_URL}/orders`;

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

/** `customerProfileBody` plus a to-many `orders` relation targeting the `order` entity. */
export const customerProfileBodyWithRelation = {
  ...customerProfileBody,
  _embedded: {
    ...customerProfileBody._embedded,
    "blueprint:relation": [
      {
        name: "orders",
        title: "Orders",
        description: null,
        many_source_per_target: false,
        many_target_per_source: true,
        required: false,
        _links: { "blueprint:target-entity": { href: ORDER_PROFILE_URL } },
      },
    ],
  },
};

/** The profile root with the `order` entity listed next to `customer`. */
export const profileRootBodyWithRelation = {
  ...profileRootBody,
  _links: {
    ...profileRootBody._links,
    "cg:entity": [
      ...profileRootBody._links["cg:entity"],
      { href: ORDER_PROFILE_URL, name: "order", title: "Order" },
    ],
  },
};

export const orderProfileBody = {
  name: "order",
  title: "Order",
  description: null,
  _embedded: {
    "blueprint:attribute": [
      stringAttribute("id", "id", true),
      stringAttribute("reference", "Reference", false),
    ],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: ORDER_PROFILE_URL, title: "Order" },
    describes: [
      { href: ORDER_COLLECTION_URL, title: "Orders", name: "collection" },
      { href: `${ORDER_COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: customerProfileBody._links.curies,
  },
  _templates: {},
};

/** The orders linked to `cust-001`, as the `orders` relation answers. */
export const customerOrdersBody = {
  _embedded: {
    item: ["ORD-1001", "ORD-1002"].map((reference, i) => ({
      id: `ord-00${i + 1}`,
      reference,
      _links: { self: { href: `${ORDER_COLLECTION_URL}/ord-00${i + 1}` } },
    })),
  },
  _links: { self: { href: CUSTOMER_ORDERS_URL } },
  page: { size: 20, total_items_exact: 2 },
};

export const customerItemBody = {
  id: "cust-001",
  name: "Acme Corp",
  _links: { self: { href: CUSTOMER_ITEM_URL } },
};

/** The item's mutation templates, by name: present only when the user may do that to the item. */
export type ItemTemplate = "default" | "delete";

/** `customerItemBody` plus the named templates (`default` is the update form). */
export function customerItemBodyWith(templates: readonly ItemTemplate[], withRelation = false) {
  return {
    ...customerItemBody,
    ...(withRelation
      ? {
          _links: {
            ...customerItemBody._links,
            curies: profileRootBody._links.curies,
            "cg:relation": [{ href: CUSTOMER_ORDERS_URL, name: "orders" }],
          },
        }
      : {}),
    _templates: {
      ...(templates.includes("default")
        ? {
            default: {
              method: "PUT",
              target: CUSTOMER_ITEM_URL,
              contentType: "application/json",
              properties: [{ name: "name", type: "text" }],
            },
          }
        : {}),
      ...(templates.includes("delete")
        ? { delete: { method: "DELETE", target: CUSTOMER_ITEM_URL, properties: [] } }
        : {}),
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status === 200 ? "application/hal+json" : "application/problem+json",
    },
  });

/** A `TypedFetch`-shaped function that answers from the bodies above and counts item requests. */
export function createFixtureFetch(
  options: Readonly<{
    templates?: readonly ItemTemplate[];
    /** Gives the customer a to-many `orders` relation with two orders. */
    withRelation?: boolean;
  }> = {},
) {
  const { withRelation = false } = options;
  const counts = { item: 0 };
  const fetchFn = async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === PROFILE_URL)
      return json(withRelation ? profileRootBodyWithRelation : profileRootBody);
    if (url === CUSTOMER_PROFILE_URL) {
      return json(withRelation ? customerProfileBodyWithRelation : customerProfileBody);
    }
    if (withRelation && url === ORDER_PROFILE_URL) return json(orderProfileBody);
    if (url === CUSTOMER_ITEM_URL) {
      counts.item++;
      return json(customerItemBodyWith(options.templates ?? [], withRelation));
    }
    if (
      withRelation &&
      (url === CUSTOMER_ORDERS_URL || url.startsWith(`${CUSTOMER_ORDERS_URL}?`))
    ) {
      return json(customerOrdersBody);
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
