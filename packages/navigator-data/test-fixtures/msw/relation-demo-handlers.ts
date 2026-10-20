import { type HttpHandler, HttpResponse, http } from "msw";

/**
 * Relation-rich, stateful demo model for the knowledge graph (spec 007) — used by the
 * navigator-data contract tests, the entity-graph feature tests and both apps' mock mode.
 *
 * Model (entity name → relations):
 *
 * - `customer`  → `orders` (to-many → order)
 * - `order`     → `customer` (to-one → customer, **required**), `products` (to-many → product)
 * - `product`   → `supplier` (to-one → supplier)
 * - `supplier`  → (no relations)
 * - `employee`  → `boss` (to-one → employee), `colleague` (to-many → employee)
 *
 * Data highlights (ids are UUID-like strings, unique across entity types):
 *
 * - Customer "Big Corp" has 25 orders; its `orders` relation reports only
 *   `total_items_estimate` (no exact count) and pages at 20 items.
 * - Order "ORD-001" has 3 products; order "ORD-002" has no `clear-customer` template (ABAC).
 * - Clearing any `order.customer` answers 400 `input/validation` (required relation).
 * - Deleting a customer that still has orders answers 409 `integrity/required-relation`.
 * - Employee "Alice" has boss "Bob" and colleagues ["Bob", "Alice"] — i.e. a parallel
 *   `boss` + `colleague` edge to Bob and a self-relation.
 * - Most items carry `delete` / `clear-*` templates; "ORD-001" and "Bob" have no `delete`.
 * - Employee "Carol" has her `colleague` relation ABAC-hidden (no `cg:relation` link).
 * - Product "Doohickey" has no supplier (empty to-one slot → 404 on the relation link).
 *
 * Every `createRelationDemoHandlers()` call gets its own fresh in-memory store, so tests are
 * isolated. Resources require a Bearer token (any value), like `createDemoHandlers`.
 */

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";
const PROBLEM_BASE = "https://contentgrid.cloud/problems";

export const RELATION_DEMO_PAGE_SIZE = 20;

interface DemoRelationDef {
  readonly name: string;
  readonly title: string;
  readonly target: string; // entity name
  readonly toMany: boolean;
  readonly required?: boolean;
}

interface DemoEntityDef {
  readonly name: string;
  readonly plural: string;
  readonly title: string;
  readonly attributes: readonly { readonly name: string; readonly title: string }[];
  readonly relations: readonly DemoRelationDef[];
}

export const RELATION_DEMO_ENTITIES: readonly DemoEntityDef[] = [
  {
    name: "customer",
    plural: "customers",
    title: "Customer",
    attributes: [
      { name: "name", title: "Name" },
      { name: "city", title: "City" },
    ],
    relations: [{ name: "orders", title: "Orders", target: "order", toMany: true }],
  },
  {
    name: "order",
    plural: "orders",
    title: "Order",
    attributes: [
      { name: "number", title: "Number" },
      { name: "status", title: "Status" },
    ],
    relations: [
      { name: "customer", title: "Customer", target: "customer", toMany: false, required: true },
      { name: "products", title: "Products", target: "product", toMany: true },
    ],
  },
  {
    name: "product",
    plural: "products",
    title: "Product",
    attributes: [{ name: "name", title: "Name" }],
    relations: [{ name: "supplier", title: "Supplier", target: "supplier", toMany: false }],
  },
  {
    name: "supplier",
    plural: "suppliers",
    title: "Supplier",
    attributes: [{ name: "name", title: "Name" }],
    relations: [],
  },
  {
    name: "employee",
    plural: "employees",
    title: "Employee",
    attributes: [{ name: "name", title: "Name" }],
    relations: [
      { name: "boss", title: "Boss", target: "employee", toMany: false },
      { name: "colleague", title: "Colleagues", target: "employee", toMany: true },
    ],
  },
];

interface DemoItem {
  readonly id: string;
  readonly entity: string;
  values: Record<string, string>;
  /** relation name → target ids (to-one: 0 or 1 entry). */
  relations: Record<string, string[]>;
  version: number;
  canDelete: boolean;
  /** Relation names whose `clear-<rel>` template is withheld (ABAC). */
  noClear: string[];
  /** Relation names whose count is reported as an estimate only. */
  estimated: string[];
  /** Relation names whose `cg:relation` link is withheld entirely (ABAC-hidden relation). */
  hidden: string[];
}

