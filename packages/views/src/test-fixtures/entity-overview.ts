import { API, PROFILE_URL } from "./item-detail";

/**
 * Hand-built HAL responses and a fetch over them, for the Home and Settings overview stories:
 * four entities, each with an empty search template (so Home's count request runs) and a
 * collection that reports its total (one of them as an estimate). The first three fill one row of a 960px-wide page and put a
 * long title, a long description and no description side by side, so the stories show that the
 * text clamps and the count line stays at the bottom of the card.
 */
const overviewEntities = [
  {
    name: "purchase-order-confirmation",
    title: "Purchase order confirmation",
    pluralTitle: "Purchase order confirmations from external suppliers",
    description: "Replies from suppliers to a purchase order.",
    count: 1,
  },
  {
    name: "invoice",
    title: "Invoice",
    pluralTitle: "Invoices",
    description:
      "Bills sent to customers, with their order lines, the due date, the payment status and every reminder that was sent while the invoice stayed unpaid.",
    count: 1284,
    estimated: true,
  },
  { name: "supplier", title: "Supplier", pluralTitle: "Suppliers", description: null, count: 37 },
  {
    name: "contract",
    title: "Contract",
    pluralTitle: "Contracts",
    description: "Signed agreements.",
    count: 0,
  },
] as const;

/** The entity names, in the order the profile root lists them. */
export const OVERVIEW_ENTITY_NAMES = overviewEntities.map((entity) => entity.name);

const profileUrlOf = (name: string) => `${API}/profile/${name}s`;
const collectionUrlOf = (name: string) => `${API}/${name}s`;

const nameAttribute = {
  name: "name",
  title: "Name",
  type: "string",
  description: null,
  readOnly: false,
  required: false,
  _embedded: {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": [],
  },
  _links: {},
};

const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": overviewEntities.map((entity) => ({
      href: profileUrlOf(entity.name),
      name: entity.name,
      title: entity.title,
    })),
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

function profileBody(entity: (typeof overviewEntities)[number]) {
  const collectionUrl = collectionUrlOf(entity.name);
  return {
    name: entity.name,
    title: entity.title,
    description: entity.description,
    _embedded: { "blueprint:attribute": [nameAttribute], "blueprint:relation": [] },
    _links: {
      self: { href: profileUrlOf(entity.name), title: entity.title },
      describes: [
        { href: collectionUrl, title: entity.pluralTitle, name: "collection" },
        { href: `${collectionUrl}/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
    _templates: { search: { method: "GET", target: collectionUrl, properties: [] } },
  };
}

function collectionBody(entity: (typeof overviewEntities)[number]) {
  return {
    _embedded: { item: [] },
    _links: { self: { href: collectionUrlOf(entity.name) } },
    page:
      "estimated" in entity
        ? { size: 20, total_items_estimate: entity.count }
        : { size: 20, total_items_exact: entity.count },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status === 200 ? "application/hal+json" : "application/problem+json",
    },
  });

/** A `TypedFetch`-shaped function that answers the profile root, profiles and collections above. */
export function createEntityOverviewFixtureFetch() {
  return async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === PROFILE_URL) return json(profileRootBody);
    for (const entity of overviewEntities) {
      if (url === profileUrlOf(entity.name)) return json(profileBody(entity));
      const collectionUrl = collectionUrlOf(entity.name);
      if (url === collectionUrl || url.startsWith(`${collectionUrl}?`)) {
        return json(collectionBody(entity));
      }
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
}
