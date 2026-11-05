import { type HttpHandler, HttpResponse, http } from "msw";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import type ProfileEntity from "../../src/accessors/entity-profile";
import { makeProfileEntity } from "../hal/profile-entity";
import { type ListHandlerConfig, createListHandler } from "./handlers";

/**
 * A hand-built `search-bar` entity profile covering every search-parameter shape the single
 * search bar handles: prefix, full-text, exact text, allowed values, integer and decimal (exact
 * and range), date and datetime ranges, boolean, the created/modified audit constraints, and two
 * to-one relations with prefix parameters.
 *
 * The committed backend dump (`../entity-profiles/entity-profiles-dump.json`) has no full-text
 * parameter, no `date`-typed parameter, no decimal search parameter and no audit-constrained
 * attribute, so this fixture is hand-built — but it follows the dump's real shapes: every
 * attribute carries its own `blueprint:search-param` embeds (so search types resolve through
 * the backend-driven path, not the suffix-parsing fallback), every search property carries a
 * `prompt`, and inline options are plain strings.
 */

export const SEARCH_BAR_BASE = "https://api.example.com";
export const SEARCH_BAR_PROFILE_ROOT_URL = `${SEARCH_BAR_BASE}/profile`;
export const SEARCH_BAR_PROFILE_URL = `${SEARCH_BAR_BASE}/profile/search-bars`;
export const SEARCH_BAR_COLLECTION_URL = `${SEARCH_BAR_BASE}/search-bars`;
export const SEARCH_BAR_CUSTOMER_PROFILE_URL = `${SEARCH_BAR_BASE}/profile/customers`;
export const SEARCH_BAR_CUSTOMER_COLLECTION_URL = `${SEARCH_BAR_BASE}/customers`;
export const SEARCH_BAR_OWNER_PROFILE_URL = `${SEARCH_BAR_BASE}/profile/owners`;
export const SEARCH_BAR_OWNER_COLLECTION_URL = `${SEARCH_BAR_BASE}/owners`;

type SearchParamType =
  | "exact-match"
  | "prefix-match"
  | "full-text"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal";

type SearchParam = [name: string, title: string, type: SearchParamType];

function attribute(opts: {
  name: string;
  title: string;
  type: string;
  readOnly?: boolean;
  constraints?: Record<string, unknown>[];
  searchParams?: SearchParam[];
}) {
  return {
    name: opts.name,
    title: opts.title,
    type: opts.type,
    description: null,
    readOnly: opts.readOnly ?? false,
    required: false,
    _embedded: {
      "blueprint:constraint": opts.constraints ?? [],
      "blueprint:search-param": (opts.searchParams ?? []).map(([name, title, type]) => ({
        name,
        title,
        type,
      })),
      "blueprint:attribute": [],
    },
    _links: {},
  };
}

type ProfileAttributeJson = ReturnType<typeof attribute>;

const BOUNDS = {
  after: ["After", "greater-than"],
  before: ["Before", "less-than"],
  from: ["From", "greater-than-or-equal"],
  until: ["Until", "less-than-or-equal"],
  gte: ["Min", "greater-than-or-equal"],
  lte: ["Max", "less-than-or-equal"],
} as const satisfies Record<string, readonly [string, SearchParamType]>;

/** Range parameters named and titled the way the backend does: `amount~gte` / "Amount: Min". */
function boundParams(
  name: string,
  title: string,
  suffixes: (keyof typeof BOUNDS)[],
): SearchParam[] {
  return suffixes.map((suffix) => {
    const [label, type] = BOUNDS[suffix];
    return [`${name}~${suffix}`, `${title}: ${label}`, type];
  });
}

function numberAttribute(name: string, title: string, type: "long" | "double") {
  return attribute({
    name,
    title,
    type,
    searchParams: [[name, title, "exact-match"], ...boundParams(name, title, ["gte", "lte"])],
  });
}

