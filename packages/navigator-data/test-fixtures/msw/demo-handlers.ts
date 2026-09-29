import { HttpResponse, http } from "msw";
import recordedDump from "../recorded/recorded-dump.json";

/**
 * Dev/e2e-only MSW handlers serving the sanitised recorded ContentGrid model in
 * `../recorded/recorded-dump.json` (see `../recorded/README.md`). Both dev apps boot on it: the
 * profile root (`/profile`), every entity profile, paginated collections, items, and placeholder
 * content downloads. Never import this from production code.
 *
 * The dump only holds the first page of each collection, so further pages are generated
 * deterministically by cloning the recorded items with derived ids, up to the recorded
 * `total_items_exact`. Cursors are opaque tokens minted here and only ever followed via the
 * `next`/`prev`/`first` links.
 *
 * Resources require a Bearer token (any value), mirroring the platform's 401-on-missing-token
 * behaviour — so the boot smoke test only passes when the auth layer actually attaches the dev
 * token to API requests.
 */

/** Fake origin used inside the recorded dump; rewritten to the handler's `baseUrl` at serve time. */
const PLACEHOLDER_ORIGIN = "https://recorded.navigator.test";
const PAGE_SIZE = 20;

/** A minimal one-page PDF ("Hello"), same bytes as `../pdf/minimal.pdf`, base64-encoded. */
const MINIMAL_PDF_BASE64 =
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFs0IDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago0IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDUgMCBSID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMzcgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKEhlbGxvKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDE5MSAwMDAwMCBuIAowMDAwMDAwMzE3IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDAzCiUlRU9GCg==";

type Json = Record<string, unknown>;
type HalItem = Json & { id: string };

interface RecordedResponse {
  body: Json;
}

const responses = recordedDump.responses as unknown as Record<string, RecordedResponse>;

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function rewriteOrigin<T>(value: T, baseUrl: string): T {
  return JSON.parse(JSON.stringify(value).split(PLACEHOLDER_ORIGIN).join(baseUrl)) as T;
}