/** Stable ids exported so tests can address specific demo items. */
export const RELATION_DEMO_IDS = {
  bigCorp: "c0000000-0000-4000-8000-000000000001",
  smallShop: "c0000000-0000-4000-8000-000000000002",
  lonelyLtd: "c0000000-0000-4000-8000-000000000003",
  order: (n: number) => `o0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  product: (n: number) => `p0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  acme: "s0000000-0000-4000-8000-000000000001",
  alice: "e0000000-0000-4000-8000-000000000001",
  bob: "e0000000-0000-4000-8000-000000000002",
  carol: "e0000000-0000-4000-8000-000000000003",
} as const;

function seed(): Map<string, DemoItem> {
  const ids = RELATION_DEMO_IDS;
  const items: DemoItem[] = [];
  const add = (
    item: Omit<DemoItem, "version" | "noClear" | "estimated" | "hidden"> & Partial<DemoItem>,
  ) => items.push({ version: 1, noClear: [], estimated: [], hidden: [], ...item });

  const bigCorpOrders = Array.from({ length: 25 }, (_, i) => ids.order(i + 1));
  const smallShopOrders = [ids.order(26), ids.order(27)];

  add({
    id: ids.bigCorp,
    entity: "customer",
    values: { name: "Big Corp", city: "Antwerp" },
    relations: { orders: bigCorpOrders },
    canDelete: true,
    estimated: ["orders"],
  });
  add({
    id: ids.smallShop,
    entity: "customer",
    values: { name: "Small Shop", city: "Ghent" },
    relations: { orders: smallShopOrders },
    canDelete: true,
  });
  add({
    id: ids.lonelyLtd,
    entity: "customer",
    values: { name: "Lonely Ltd", city: "Brussels" },
    relations: { orders: [] },
    canDelete: true,
  });

  for (let n = 1; n <= 27; n++) {
    add({
      id: ids.order(n),
      entity: "order",
      values: { number: `ORD-${String(n).padStart(3, "0")}`, status: n % 2 ? "open" : "shipped" },
      relations: {
        customer: [n <= 25 ? ids.bigCorp : ids.smallShop],
        products: n === 1 ? [ids.product(1), ids.product(2), ids.product(3)] : [ids.product(4)],
      },
      canDelete: n !== 1,
      noClear: n === 2 ? ["customer"] : [],
    });
  }

  const productNames = ["Widget", "Gadget", "Sprocket", "Gizmo", "Doohickey"];
  productNames.forEach((name, i) =>
    add({
      id: ids.product(i + 1),
      entity: "product",
      values: { name },
      relations: { supplier: i < 4 ? [ids.acme] : [] },
      canDelete: true,
    }),
  );

  add({
    id: ids.acme,
    entity: "supplier",
    values: { name: "ACME" },
    relations: {},
    canDelete: true,
  });

  add({
    id: ids.alice,
    entity: "employee",
    values: { name: "Alice" },
    relations: { boss: [ids.bob], colleague: [ids.bob, ids.alice] },
    canDelete: true,
  });
  add({
    id: ids.bob,
    entity: "employee",
    values: { name: "Bob" },
    relations: { boss: [], colleague: [ids.alice] },
    canDelete: false,
  });
  add({
    id: ids.carol,
    entity: "employee",
    values: { name: "Carol" },
    relations: { boss: [ids.bob], colleague: [] },
    canDelete: true,
    hidden: ["colleague"],
  });

  return new Map(items.map((item) => [item.id, item]));
}

function problem(status: number, type: string, title: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: `${PROBLEM_BASE}/${type}`, status, title, ...extra },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/**
 * The in-memory demo model behind `createRelationDemoHandlers` — also used directly (without
 * HTTP) by `test-fixtures/hal/relation-demo-accessors.ts` to build accessor instances for pure
 * unit tests. Every call gets a fresh store.
 */
