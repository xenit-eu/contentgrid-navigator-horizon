import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import {
  RESTRICTED_POLICY,
  type RecordedDump,
  type RecordedResponse,
  createDemoHandlers,
  placeholderForMimetype,
} from "./demo-handlers";

const ORIGIN = "https://recorded.navigator.test";
const BASE = "https://demo.test";
const AUTH = { Authorization: "Bearer test" };
// 1x1 PNG
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4ceIEAAS0AlkWLoFAAAAAAElFTkSuQmCC";

function item(
  id: string,
  extra: Record<string, unknown> = {},
  links: Record<string, unknown> = {},
) {
  return {
    _links: { self: { href: `${ORIGIN}/things/${id}` }, ...links },
    id,
    title: `Thing ${id}`,
    ...extra,
  };
}

const t1 = item(
  "t1",
  {
    doc: { filename: "file-1.png", mimetype: "image/png" },
    scan: { filename: "file-2.svg", mimetype: "image/svg+xml" },
    photo: { filename: "file-3.jpg", mimetype: "image/jpeg" },
  },
  {
    "cg:relation": [
      { href: `${ORIGIN}/things/t1/owner`, name: "owner" },
      { href: `${ORIGIN}/things/t1/parts`, name: "parts" },
    ],
    "cg:content": [
      { href: `${ORIGIN}/things/t1/doc`, name: "doc" },
      { href: `${ORIGIN}/things/t1/scan`, name: "scan" },
      { href: `${ORIGIN}/things/t1/photo`, name: "photo" },
    ],
  },
);
const t2 = item("t2");

const json = (body: unknown, extra: Partial<RecordedResponse> = {}): RecordedResponse => ({
  status: 200,
  contentType: "application/prs.hal-forms+json",
  etag: null,
  body,
  ...extra,
});

const FULL: RecordedDump = {
  capturedAt: "2026-01-01",
  responses: {
    "/profile": json({
      _links: { "cg:entity": [{ href: `${ORIGIN}/things`, name: "thing", title: "Thing" }] },
    }),
    "/profile/things": json({
      name: "thing",
      title: "Thing",
      _embedded: {
        "blueprint:relation": [
          { name: "owner", many_target_per_source: false },
          { name: "parts", many_target_per_source: true },
        ],
      },
    }),
    "/things?size=5": json({
      _embedded: { item: [t1] },
      page: { total_items_exact: 1 },
    }),
    "/things/t1": json(t1, { etag: '"abc"' }),
    "/things/t2": json(t2),
    "/things/t1/owner": {
      status: 302,
      contentType: null,
      etag: null,
      location: `${ORIGIN}/things/t2`,
    },
    "/things/t1/parts": json({
      _embedded: { item: [t2] },
      _links: { self: { href: `${ORIGIN}/things/t1/parts` } },
      page: { total_items_exact: 1 },
    }),
    "/things/t1/doc": {
      status: 200,
      contentType: "image/png",
      etag: null,
      bodyBase64: PNG_BASE64,
    },
  },
};

// --- Policy fixtures: the plurals RESTRICTED_POLICY keys on, with their real-world templates. ---

const WRITE_TEMPLATES = {
  default: { method: "PUT" },
  delete: { method: "DELETE" },
  "add-rel": { method: "POST" },
  "set-rel": { method: "PUT" },
  "clear-rel": { method: "DELETE" },
};

function policyEntity(
  plural: string,
  name: string,
  ids: string[],
): Record<string, RecordedResponse> {
  const items = ids.map((id) => ({
    _links: { self: { href: `${ORIGIN}/${plural}/${id}` } },
    _templates: WRITE_TEMPLATES,
    id,
    title: id,
  }));
  return {
    [`/profile/${plural}`]: json({
      name,
      title: name,
      _templates: { search: { method: "GET" }, "create-form": { method: "POST" } },
    }),
    [`/${plural}?size=5`]: json({
      _embedded: { item: items },
      page: { total_items_exact: ids.length, total_items_estimate: ids.length },
    }),
    ...Object.fromEntries(items.map((i) => [`/${plural}/${i.id}`, json(i)])),
  };
}