/** Deterministic uuid-shaped id derived from a seed (FNV-1a based; not cryptographic). */
function derivedId(seed: string): string {
  let hex = "";
  for (let block = 0; hex.length < 32; block++) {
    let h = 0x811c9dc5 ^ block;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const ISO_DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;
const NON_SUFFIXED_KEYS = new Set(["id", "created_by", "last_modified_by"]);

/** Makes a clone visibly distinct: unique email and a `#n` suffix on the first plain string value. */
function tagClone(item: Json, ordinal: number): void {
  let suffixed = false;
  for (const [key, value] of Object.entries(item)) {
    if (typeof value !== "string" || NON_SUFFIXED_KEYS.has(key)) continue;
    if (key === "email" || value.includes("@")) {
      item[key] = `user-c${ordinal}@example.test`;
    } else if (!suffixed && !ISO_DATE_LIKE.test(value)) {
      item[key] = `${value} #${ordinal}`;
      suffixed = true;
    }
  }
}

interface RecordedEntity {
  plural: string;
  name: string;
  title: string;
  profileBody: Json;
  totalItems: number;
  /** Recorded first page. */
  pageItems: HalItem[];
  /** Full recorded single-item responses, by id. */
  fullItems: Map<string, HalItem>;
  /** Names (last href segment) of content sub-resources. */
  contentSegments: Set<string>;
  /** Last href segment of to-many relation sub-resources. */
  toManySegments: Set<string>;
}

function lastSegment(href: string): string {
  return href.split("?")[0].split("/").filter(Boolean).at(-1) ?? "";
}

function loadEntities(): RecordedEntity[] {
  const root = responses["/profile"].body as { _links: { "cg:entity": { href: string }[] } };
  return root._links["cg:entity"].map((link) => {
    const plural = lastSegment(link.href);
    const profileBody = responses[`/profile/${plural}`].body;
    const collection = responses[`/${plural}?size=5`].body as {
      _embedded: { item: HalItem[] };
      page: { total_items_exact: number };
    };
    const pageItems = collection._embedded.item;
    const fullItems = new Map<string, HalItem>();
    for (const [key, res] of Object.entries(responses)) {
      if (key.startsWith(`/${plural}/`) && !key.includes("?")) {
        fullItems.set((res.body as HalItem).id, res.body as HalItem);
      }
    }

    const relations =
      ((profileBody._embedded as Record<string, Json[]> | undefined)?.["blueprint:relation"] as
        | { name: string; many_target_per_source: boolean }[]
        | undefined) ?? [];
    const toManyNames = new Set(
      relations.filter((r) => r.many_target_per_source).map((r) => r.name),
    );

    const contentSegments = new Set<string>();
    const toManySegments = new Set<string>();
    for (const item of pageItems) {
      const links = item._links as Record<string, { href: string; name: string }[]>;
      for (const l of links["cg:content"] ?? []) contentSegments.add(lastSegment(l.href));
      for (const l of links["cg:relation"] ?? []) {
        if (toManyNames.has(l.name)) toManySegments.add(lastSegment(l.href));
      }
    }

    return {
      plural,
      name: (profileBody.name as string | undefined) ?? plural,
      title: (profileBody.title as string | undefined) ?? plural,
      profileBody,
      totalItems: collection.page.total_items_exact,
      pageItems,
      fullItems,
      contentSegments,
      toManySegments,
    };
  });
}

const entities = loadEntities();

/** The recorded profile root's `cg:entity` links (rewritten to `baseUrl`), for apps that extend the root. */
export function recordedEntityLinks(
  baseUrl: string,
): { href: string; name: string; title: string }[] {
  const root = responses["/profile"].body as {
    _links: { "cg:entity": { href: string; name: string; title: string }[] };
  };
  return rewriteOrigin(root._links["cg:entity"], baseUrl);
}

/** Item at `index` of an entity's virtual collection: recorded for the first page, cloned beyond. */
function itemAt(entity: RecordedEntity, index: number): HalItem {
  const { pageItems } = entity;
  if (index < pageItems.length) return pageItems[index];
  const source = pageItems[index % pageItems.length];
  const sourceFull = entity.fullItems.get(source.id) ?? source;
  const newId = derivedId(`${entity.plural}:${index}`);
  const clone = JSON.parse(JSON.stringify(sourceFull).split(source.id).join(newId)) as HalItem;
  tagClone(clone, index + 1);
  return clone;
}

function cursorFor(pageIndex: number): string {
  return btoa(`page:${pageIndex}`).replace(/=+$/, "");
}

function pageIndexFromCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const match = /^page:(\d+)$/.exec(atob(cursor));
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

const CURIES = [
  { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
  { href: "https://contentgrid.cloud/rels/blueprint/{rel}", name: "blueprint", templated: true },
  { href: "https://contentgrid.cloud/rels/automation/{rel}", name: "automation", templated: true },
];

function unauthorized() {
  return HttpResponse.json(
    { type: "https://contentgrid.cloud/problems/unauthorized", status: 401 },
    { status: 401, headers: { "Content-Type": "application/problem+json" } },
  );
}

function notFound(type: string) {
  return HttpResponse.json(
    { type: `https://contentgrid.cloud/problems/${type}`, status: 404 },
    { status: 404, headers: { "Content-Type": "application/problem+json" } },
  );
}

function hasBearer(request: Request): boolean {
  return request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

function buildCollectionBody(entity: RecordedEntity, baseUrl: string, pageIndex: number) {
  const total = entity.totalItems;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const page = Math.min(pageIndex, lastPage);
  const start = page * PAGE_SIZE;
  const items = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - start)) }, (_, i) =>
    itemAt(entity, start + i),
  );

  const collectionUrl = `${baseUrl}/${entity.plural}`;
  const pageHref = (p: number) =>
    p === 0 ? collectionUrl : `${collectionUrl}?_cursor=${cursorFor(p)}`;
  const links: Record<string, unknown> = {
    self: { href: pageHref(page), title: entity.title },
    profile: {
      href: `${baseUrl}/profile/${entity.plural}`,
      name: entity.name,
      title: entity.title,
    },
    curies: CURIES,
  };
  if (page > 0) {
    links.first = { href: pageHref(0) };
    links.prev = { href: pageHref(page - 1) };
  }
  if (page < lastPage) links.next = { href: pageHref(page + 1) };

  return rewriteOrigin(
    {
      _embedded: { item: items },
      _links: links,
      page: { size: PAGE_SIZE, total_items_estimate: total, total_items_exact: total },
    },
    baseUrl,
  );
}