export function createRelationDemoModel(baseUrl = "") {
  const store = seed();
  const entityByName = new Map(RELATION_DEMO_ENTITIES.map((e) => [e.name, e]));

  const profileUrl = (e: DemoEntityDef) => `${baseUrl}/profile/${e.plural}`;
  const collectionUrl = (e: DemoEntityDef) => `${baseUrl}/${e.plural}`;
  const itemUrl = (item: DemoItem) => `${collectionUrl(entityByName.get(item.entity)!)}/${item.id}`;

  function findItem(entity: DemoEntityDef, id: unknown): DemoItem | undefined {
    const item = typeof id === "string" ? store.get(id) : undefined;
    return item && item.entity === entity.name ? item : undefined;
  }

  function itemBody(item: DemoItem) {
    const entity = entityByName.get(item.entity)!;
    const self = itemUrl(item);
    const templates: Record<string, unknown> = {};
    if (item.canDelete) {
      templates.delete = { method: "DELETE", target: self, properties: [] };
    }
    for (const rel of entity.relations) {
      const relUrl = `${self}/${rel.name}`;
      if (rel.toMany) {
        templates[`add-${rel.name}`] = {
          method: "POST",
          target: relUrl,
          contentType: "text/uri-list",
          properties: [{ name: rel.name, type: "url", options: {} }],
        };
      } else {
        templates[`set-${rel.name}`] = {
          method: "PUT",
          target: relUrl,
          contentType: "text/uri-list",
          properties: [{ name: rel.name, type: "url" }],
        };
      }
      if (!item.noClear.includes(rel.name)) {
        templates[`clear-${rel.name}`] = { method: "DELETE", target: relUrl, properties: [] };
      }
    }
    return {
      id: item.id,
      ...item.values,
      _links: {
        self: { href: self },
        curies: [
          { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
        ],
        [CG_RELATION_REL]: entity.relations
          .filter((rel) => !item.hidden.includes(rel.name))
          .map((rel) => ({ href: `${self}/${rel.name}`, name: rel.name })),
      },
      _templates: templates,
    };
  }

  /** One page of a collection; the cursor is an opaque page index owned by this server. */
  function pageBody(url: string, items: DemoItem[], estimated: boolean, cursor: number) {
    const start = cursor * RELATION_DEMO_PAGE_SIZE;
    const page = items.slice(start, start + RELATION_DEMO_PAGE_SIZE);
    const links: Record<string, { href: string }> = {
      self: { href: cursor ? `${url}?_cursor=${cursor}` : url },
    };
    if (start + RELATION_DEMO_PAGE_SIZE < items.length) {
      links.next = { href: `${url}?_cursor=${cursor + 1}` };
    }
    if (cursor > 0) {
      links.prev = { href: cursor === 1 ? url : `${url}?_cursor=${cursor - 1}` };
    }
    return {
      _embedded: { item: page.map(itemBody) },
      _links: links,
      page: estimated
        ? { size: RELATION_DEMO_PAGE_SIZE, total_items_estimate: items.length }
        : {
            size: RELATION_DEMO_PAGE_SIZE,
            total_items_estimate: items.length,
            total_items_exact: items.length,
          },
    };
  }

  /** Current targets of one relation of one item (dangling ids dropped). */
  function relationTargets(item: DemoItem, relationName: string): DemoItem[] {
    return (item.relations[relationName] ?? [])
      .map((id) => store.get(id))
      .filter((t): t is DemoItem => t !== undefined);
  }

  function profileBody(entity: DemoEntityDef) {
    return {
      name: entity.name,
      title: entity.title,
      description: null,
      _links: {
        self: { href: profileUrl(entity) },
        describes: [
          { href: collectionUrl(entity), name: "collection" },
          { href: `${collectionUrl(entity)}/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            name: "blueprint",
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            templated: true,
          },
        ],
      },
      _embedded: {
        "blueprint:attribute": [
          { name: "id", title: "ID", readOnly: true },
          ...entity.attributes.map((a) => ({ ...a, readOnly: false })),
        ].map((a) => ({
          name: a.name,
          title: a.title,
          type: "string",
          description: null,
          readOnly: a.readOnly,
          _embedded: {
            "blueprint:constraint": [],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        })),
        [BLUEPRINT_RELATION_REL]: entity.relations.map((rel) => {
          const target = entityByName.get(rel.target)!;
          return {
            name: rel.name,
            title: rel.title,
            description: null,
            required: rel.required ?? false,
            // Only customer.orders is one-to-many; every other relation allows many sources per target.
            many_source_per_target: rel.name !== "orders",
            many_target_per_source: rel.toMany,
            _links: {
              self: { href: `${profileUrl(entity)}/relations/${rel.name}` },
              [BLUEPRINT_TARGET_ENTITY_REL]: {
                href: profileUrl(target),
                name: target.name,
                title: target.title,
              },
            },
          };
        }),
      },
      _templates: {
        search: { method: "GET", target: collectionUrl(entity), properties: [] },
      },
    };
  }

  function removeReferencesTo(id: string) {
    for (const other of store.values()) {
      for (const rel of Object.keys(other.relations)) {
        const before = other.relations[rel]!.length;
        other.relations[rel] = other.relations[rel]!.filter((t) => t !== id);
        if (other.relations[rel]!.length !== before) other.version++;
      }
    }
  }

  return {
    store,
    entityByName,
    profileUrl,
    collectionUrl,
    itemUrl,
    findItem,
    itemBody,
    pageBody,
    relationTargets,
    profileBody,
    removeReferencesTo,
  };
}

export type RelationDemoModel = ReturnType<typeof createRelationDemoModel>;

export interface RelationDemoOptions {
  /** Require an `Authorization: Bearer …` header on every request (default true). */
  readonly requireBearer?: boolean;
  /**
   * Extra `cg:entity` links to list in this module's `/profile` root, for when it is registered
   * in front of other demo handlers (e.g. `createDemoHandlers`' invoice) whose entities must stay
   * discoverable — MSW answers `/profile` from the first matching handler only.
   */
  readonly extraEntityLinks?: readonly { href: string; name: string; title: string }[];
}

export function createRelationDemoHandlers(
  baseUrl = "",
  options: RelationDemoOptions = {},
): HttpHandler[] {
  const { requireBearer = true, extraEntityLinks = [] } = options;
  const model = createRelationDemoModel(baseUrl);
  const {
    store,
    entityByName,
    profileUrl,
    collectionUrl,
    itemUrl,
    findItem,
    itemBody,
    relationTargets,
    profileBody,
    removeReferencesTo,
  } = model;

  const unauthorized = (request: Request) =>
    requireBearer && !request.headers.get("authorization")?.startsWith("Bearer ")
      ? problem(401, "unauthorized", "Unauthorized")
      : undefined;

  function itemResponse(item: DemoItem) {
    return HttpResponse.json(itemBody(item), { headers: { ETag: `"v${item.version}"` } });
  }

  function pageResponse(request: Request, url: string, items: DemoItem[], estimated: boolean) {
    const cursor = Number(new URL(request.url).searchParams.get("_cursor") ?? "0") || 0;
    return HttpResponse.json(model.pageBody(url, items, estimated, cursor));
  }

  const handlers: HttpHandler[] = [
    http.get(`${baseUrl}/profile`, ({ request }) => {
      return (
        unauthorized(request) ??
        HttpResponse.json({
          _links: {
            self: { href: `${baseUrl}/profile` },
            curies: [
              {
                name: "cg",
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                templated: true,
              },
            ],
            "cg:entity": [
              ...extraEntityLinks,
              ...RELATION_DEMO_ENTITIES.map((e) => ({
                href: profileUrl(e),
                name: e.name,
                title: e.title,
              })),
            ],
          },
          _templates: {},
        })
      );
    }),
  ];

  for (const entity of RELATION_DEMO_ENTITIES) {
    const base = collectionUrl(entity);

    handlers.push(
      http.get(profileUrl(entity), ({ request }) =>
        unauthorized(request) ? unauthorized(request) : HttpResponse.json(profileBody(entity)),
      ),

      http.get(base, ({ request }) => {
        const denied = unauthorized(request);
        if (denied) return denied;
        const all = [...store.values()].filter((i) => i.entity === entity.name);
        return pageResponse(request, base, all, false);
      }),

      http.get(`${base}/:id`, ({ request, params }) => {
        const denied = unauthorized(request);
        if (denied) return denied;
        const item = findItem(entity, params.id);
        return item ? itemResponse(item) : problem(404, "not-found/entity-item", "Not Found");
      }),

      http.delete(`${base}/:id`, ({ request, params }) => {
        const denied = unauthorized(request);
        if (denied) return denied;
        const item = findItem(entity, params.id);
        if (!item) return problem(404, "not-found/entity-item", "Not Found");
        if (!item.canDelete) return problem(403, "forbidden", "Forbidden");
        // Refuse when another item holds a *required* to-one relation to this one.
        for (const other of store.values()) {
          const otherDef = entityByName.get(other.entity)!;
          for (const rel of otherDef.relations) {
            if (rel.required && !rel.toMany && other.relations[rel.name]?.includes(item.id)) {
              return problem(409, "integrity/required-relation", "Relation is required", {
                detail: `${otherDef.title} ${other.values[otherDef.attributes[0]!.name]} requires this item via '${rel.name}'.`,
                affected_relation: `${itemUrl(other)}/${rel.name}`,
              });
            }
          }
        }
        store.delete(item.id);
        removeReferencesTo(item.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    for (const rel of entity.relations) {
      const target = entityByName.get(rel.target)!;

      handlers.push(
        http.get(`${base}/:id/${rel.name}`, ({ request, params }) => {
          const denied = unauthorized(request);
          if (denied) return denied;
          const item = findItem(entity, params.id);
          if (!item) return problem(404, "not-found/entity-item", "Not Found");
          const targets = relationTargets(item, rel.name);
          if (!rel.toMany) {
            const first = targets[0];
            return first
              ? itemResponse(first)
              : problem(404, "not-found/relation-item", "Not Found");
          }
          return pageResponse(
            request,
            `${itemUrl(item)}/${rel.name}`,
            targets,
            item.estimated.includes(rel.name),
          );
        }),

        http.delete(`${base}/:id/${rel.name}`, ({ request, params }) => {
          const denied = unauthorized(request);
          if (denied) return denied;
          const item = findItem(entity, params.id);
          if (!item) return problem(404, "not-found/entity-item", "Not Found");
          if (item.noClear.includes(rel.name)) return problem(403, "forbidden", "Forbidden");
          if (rel.required) {
            return problem(400, "input/validation", "Validation error", {
              errors: [
                {
                  type: `${PROBLEM_BASE}/input/validation/required`,
                  title: `${rel.title} is required`,
                  property: rel.name,
                },
              ],
            });
          }
          item.relations[rel.name] = [];
          item.version++;
          return new HttpResponse(null, { status: 204 });
        }),

        http.put(`${base}/:id/${rel.name}`, async ({ request, params }) => {
          const denied = unauthorized(request);
          if (denied) return denied;
          const item = findItem(entity, params.id);
          if (!item) return problem(404, "not-found/entity-item", "Not Found");
          const id = (await request.text()).trim().split("/").pop() ?? "";
          if (!findItem(target, id)) {
            return problem(400, "input/validation/missing-relation-target", "Missing target");
          }
          item.relations[rel.name] = [id];
          item.version++;
          return new HttpResponse(null, { status: 204 });
        }),

        http.post(`${base}/:id/${rel.name}`, async ({ request, params }) => {
          const denied = unauthorized(request);
          if (denied) return denied;
          const item = findItem(entity, params.id);
          if (!item) return problem(404, "not-found/entity-item", "Not Found");
          const ids = (await request.text())
            .split(/\r?\n/)
            .map((line) => line.trim().split("/").pop() ?? "")
            .filter((id) => findItem(target, id));
          item.relations[rel.name] = [...new Set([...(item.relations[rel.name] ?? []), ...ids])];
          item.version++;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      if (rel.toMany) {
        handlers.push(
          http.delete(`${base}/:id/${rel.name}/:targetId`, ({ request, params }) => {
            const denied = unauthorized(request);
            if (denied) return denied;
            const item = findItem(entity, params.id);
            if (!item) return problem(404, "not-found/entity-item", "Not Found");
            const before = item.relations[rel.name] ?? [];
            if (!before.includes(String(params.targetId))) {
              return problem(404, "not-found/relation-item", "Not Found");
            }
            item.relations[rel.name] = before.filter((t) => t !== params.targetId);
            item.version++;
            return new HttpResponse(null, { status: 204 });
          }),
        );
      }
    }
  }

  return handlers;
}