/** A datetime with all four bounds; `constraint` makes it a read-only audit attribute. */
function datetimeAttribute(name: string, title: string, constraint?: string) {
  return attribute({
    name,
    title,
    type: "datetime",
    readOnly: constraint !== undefined,
    constraints: constraint === undefined ? [] : [{ type: constraint }],
    searchParams: boundParams(name, title, ["after", "before", "from", "until"]),
  });
}

interface SearchPropertyJson {
  name: string;
  prompt?: string;
  type: string;
  options?: Record<string, unknown>;
}

const WIRE_TYPES: Record<string, string> = {
  string: "text",
  long: "number",
  double: "number",
  date: "date",
  datetime: "datetime",
  boolean: "checkbox",
};

/**
 * The search template properties for the attributes' own search params, in order: prompt =
 * the param title, wire type from the attribute type, and allowed values as inline options.
 */
function searchProperties(attributes: ProfileAttributeJson[]): SearchPropertyJson[] {
  return attributes.flatMap((attr) => {
    const allowedValues = attr._embedded["blueprint:constraint"].find(
      (constraint) => constraint.type === "allowed-values",
    )?.values;
    return attr._embedded["blueprint:search-param"].map(({ name, title }) => ({
      name,
      prompt: title,
      type: WIRE_TYPES[attr.type]!,
      ...(allowedValues ? { options: { minItems: 0, maxItems: 1, inline: allowedValues } } : {}),
    }));
  });
}