function findItem(entity: RecordedEntity, id: string): HalItem | undefined {
  const recorded = entity.fullItems.get(id);
  if (recorded) return recorded;
  for (let i = 0; i < entity.totalItems; i++) {
    if (
      i < entity.pageItems.length
        ? entity.pageItems[i].id === id
        : derivedId(`${entity.plural}:${i}`) === id
    ) {
      return itemAt(entity, i);
    }
  }
  return undefined;
}

function contentResponse(item: HalItem, segment: string) {
  const attribute = Object.entries(item).find(
    ([key, value]) => key.replaceAll("_", "-") === segment && typeof value === "object" && value,
  );
  const meta = attribute?.[1] as { filename?: string; mimetype?: string } | undefined;
  const isPdf = !meta?.mimetype || meta.mimetype === "application/pdf";
  const body = isPdf
    ? decodeBase64(MINIMAL_PDF_BASE64)
    : new TextEncoder().encode("Placeholder content");
  // ArrayBuffer (not Blob): `new Response(blob)` throws while MSW is listening.
  const buffer = body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;
  const headers: Record<string, string> = {
    "Content-Type": isPdf ? "application/pdf" : "text/plain",
    "Content-Length": String(body.byteLength),
  };
  if (meta?.filename) headers["Content-Disposition"] = `attachment; filename="${meta.filename}"`;
  return new HttpResponse(buffer, { status: 200, headers });
}

export function createDemoHandlers(baseUrl = "") {
  const rootHandler = http.get(`${baseUrl}/profile`, ({ request }) => {
    if (!hasBearer(request)) return unauthorized();
    return HttpResponse.json(rewriteOrigin(responses["/profile"].body, baseUrl));
  });

  return [
    rootHandler,
    ...entities.flatMap((entity) => [
      http.get(`${baseUrl}/profile/${entity.plural}`, ({ request }) => {
        if (!hasBearer(request)) return unauthorized();
        return HttpResponse.json(rewriteOrigin(entity.profileBody, baseUrl));
      }),
      http.get(`${baseUrl}/${entity.plural}`, ({ request }) => {
        if (!hasBearer(request)) return unauthorized();
        const cursor = new URL(request.url).searchParams.get("_cursor");
        return HttpResponse.json(buildCollectionBody(entity, baseUrl, pageIndexFromCursor(cursor)));
      }),
      http.get(`${baseUrl}/${entity.plural}/:id`, ({ request, params }) => {
        if (!hasBearer(request)) return unauthorized();
        const item = findItem(entity, String(params.id));
        if (!item) return notFound("not-found/entity-item");
        return HttpResponse.json(rewriteOrigin(item, baseUrl));
      }),
      http.get(`${baseUrl}/${entity.plural}/:id/:segment`, ({ request, params }) => {
        if (!hasBearer(request)) return unauthorized();
        const item = findItem(entity, String(params.id));
        if (!item) return notFound("not-found/entity-item");
        const segment = String(params.segment);
        if (entity.contentSegments.has(segment)) return contentResponse(item, segment);
        if (entity.toManySegments.has(segment)) {
          return HttpResponse.json({
            _embedded: { item: [] },
            _links: { self: { href: request.url }, curies: CURIES },
            page: { size: PAGE_SIZE, total_items_estimate: 0, total_items_exact: 0 },
          });
        }
        return notFound("not-found/relation-item");
      }),
    ]),
  ];
}
