/* eslint-disable no-console -- dev/e2e-only fixtures: the warning on unknown writes is the point. */
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
 * Anything the dump records verbatim is replayed verbatim (status, `Content-Type`, `ETag`,
 * `Location`, JSON or base64 bytes): to-one relation redirects, to-many pages, content downloads,
 * and recorded denials (403/404 problem+json). Only when nothing is recorded do the generated pagination, clones and
 * placeholders below kick in. `{ user: "restricted" }` derives a second, permission-limited user
 * from the same recording via `RESTRICTED_POLICY`. Unknown non-GET requests answer 405 problem+json.
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

/** One recorded response. Keys are the bare GET path (+ query). */
export interface RecordedResponse {
  status?: number;
  contentType?: string | null;
  etag?: string | null;
  body?: unknown;
  bodyBase64?: string;
  location?: string | null;
}

export interface RecordedDump {
  capturedAt: string | null;
  responses: Record<string, RecordedResponse>;
}

export type DemoUser = "full" | "restricted";

export interface DemoHandlerOptions {
  /** `"restricted"` applies `RESTRICTED_POLICY` on top of the recording. Defaults to `"full"`. */
  user?: DemoUser;
  /** Test seam: replaces the committed recording. */
  dump?: RecordedDump;
}

/** Permission limits for one entity (keyed by the plural of the recording). */
export interface EntityPolicy {
  /** No create, update or delete: item write templates are stripped, writes answer 403. */
  readOnly?: boolean;
  /** `delete` template is stripped and DELETE on the item answers 403. */
  noDelete?: boolean;
  /** `create-form` is stripped from the profile and POST to the collection answers 403. */
  noCreate?: boolean;
  /** Collection pages are empty, items answer 404. The entity and its profile stay visible. */
  unreadable?: boolean;
  /** Row-level: items whose id matches are invisible (not listed, not counted, 404). */
  hideRow?: (id: string) => boolean;
}

function stableHash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** What the restricted second user may do, derived from the full-access recording. */
export const RESTRICTED_POLICY: Record<string, EntityPolicy> = {
  // Read-only: strips `default`, `delete` and every `set-*`/`add-*`/`clear-*` item template (and
  // `create-form` from the profile); PATCH/PUT/DELETE/POST on the item or its sub-resources and
  // POST to the collection answer 403.
  products: { readOnly: true },
  // No delete: strips the `delete` template; DELETE on the item answers 403.
  orderses: { noDelete: true },
  // No create: strips `create-form` from the profile; POST to the collection answers 403.
  categories: { noCreate: true },
  // Not readable: collection pages are empty with total 0, item GET answers 404 not-found/entity-item.
  // ASSUMPTION: the entity and its profile stay visible; unverified whether the backend hides them.
  articles: { unreadable: true },
  // Row-level: about every 3rd customer (by a stable hash of its id) is invisible: left out of
  // collection pages, totals and relation pages, and item GET answers 404 not-found/entity-item.
  customers: { hideRow: (id) => stableHash(id) % 3 === 0 },
};

const fullDump = recordedDump as unknown as RecordedDump;

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

/** A dump plus everything derived from it once. */
interface Dataset {
  responses: Record<string, RecordedResponse>;
  entities: RecordedEntity[];
  /** First non-2xx recorded GET per pathname, so denied reads win whatever query the app sends. */
  deniedByPath: Map<string, RecordedResponse>;
}

function lastSegment(href: string): string {
  return href.split("?")[0].split("/").filter(Boolean).at(-1) ?? "";
}

function isOk(res: RecordedResponse | undefined): res is RecordedResponse {
  return !!res && (res.status ?? 200) >= 200 && (res.status ?? 200) < 300;
}