/** Ids for `customers`: some hidden by the policy, some visible. */
function customerIds() {
  const hidden: string[] = [];
  const visible: string[] = [];
  for (let n = 0; hidden.length < 2 || visible.length < 3; n++) {
    const id = `c${n}`;
    const list = RESTRICTED_POLICY.customers.hideRow?.(id) ? hidden : visible;
    if (list.length < (list === hidden ? 2 : 3)) list.push(id);
  }
  return { hidden, visible, all: [hidden[0], visible[0], visible[1], hidden[1], visible[2]] };
}
const customers = customerIds();

const POLICY_DUMP: RecordedDump = {
  capturedAt: "2026-01-01",
  responses: {
    ...FULL.responses,
    "/profile": json({
      _links: {
        "cg:entity": ["things", "products", "orderses", "categories", "articles", "customers"].map(
          (plural) => ({ href: `${ORIGIN}/${plural}`, name: plural, title: plural }),
        ),
      },
    }),
    ...policyEntity("products", "product", ["p1"]),
    ...policyEntity("orderses", "order", ["o1"]),
    ...policyEntity("categories", "category", ["k1"]),
    ...policyEntity("articles", "article", ["a1"]),
    ...policyEntity("customers", "customer", customers.all),
    // A recorded to-many page of another entity that lists every customer.
    "/orderses/o1/buyers": json({
      _embedded: {
        item: customers.all.map((id) => ({
          _links: { self: { href: `${ORIGIN}/customers/${id}` } },
          _templates: WRITE_TEMPLATES,
          id,
        })),
      },
      page: { total_items_exact: customers.all.length },
    }),
  },
};

function use(options: Parameters<typeof createDemoHandlers>[1] = {}) {
  server.use(...createDemoHandlers(BASE, { dump: FULL, ...options }));
}

function usePolicy(user: "full" | "restricted") {
  server.use(...createDemoHandlers(BASE, { dump: POLICY_DUMP, user }));
}

const get = (path: string) => fetch(`${BASE}${path}`, { headers: AUTH });
const write = (method: string, path: string) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: method === "DELETE" ? undefined : "{}",
  });
const templatesOf = async (path: string) =>
  Object.keys(((await (await get(path)).json()) as { _templates: object })._templates);

afterEach(() => vi.restoreAllMocks());