function profileLinks(profileUrl: string, collectionUrl: string, title: string) {
  return {
    self: { href: profileUrl, title },
    describes: [
      { href: collectionUrl, title, profile: profileUrl, name: "collection" },
      { href: `${collectionUrl}/{id}`, title, name: "item", templated: true },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  };
}

function toOneRelation(name: string, title: string, targetProfileUrl: string, target: string) {
  return {
    name,
    title,
    description: null,
    many_source_per_target: true,
    many_target_per_source: false,
    required: false,
    _links: { "blueprint:target-entity": { href: targetProfileUrl, title: target } },
  };
}

export const SEARCH_BAR_STATUS_OPTIONS = ["draft", "approved", "rejected"] as const;

const searchBarAttributes = [
  attribute({ name: "id", title: "ID", type: "string", readOnly: true }),
  attribute({
    name: "title",
    title: "Title",
    type: "string",
    searchParams: [
      ["title", "Title", "exact-match"],
      ["title~prefix", "Title", "prefix-match"],
    ],
  }),
  attribute({
    name: "notes",
    title: "Notes",
    type: "string",
    searchParams: [["notes~fts", "Notes", "full-text"]],
  }),
  attribute({
    name: "reference",
    title: "Reference",
    type: "string",
    searchParams: [["reference", "Reference", "exact-match"]],
  }),
  attribute({
    name: "status",
    title: "Status",
    type: "string",
    constraints: [{ type: "allowed-values", values: [...SEARCH_BAR_STATUS_OPTIONS] }],
    searchParams: [["status", "Status", "exact-match"]],
  }),
  numberAttribute("quantity", "Quantity", "long"),
  numberAttribute("amount", "Amount", "double"),
  attribute({
    name: "due_date",
    title: "Due date",
    type: "date",
    searchParams: boundParams("due_date", "Due date", ["from", "until"]),
  }),
  datetimeAttribute("received_at", "Received at"),
  attribute({
    name: "urgent",
    title: "Urgent",
    type: "boolean",
    searchParams: [["urgent", "Urgent", "exact-match"]],
  }),
  datetimeAttribute("created_at", "Created at", "created-date"),
  datetimeAttribute("modified_at", "Modified at", "modified-date"),
];

const searchBarSearchProperties: SearchPropertyJson[] = [
  ...searchProperties(searchBarAttributes),
  { name: "customer.name~prefix", prompt: "Customer: Name", type: "text" },
  { name: "owner.email~prefix", prompt: "Owner: Email", type: "text" },
  {
    name: "_sort",
    type: "text",
    options: {
      minItems: 0,
      inline: [
        { property: "title", direction: "asc", value: "title,asc", prompt: "Title ↑" },
        { property: "title", direction: "desc", value: "title,desc", prompt: "Title ↓" },
      ],
    },
  },
];

export const searchBarProfileJson = {
  name: "search-bar",
  title: "Search bar",
  description: "Covers every search-parameter shape the single search bar handles.",
  _links: profileLinks(SEARCH_BAR_PROFILE_URL, SEARCH_BAR_COLLECTION_URL, "Search bar"),
  _embedded: {
    "blueprint:attribute": searchBarAttributes,
    "blueprint:relation": [
      toOneRelation("customer", "Customer", SEARCH_BAR_CUSTOMER_PROFILE_URL, "Customer"),
      toOneRelation("owner", "Owner", SEARCH_BAR_OWNER_PROFILE_URL, "Owner"),
    ],
  },
  _templates: {
    search: {
      method: "GET",
      target: SEARCH_BAR_COLLECTION_URL,
      properties: searchBarSearchProperties,
    },
  },
};

function simpleTargetProfileJson(opts: {
  name: string;
  title: string;
  profileUrl: string;
  collectionUrl: string;
  attributeName: string;
  attributeTitle: string;
}) {
  const attributes = [
    attribute({ name: "id", title: "ID", type: "string", readOnly: true }),
    attribute({
      name: opts.attributeName,
      title: opts.attributeTitle,
      type: "string",
      searchParams: [[`${opts.attributeName}~prefix`, opts.attributeTitle, "prefix-match"]],
    }),
  ];
  return {
    name: opts.name,
    title: opts.title,
    description: null,
    _links: profileLinks(opts.profileUrl, opts.collectionUrl, opts.title),
    _embedded: { "blueprint:attribute": attributes, "blueprint:relation": [] },
    _templates: {
      search: {
        method: "GET",
        target: opts.collectionUrl,
        properties: searchProperties(attributes),
      },
    },
  };
}

export const searchBarCustomerProfileJson = simpleTargetProfileJson({
  name: "customer",
  title: "Customer",
  profileUrl: SEARCH_BAR_CUSTOMER_PROFILE_URL,
  collectionUrl: SEARCH_BAR_CUSTOMER_COLLECTION_URL,
  attributeName: "name",
  attributeTitle: "Name",
});

export const searchBarOwnerProfileJson = simpleTargetProfileJson({
  name: "owner",
  title: "Owner",
  profileUrl: SEARCH_BAR_OWNER_PROFILE_URL,
  collectionUrl: SEARCH_BAR_OWNER_COLLECTION_URL,
  attributeName: "email",
  attributeTitle: "Email",
});

export const searchBarProfileRootJson = {
  _links: {
    self: { href: SEARCH_BAR_PROFILE_ROOT_URL },
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
    "cg:entity": [
      { href: SEARCH_BAR_PROFILE_URL, title: "Search bar", name: "search-bar" },
      { href: SEARCH_BAR_CUSTOMER_PROFILE_URL, title: "Customer", name: "customer" },
      { href: SEARCH_BAR_OWNER_PROFILE_URL, title: "Owner", name: "owner" },
    ],
  },
  _templates: {},
};

function item(
  collectionUrl: string,
  id: string,
  attributes: Record<string, unknown>,
): HalObjectShape<Record<string, unknown>> {
  return { id, ...attributes, _links: { self: { href: `${collectionUrl}/${id}` } } };
}

export const searchBarItems = [
  item(SEARCH_BAR_COLLECTION_URL, "1", {
    title: "Alpha invoice",
    notes: "Paid in advance",
    reference: "REF-1",
    status: "approved",
    quantity: 12,
    amount: 12.5,
    due_date: "2026-10-01",
    received_at: "2026-10-02T09:00:00Z",
    urgent: true,
  }),
  item(SEARCH_BAR_COLLECTION_URL, "2", {
    title: "Alpha order",
    notes: "Awaiting payment",
    reference: "REF-2",
    status: "draft",
    quantity: 3,
    amount: 99.95,
    due_date: "2026-11-15",
    received_at: "2026-09-20T15:30:00Z",
    urgent: false,
  }),
  item(SEARCH_BAR_COLLECTION_URL, "3", {
    title: "Beta contract",
    notes: "Advance notice required",
    reference: "REF-3",
    status: "rejected",
    quantity: 42,
    amount: 4.2,
    due_date: "2027-01-01",
    received_at: "2026-10-06T08:00:00Z",
    urgent: false,
  }),
];

export const searchBarCustomerItems = [
  item(SEARCH_BAR_CUSTOMER_COLLECTION_URL, "c1", { name: "Acme Corp" }),
  item(SEARCH_BAR_CUSTOMER_COLLECTION_URL, "c2", { name: "Acme Logistics" }),
];

export const searchBarOwnerItems = [
  item(SEARCH_BAR_OWNER_COLLECTION_URL, "o1", { email: "alice@example.com" }),
];

export interface SearchBarHandlersOptions {
  /** Items returned by `/search-bars`; defaults to `searchBarItems`. */
  items?: HalObjectShape<Record<string, unknown>>[];
  /** Forwarded to the `/search-bars` list handler. */
  totals?: ListHandlerConfig["totals"];
  /** Forwarded to the `/search-bars` list handler. */
  resolveTotal?: ListHandlerConfig["resolveTotal"];
}

/**
 * Profile root, the three entity profiles and the three collections. The collection handlers
 * do not filter — tests that care about filtering inspect the request URL or pass
 * `resolveTotal`.
 */
export function searchBarHandlers(options: SearchBarHandlersOptions = {}): HttpHandler[] {
  return [
    http.get(SEARCH_BAR_PROFILE_ROOT_URL, () => HttpResponse.json(searchBarProfileRootJson)),
    http.get(SEARCH_BAR_PROFILE_URL, () => HttpResponse.json(searchBarProfileJson)),
    http.get(SEARCH_BAR_CUSTOMER_PROFILE_URL, () =>
      HttpResponse.json(searchBarCustomerProfileJson),
    ),
    http.get(SEARCH_BAR_OWNER_PROFILE_URL, () => HttpResponse.json(searchBarOwnerProfileJson)),
    createListHandler({
      url: SEARCH_BAR_COLLECTION_URL,
      items: options.items ?? searchBarItems,
      totals: options.totals,
      resolveTotal: options.resolveTotal,
    }),
    createListHandler({ url: SEARCH_BAR_CUSTOMER_COLLECTION_URL, items: searchBarCustomerItems }),
    createListHandler({ url: SEARCH_BAR_OWNER_COLLECTION_URL, items: searchBarOwnerItems }),
  ];
}

/**
 * The three profiles as `ProfileEntity` accessors, for white-box tests that do not go through
 * the hooks. The link names/hrefs match the profile root's `cg:entity` links, so
 * `ProfileRelation.getTargetProfile(profiles)` resolves between them.
 */
export function makeSearchBarProfiles(): {
  searchBar: ProfileEntity;
  customer: ProfileEntity;
  owner: ProfileEntity;
  all: ProfileEntity[];
} {
  const searchBar = makeProfileEntity(searchBarProfileJson, SEARCH_BAR_PROFILE_URL, "search-bar");
  const customer = makeProfileEntity(
    searchBarCustomerProfileJson,
    SEARCH_BAR_CUSTOMER_PROFILE_URL,
    "customer",
  );
  const owner = makeProfileEntity(searchBarOwnerProfileJson, SEARCH_BAR_OWNER_PROFILE_URL, "owner");
  return { searchBar, customer, owner, all: [searchBar, customer, owner] };
}