function loadEntities(responses: Record<string, RecordedResponse>): RecordedEntity[] {
  const rootRes = responses["/profile"];
  if (!isOk(rootRes)) return [];
  const root = rootRes.body as { _links?: { "cg:entity"?: { href: string }[] } };
  const entities: RecordedEntity[] = [];
  for (const link of root._links?.["cg:entity"] ?? []) {
    const plural = lastSegment(link.href);
    const profileRes = responses[`/profile/${plural}`];
    const collectionRes = responses[`/${plural}?size=5`];
    // Unreadable entities (recorded 403/404) are not generated; the recorded response is replayed.
    if (!isOk(profileRes) || !isOk(collectionRes)) continue;
    const profileBody = profileRes.body as Json;
    const collection = collectionRes.body as {
      _embedded?: { item?: HalItem[] };
      page?: { total_items_exact?: number };
    };
    const pageItems = collection._embedded?.item ?? [];
    const fullItems = new Map<string, HalItem>();
    for (const [key, res] of Object.entries(responses)) {
      // Only `/<plural>/<id>` GET entries; sub-resources and "METHOD /path" keys are excluded.
      if (!key.startsWith(`/${plural}/`) || key.includes("?") || key.split("/").length !== 3) {
        continue;
      }
      const body = res.body as HalItem | undefined;
      if (isOk(res) && body?.id) fullItems.set(body.id, body);
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
    for (const item of [...pageItems, ...fullItems.values()]) {
      const links = (item._links ?? {}) as Record<string, { href: string; name: string }[]>;
      for (const l of links["cg:content"] ?? []) contentSegments.add(lastSegment(l.href));
      for (const l of links["cg:relation"] ?? []) {
        if (toManyNames.has(l.name)) toManySegments.add(lastSegment(l.href));
      }
    }

    entities.push({
      plural,
      name: (profileBody.name as string | undefined) ?? plural,
      title: (profileBody.title as string | undefined) ?? plural,
      profileBody,
      totalItems: pageItems.length ? (collection.page?.total_items_exact ?? pageItems.length) : 0,
      pageItems,
      fullItems,
      contentSegments,
      toManySegments,
    });
  }
  return entities;
}

function buildDataset(dump: RecordedDump): Dataset {
  const responses = dump.responses;
  const deniedByPath = new Map<string, RecordedResponse>();
  for (const [key, res] of Object.entries(responses)) {
    if (!key.startsWith("/") || isOk(res)) continue;
    const pathname = key.split("?")[0];
    if (!deniedByPath.has(pathname)) deniedByPath.set(pathname, res);
  }
  return { responses, entities: loadEntities(responses), deniedByPath };
}

const datasetCache = new WeakMap<RecordedDump, Dataset>();
function datasetFor(dump: RecordedDump): Dataset {
  let dataset = datasetCache.get(dump);
  if (!dataset) {
    dataset = buildDataset(dump);
    datasetCache.set(dump, dataset);
  }
  return dataset;
}

/** The recorded profile root's `cg:entity` links (rewritten to `baseUrl`), for apps that extend the root. */
export function recordedEntityLinks(
  baseUrl: string,
): { href: string; name: string; title: string }[] {
  const root = fullDump.responses["/profile"].body as {
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

function problem(status: number, type: string, title: string, detail?: string) {
  return HttpResponse.json(
    {
      type: `https://contentgrid.cloud/problems/${type}`,
      title,
      status,
      ...(detail && { detail }),
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

function unauthorized() {
  return problem(401, "unauthorized", "Unauthorized");
}

/** Shapes captured from a real dev application. */
function endpointNotFound() {
  return problem(
    404,
    "not-found/endpoint",
    "Endpoint not found",
    "There is no API endpoint on this URL",
  );
}

function entityItemNotFound(entityName: string, id: string) {
  return problem(
    404,
    "not-found/entity-item",
    "Entity item not found",
    `Entity '${entityName}' item '${id}' not found`,
  );
}

/** Unset to-one relation: no detail, as recorded. */
function relationItemNotFound() {
  return problem(404, "not-found/relation-item", "Relation item not found");
}

// SYNTHETIC: replace with a recorded 403 when available (no real sample was captured).
function forbidden() {
  return problem(403, "forbidden", "Forbidden");
}

function hasBearer(request: Request): boolean {
  return request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // ArrayBuffer (not Blob): `new Response(blob)` throws while MSW is listening.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Replays a recorded response verbatim, with the placeholder origin rewritten to `baseUrl`. */
function replay(
  entry: RecordedResponse,
  baseUrl: string,
  extraHeaders: Record<string, string> = {},
  transform?: (body: unknown) => unknown,
): Response {
  const status = entry.status ?? 200;
  const headers = new Headers(extraHeaders);
  if (entry.contentType) headers.set("Content-Type", entry.contentType);
  if (entry.etag) headers.set("ETag", entry.etag);
  if (entry.location) {
    headers.set("Location", entry.location.split(PLACEHOLDER_ORIGIN).join(baseUrl));
  }

  let body: BodyInit | null = null;
  if (entry.bodyBase64 !== undefined) {
    const bytes = decodeBase64(entry.bodyBase64);
    body = toArrayBuffer(bytes);
    headers.set("Content-Length", String(bytes.byteLength));
  } else if (entry.body !== undefined && entry.body !== null) {
    const payload =
      transform && typeof entry.body === "object" ? transform(entry.body) : entry.body;
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    body = text.split(PLACEHOLDER_ORIGIN).join(baseUrl);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (NULL_BODY_STATUSES.has(status)) body = null;
  return new HttpResponse(body, { status, headers });
}

/** Recorded response for `GET path+query`, or any recorded denial (non-2xx) for that path. */
function recordedGet(dataset: Dataset, url: URL): RecordedResponse | undefined {
  return (
    dataset.responses[`${url.pathname}${url.search}`] ?? dataset.deniedByPath.get(url.pathname)
  );
}

function buildCollectionBody(
  entity: RecordedEntity,
  baseUrl: string,
  pageIndex: number,
  visible?: number[],
) {
  const total = visible ? visible.length : entity.totalItems;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const page = Math.min(pageIndex, lastPage);
  const start = page * PAGE_SIZE;
  const items = Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - start)) }, (_, i) =>
    itemAt(entity, visible ? visible[start + i] : start + i),
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

/** Tiny valid placeholders so content previews render for any mimetype we know how to fake. */
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4ceIEAAS0AlkWLoFAAAAAAElFTkSuQmCC";
const PLACEHOLDER_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0iiiigD//2Q==";
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#cbd5e1"/><circle cx="32" cy="32" r="16" fill="#64748b"/></svg>';

/** Exported for tests. */
export function placeholderForMimetype(mimetype: string | undefined): {
  contentType: string;
  bytes: Uint8Array;
} {
  const type = (mimetype ?? "").toLowerCase();
  if (!type || type === "application/pdf") {
    return { contentType: "application/pdf", bytes: decodeBase64(MINIMAL_PDF_BASE64) };
  }
  if (type === "image/png") {
    return { contentType: type, bytes: decodeBase64(PLACEHOLDER_PNG_BASE64) };
  }
  if (type === "image/jpeg" || type === "image/jpg") {
    return { contentType: "image/jpeg", bytes: decodeBase64(PLACEHOLDER_JPEG_BASE64) };
  }
  if (type === "image/svg+xml") {
    return { contentType: type, bytes: new TextEncoder().encode(PLACEHOLDER_SVG) };
  }
  return { contentType: "text/plain", bytes: new TextEncoder().encode("Placeholder content") };
}

function contentResponse(item: HalItem, segment: string) {
  const attribute = Object.entries(item).find(
    ([key, value]) => key.replaceAll("_", "-") === segment && typeof value === "object" && value,
  );
  const meta = attribute?.[1] as { filename?: string; mimetype?: string } | undefined;
  const { contentType, bytes } = placeholderForMimetype(meta?.mimetype);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
  };
  if (meta?.filename) headers["Content-Disposition"] = `attachment; filename="${meta.filename}"`;
  return new HttpResponse(toArrayBuffer(bytes), { status: 200, headers });
}

/** Attaches the filename of a recorded content attribute as `Content-Disposition`, when known. */
function recordedContentHeaders(
  item: HalItem | undefined,
  segment: string,
): Record<string, string> {
  if (!item) return {};
  const attribute = Object.entries(item).find(
    ([key, value]) => key.replaceAll("_", "-") === segment && typeof value === "object" && value,
  );
  const filename = (attribute?.[1] as { filename?: string } | undefined)?.filename;
  return filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {};
}

const ITEM_PATH = /^\/([^/]+)\/([^/]+)$/;
const WRITE_TEMPLATE = /^(set|add|clear)-/;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function idAt(entity: RecordedEntity, index: number): string {
  return index < entity.pageItems.length
    ? entity.pageItems[index].id
    : derivedId(`${entity.plural}:${index}`);
}

/** Applies a policy to recorded/generated data and to incoming writes. Inert for an empty policy. */
function createRestrictions(policy: Record<string, EntityPolicy>, entities: RecordedEntity[]) {
  const entityNames = new Map(entities.map((e) => [e.plural, e.name]));
  const visibleCache = new Map<string, number[] | undefined>();

  const isItemVisible = (plural: string, id: string): boolean => {
    const p = Object.hasOwn(policy, plural) ? policy[plural] : undefined;
    return !p || (!p.unreadable && !p.hideRow?.(id));
  };

  /** Virtual indices of an entity's visible items; undefined when nothing is hidden. */
  const visibleIndices = (entity: RecordedEntity): number[] | undefined => {
    if (!Object.hasOwn(policy, entity.plural)) return undefined;
    if (!visibleCache.has(entity.plural)) {
      const indices: number[] = [];
      for (let i = 0; i < entity.totalItems; i++) {
        if (isItemVisible(entity.plural, idAt(entity, i))) indices.push(i);
      }
      visibleCache.set(entity.plural, indices);
    }
    return visibleCache.get(entity.plural);
  };

  /** `{plural, id}` for an object that is an item of a policy entity (by its self link). */
  const itemRef = (node: Record<string, unknown>) => {
    const href = (node._links as { self?: { href?: string } } | undefined)?.self?.href;
    if (typeof href !== "string") return undefined;
    const match = ITEM_PATH.exec(new URL(href, "http://x").pathname);
    if (!match || !Object.hasOwn(policy, match[1])) return undefined;
    return { plural: match[1], id: typeof node.id === "string" ? node.id : match[2] };
  };

  const stripTemplates = (plural: string, templates: Record<string, unknown>) => {
    const p = policy[plural];
    const out = { ...templates };
    for (const name of Object.keys(out)) {
      if (p.readOnly && (name === "default" || name === "delete" || WRITE_TEMPLATE.test(name))) {
        delete out[name];
      }
      if (p.noDelete && name === "delete") delete out[name];
    }
    return out;
  };

  /** Deep-copies a body, hiding invisible embedded items and stripping item write templates. */
  const restrictBody = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(restrictBody);
    if (!isObject(node)) return node;
    const out: Record<string, unknown> = {};
    let dropped = 0;
    for (const [key, value] of Object.entries(node)) {
      if (key === "_embedded" && isObject(value)) {
        out[key] = Object.fromEntries(
          Object.entries(value).map(([rel, list]) => {
            if (!Array.isArray(list)) return [rel, restrictBody(list)];
            const kept = list.filter((entry) => {
              const ref = isObject(entry) ? itemRef(entry) : undefined;
              const keep = !ref || isItemVisible(ref.plural, ref.id);
              if (!keep) dropped++;
              return keep;
            });
            return [rel, kept.map(restrictBody)];
          }),
        );
      } else {
        out[key] = restrictBody(value);
      }
    }
    if (dropped > 0 && isObject(out.page)) {
      const page = { ...out.page };
      for (const key of ["total_items_exact", "total_items_estimate"]) {
        if (typeof page[key] === "number") page[key] = Math.max(0, page[key] - dropped);
      }
      out.page = page;
    }
    const ref = itemRef(node);
    if (ref && isObject(out._templates))
      out._templates = stripTemplates(ref.plural, out._templates);
    return out;
  };

  /** Entity profile: read-only and no-create entities do not offer `create-form`. */
  const restrictProfile = (plural: string) => (body: unknown) => {
    const p = Object.hasOwn(policy, plural) ? policy[plural] : undefined;
    if (!p || !(p.readOnly || p.noCreate) || !isObject(body) || !isObject(body._templates)) {
      return body;
    }
    const templates = { ...body._templates };
    delete templates["create-form"];
    return { ...body, _templates: templates };
  };

  /** Response for a write the policy forbids (or whose target is invisible); undefined if allowed. */
  const denyWrite = (method: string, pathname: string): Response | undefined => {
    if (!WRITE_METHODS.has(method)) return undefined;
    const [plural, id, ...rest] = pathname.split("/").filter(Boolean);
    if (!plural || !Object.hasOwn(policy, plural)) return undefined;
    const p = policy[plural];
    if (id === undefined) {
      return method === "POST" && (p.noCreate || p.readOnly) ? forbidden() : undefined;
    }
    if (!isItemVisible(plural, id))
      return entityItemNotFound(entityNames.get(plural) ?? plural, id);
    if (p.readOnly) return forbidden();
    if (p.noDelete && method === "DELETE" && rest.length === 0) return forbidden();
    return undefined;
  };

  return { isItemVisible, visibleIndices, restrictBody, restrictProfile, denyWrite };
}

export function createDemoHandlers(baseUrl = "", options: DemoHandlerOptions = {}) {
  const dataset = datasetFor(options.dump ?? fullDump);
  const { entities } = dataset;
  const policy = (options.user ?? "full") === "restricted" ? RESTRICTED_POLICY : {};
  const { isItemVisible, visibleIndices, restrictBody, restrictProfile, denyWrite } =
    createRestrictions(policy, entities);

  /** Recorded GET replay (profile root, profiles, ...); undefined when nothing is recorded. */
  const recordedHandler = (request: Request, transform?: (body: unknown) => unknown) => {
    const entry = recordedGet(dataset, new URL(request.url));
    return entry ? replay(entry, baseUrl, {}, transform) : undefined;
  };

  const rootHandler = http.get(`${baseUrl}/profile`, ({ request }) => {
    if (!hasBearer(request)) return unauthorized();
    return recordedHandler(request) ?? endpointNotFound();
  });

  return [
    rootHandler,
    ...entities.flatMap((entity) => [
      http.get(`${baseUrl}/profile/${entity.plural}`, ({ request }) => {
        if (!hasBearer(request)) return unauthorized();
        return recordedHandler(request, restrictProfile(entity.plural)) ?? endpointNotFound();
      }),
      http.get(`${baseUrl}/${entity.plural}`, ({ request }) => {
        if (!hasBearer(request)) return unauthorized();
        const url = new URL(request.url);
        // Recorded denials win; recorded OK pages are not replayed so pagination keeps working.
        const denied = dataset.deniedByPath.get(url.pathname);
        if (denied) return replay(denied, baseUrl);
        // A recorded filtered collection (e.g. a to-many relation's redirect target) is replayed as is.
        const filtered = [...url.searchParams.keys()].some((k) => k !== "size" && k !== "_cursor");
        const recordedFiltered = filtered
          ? dataset.responses[`${url.pathname}${url.search}`]
          : undefined;
        if (recordedFiltered) return replay(recordedFiltered, baseUrl, {}, restrictBody);
        const cursor = url.searchParams.get("_cursor");
        const body = buildCollectionBody(
          entity,
          baseUrl,
          pageIndexFromCursor(cursor),
          visibleIndices(entity),
        );
        return HttpResponse.json(restrictBody(body) as Json);
      }),
      http.get(`${baseUrl}/${entity.plural}/:id`, ({ request, params }) => {
        if (!hasBearer(request)) return unauthorized();
        const id = String(params.id);
        if (!isItemVisible(entity.plural, id)) return entityItemNotFound(entity.name, id);
        const recorded = recordedGet(dataset, new URL(request.url));
        if (recorded) return replay(recorded, baseUrl, {}, restrictBody);
        const item = findItem(entity, id);
        if (!item) return entityItemNotFound(entity.name, id);
        return HttpResponse.json(restrictBody(rewriteOrigin(item, baseUrl)) as Json);
      }),
      http.get(`${baseUrl}/${entity.plural}/:id/:segment`, ({ request, params }) => {
        if (!hasBearer(request)) return unauthorized();
        const id = String(params.id);
        if (!isItemVisible(entity.plural, id)) return entityItemNotFound(entity.name, id);
        const item = findItem(entity, id);
        const segment = String(params.segment);
        const recorded = recordedGet(dataset, new URL(request.url));
        if (recorded) {
          return replay(
            recorded,
            baseUrl,
            recorded.bodyBase64 !== undefined ? recordedContentHeaders(item, segment) : {},
            restrictBody,
          );
        }
        if (!item) return entityItemNotFound(entity.name, id);
        if (entity.contentSegments.has(segment)) return contentResponse(item, segment);
        if (entity.toManySegments.has(segment)) {
          return HttpResponse.json({
            _embedded: { item: [] },
            _links: { self: { href: request.url }, curies: CURIES },
            page: { size: PAGE_SIZE, total_items_estimate: 0, total_items_exact: 0 },
          });
        }
        return relationItemNotFound();
      }),
    ]),
    // Catch-all, registered last. GET: replay anything recorded that no route above handled, else
    // pass through (the dev server's own assets share this origin). Writes: the restricted
    // policy's 403/404, otherwise a 405 instead of letting the request hit the network.
    http.all(`${baseUrl}/*`, ({ request }) => {
      const url = new URL(request.url);
      if (request.method === "GET") {
        const entry = recordedGet(dataset, url);
        if (!entry) return undefined;
        return hasBearer(request) ? replay(entry, baseUrl, {}, restrictBody) : unauthorized();
      }
      if (request.method === "HEAD" || request.method === "OPTIONS") return undefined;
      if (!hasBearer(request)) return unauthorized();
      const denied = denyWrite(request.method, url.pathname);
      if (denied) return denied;
      console.warn(
        `[demo-handlers] No handler for ${request.method} ${url.pathname}; answering 405.`,
      );
      return problem(
        405,
        "method-not-allowed",
        "Method not allowed (demo data)",
        `The demo data does not support ${request.method} ${url.pathname}.`,
      );
    }),
  ];
}