describe("createDemoHandlers (recorded replay)", () => {
  it("replays a to-one redirect with Location rewritten to the base URL", async () => {
    use();
    const res = await fetch(`${BASE}/things/t1/owner`, { headers: AUTH, redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${BASE}/things/t2`);
  });

  it("serves the redirect target item recorded from the to-many page", async () => {
    use();
    const res = await fetch(`${BASE}/things/t2`, { headers: AUTH });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe("t2");
  });

  it("replays a recorded to-many page with rewritten links", async () => {
    use();
    const res = await fetch(`${BASE}/things/t1/parts`, { headers: AUTH });
    const body = (await res.json()) as {
      _embedded: { item: { id: string }[] };
      _links: { self: { href: string } };
    };
    expect(body._embedded.item.map((i) => i.id)).toEqual(["t2"]);
    expect(body._links.self.href).toBe(`${BASE}/things/t1/parts`);
  });

  it("replays recorded ETag and content type on items", async () => {
    use();
    const res = await fetch(`${BASE}/things/t1`, { headers: AUTH });
    expect(res.headers.get("ETag")).toBe('"abc"');
    expect(res.headers.get("Content-Type")).toBe("application/prs.hal-forms+json");
  });

  it("serves base64 content with the recorded content type and filename", async () => {
    use();
    const res = await fetch(`${BASE}/things/t1/doc`, { headers: AUTH });
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toContain("file-1.png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("answers 405 problem+json (and warns) for an unknown write", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    use();
    const res = await fetch(`${BASE}/things`, {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(405);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("falls back to generated placeholders matching the mimetype when no bytes are recorded", async () => {
    use();
    const svg = await fetch(`${BASE}/things/t1/scan`, { headers: AUTH });
    expect(svg.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await svg.text()).toContain("<svg");

    const jpeg = await fetch(`${BASE}/things/t1/photo`, { headers: AUTH });
    expect(jpeg.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("requires a Bearer token on recorded resources", async () => {
    use();
    const res = await fetch(`${BASE}/things/t2`);
    expect(res.status).toBe(401);
  });
});

describe("placeholderForMimetype", () => {
  it.each([
    ["image/png", "image/png"],
    ["image/jpeg", "image/jpeg"],
    ["image/svg+xml", "image/svg+xml"],
    ["application/pdf", "application/pdf"],
    [undefined, "application/pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
  ])("maps %s to %s", (mimetype, expected) => {
    expect(placeholderForMimetype(mimetype).contentType).toBe(expected);
  });
});

describe("restricted user (derived policy)", () => {
  it("leaves the full user untouched", async () => {
    usePolicy("full");
    expect(await templatesOf("/products/p1")).toContain("delete");
    expect((await write("PATCH", "/products/p1")).status).toBe(405);
    expect((await get("/articles/a1")).status).toBe(200);
    const page = (await (await get("/customers")).json()) as {
      page: { total_items_exact: number };
    };
    expect(page.page.total_items_exact).toBe(customers.all.length);
  });

  it("products: read-only", async () => {
    usePolicy("restricted");
    expect(await templatesOf("/products/p1")).toEqual([]);
    expect(
      Object.keys(
        ((await (await get("/profile/products")).json()) as { _templates: object })._templates,
      ),
    ).toEqual(["search"]);
    for (const [method, path] of [
      ["PATCH", "/products/p1"],
      ["PUT", "/products/p1"],
      ["DELETE", "/products/p1"],
      ["POST", "/products/p1/rel"],
      ["PUT", "/products/p1/rel"],
      ["DELETE", "/products/p1/rel"],
      ["POST", "/products"],
    ]) {
      const res = await write(method, path);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    }
  });

  it("orderses: no delete", async () => {
    usePolicy("restricted");
    const templates = await templatesOf("/orderses/o1");
    expect(templates).not.toContain("delete");
    expect(templates).toEqual(
      expect.arrayContaining(["default", "add-rel", "set-rel", "clear-rel"]),
    );
    expect((await write("DELETE", "/orderses/o1")).status).toBe(403);
    // Other writes are not the policy's business (no handler -> 405).
    expect((await write("PATCH", "/orderses/o1")).status).toBe(405);
  });

  it("categories: no create", async () => {
    usePolicy("restricted");
    const profile = (await (await get("/profile/categories")).json()) as { _templates: object };
    expect(Object.keys(profile._templates)).toEqual(["search"]);
    expect((await write("POST", "/categories")).status).toBe(403);
    expect(await templatesOf("/categories/k1")).toContain("delete");
  });

  it("articles: not readable, but the entity and its profile stay visible", async () => {
    usePolicy("restricted");
    const page = (await (await get("/articles")).json()) as {
      _embedded: { item: unknown[] };
      page: { total_items_exact: number; total_items_estimate: number };
    };
    expect(page._embedded.item).toEqual([]);
    expect(page.page.total_items_exact).toBe(0);
    expect(page.page.total_items_estimate).toBe(0);
    expect((await get("/profile/articles")).status).toBe(200);

    const item = await get("/articles/a1");
    expect(item.status).toBe(404);
    expect(item.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await item.json()).toEqual({
      type: "https://contentgrid.cloud/problems/not-found/entity-item",
      title: "Entity item not found",
      status: 404,
      detail: "Entity 'article' item 'a1' not found",
    });
  });

  it("customers: a subset is invisible in pages, totals, relation pages and item reads", async () => {
    usePolicy("restricted");
    const page = (await (await get("/customers")).json()) as {
      _embedded: { item: { id: string }[] };
      page: { total_items_exact: number; total_items_estimate: number };
    };
    expect(page._embedded.item.map((i) => i.id)).toEqual(customers.visible);
    expect(page.page.total_items_exact).toBe(customers.visible.length);
    expect(page.page.total_items_estimate).toBe(customers.visible.length);

    const hidden = await get(`/customers/${customers.hidden[0]}`);
    expect(hidden.status).toBe(404);
    expect(((await hidden.json()) as { detail: string }).detail).toBe(
      `Entity 'customer' item '${customers.hidden[0]}' not found`,
    );
    expect((await get(`/customers/${customers.visible[0]}`)).status).toBe(200);

    const related = (await (await get("/orderses/o1/buyers")).json()) as {
      _embedded: { item: { id: string }[] };
      page: { total_items_exact: number };
    };
    expect(related._embedded.item.map((i) => i.id)).toEqual(customers.visible);
    expect(related.page.total_items_exact).toBe(customers.visible.length);
  });
});
