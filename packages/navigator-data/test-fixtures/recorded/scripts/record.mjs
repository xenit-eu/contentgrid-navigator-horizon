#!/usr/bin/env node
/**
 * Recorder for the MSW demo fixtures (see ../README.md). Plain Node 20, no dependencies.
 *
 *   node record.mjs --base <app origin> --token <file with a bearer access token> --out <raw.json>
 *                   [--with-bytes]
 *
 * Crawls a ContentGrid application's HAL API starting at `/profile` and follows links only (never
 * builds URLs from entity names):
 *
 *   /profile                      -> cg:entity links (to entity profiles)
 *   cg:entity link                -> the entity profile (no query); its describes[name=collection]
 *                                    link + ?size=5 -> the first page
 *   up to 3 items per entity      -> the item's own `self` link (Accept: application/prs.hal-forms+json)
 *   per recorded item:
 *     cg:relation links           -> followed with redirect "manual". To-one relations answer with a
 *                                    redirect: status and Location are recorded, and the redirect
 *                                    target item is recorded too. To-many relations: the page body
 *                                    plus (up to 5 of) the target items it lists.
 *     cg:content links            -> NOT downloaded by default: the item body already carries the
 *                                    file metadata (filename, mimetype, size) and the demo handlers
 *                                    serve mimetype-matching placeholders. With --with-bytes the bytes
 *                                    are stored base64-encoded with their Content-Type (over 512 KB is
 *                                    skipped and logged). File contents cannot be sanitised, so only
 *                                    use --with-bytes on an app that holds neutral files.
 *
 * GET ONLY. The recorder sends no PATCH, POST, PUT or DELETE, ever. The permission-limited user is
 * derived in the demo handlers (RESTRICTED_POLICY), not recorded.
 *
 * Every response is recorded, including 403/404 problem+json bodies. Requests only go to the
 * `--base` origin (links pointing elsewhere are skipped), so the token never leaves it.
 *
 * Output: { capturedAt, responses }, keyed by the bare path (+ query). Entries:
 * { status, contentType, etag, body? | bodyBase64?, location? }.
 * The raw file contains real tenant data. Run sanitise.mjs on it before it goes anywhere near git.
 * The token is read from the file, used in the Authorization header and never written or printed.
 *
 * Tokens live ~5 minutes, so requests run concurrently (CONCURRENCY at a time) and progress is
 * printed to stderr. Exits 2 when some requests were answered 401 (token expired mid-run).
 */
import { readFileSync, writeFileSync } from "node:fs";

const CONCURRENCY = 6;
const ITEMS_PER_ENTITY = 3;
const TARGET_ITEMS_PER_RELATION = 5;
const MAX_CONTENT_BYTES = 512 * 1024;
const HAL_FORMS = "application/prs.hal-forms+json";

const USAGE = `Usage: node record.mjs --base <app origin> --token <token file> --out <raw output file> [--with-bytes]

  --base   Origin of the ContentGrid application, e.g. https://my-app.example.org
  --token  File containing a bearer access token (never committed, never written to the output)
  --out    Raw output file ({ capturedAt, responses }); run sanitise.mjs on it afterwards
  --with-bytes  Also download content files (off by default; contents cannot be sanitised)
  --help   Show this help`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--with-bytes") args.withBytes = true;
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i];
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\n\n${USAGE}`);
  process.exit(1);
}
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!args.base || !args.token || !args.out) {
  console.error(USAGE);
  process.exit(1);
}

const base = new URL(args.base).origin;
const token = readFileSync(args.token, "utf8").trim();
if (!token) {
  console.error("Token file is empty.");
  process.exit(1);
}

/** @type {Record<string, object>} */
const responses = {};
const inflight = new Map();
let requestCount = 0;
let unauthorized = 0;
let active = 0;
const waiting = [];

async function slot(fn) {
  if (active >= CONCURRENCY) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** Resolves a link against the base; returns "/path?query" or null when it leaves the base origin. */
function localPath(href) {
  if (!href) return null;
  const url = new URL(href, base);
  if (url.origin !== base) {
    console.error(`  skipping link outside base origin: ${url.origin}`);
    return null;
  }
  return `${url.pathname}${url.search}`;
}

function linksOf(body, rel) {
  const value = body?._links?.[rel];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

async function toEntry(res, { binary = false } = {}) {
  const contentType = res.headers.get("content-type");
  const entry = {
    status: res.status,
    contentType,
    etag: res.headers.get("etag"),
  };
  const location = res.headers.get("location");
  if (location) entry.location = location;
  if (binary) {
    entry.bodyBase64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  } else {
    const text = await res.text();
    if (text) {
      try {
        entry.body = JSON.parse(text);
      } catch {
        entry.body = text;
      }
    }
  }
  return entry;
}

/** GET once per path. Returns the recorded entry (or undefined when skipped or failed). */
function request(
  path,
  { accept = "application/hal+json", redirect = "follow", binary = false } = {},
) {
  if (inflight.has(path)) return inflight.get(path);
  const promise = slot(async () => {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: accept },
        redirect,
      });
    } catch (error) {
      console.error(`  ! GET ${path}: ${error.message}`);
      return undefined;
    }
    if (binary && res.status === 200) {
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > MAX_CONTENT_BYTES) {
        console.error(`  skipping ${path}: ${length} bytes exceeds ${MAX_CONTENT_BYTES}`);
        await res.body?.cancel();
        return undefined;
      }
    }
    const entry = await toEntry(res, { binary: binary && res.status === 200 });
    if (entry.bodyBase64 !== undefined) {
      const size = Buffer.from(entry.bodyBase64, "base64").length;
      if (size > MAX_CONTENT_BYTES) {
        console.error(`  skipping ${path}: ${size} bytes exceeds ${MAX_CONTENT_BYTES}`);
        return undefined;
      }
    }
    if (res.status === 401) unauthorized++;
    responses[path] = entry;
    requestCount++;
    console.error(`[${String(requestCount).padStart(4)}] ${res.status} GET ${path}`);
    return entry;
  });
  inflight.set(path, promise);
  return promise;
}

const isOk = (entry) => entry && entry.status >= 200 && entry.status < 300;

/** Records a full item (hal-forms) and everything hanging off it. */
async function recordItem(selfHref) {
  const path = localPath(selfHref);
  if (!path || responses[path]) return;
  const entry = await request(path, { accept: HAL_FORMS });
  if (!isOk(entry) || typeof entry.body !== "object") return;
  const item = entry.body;

  const tasks = [];

  for (const link of linksOf(item, "cg:relation")) {
    const relPath = localPath(link.href);
    if (!relPath) continue;
    tasks.push(
      (async () => {
        const rel = await request(relPath, { redirect: "manual" });
        if (!rel) return;
        if (rel.status >= 300 && rel.status < 400 && rel.location) {
          // To-one relation: record the item the redirect points at as well.
          await recordItem(rel.location);
        } else if (isOk(rel)) {
          const targets = rel.body?._embedded?.item ?? [];
          await Promise.all(
            targets
              .slice(0, TARGET_ITEMS_PER_RELATION)
              .map((target) => recordItem(target?._links?.self?.href)),
          );
        }
      })(),
    );
  }

  if (args.withBytes) {
    for (const link of linksOf(item, "cg:content")) {
      const contentPath = localPath(link.href);
      if (contentPath) tasks.push(request(contentPath, { accept: "*/*", binary: true }));
    }
  }

  await Promise.all(tasks);
}

async function recordEntity(entityLink) {
  // `cg:entity` links point at the entity PROFILE; it is recorded without a query.
  const profilePath = localPath(entityLink.href);
  if (!profilePath) return;
  const profile = await request(profilePath, { accept: HAL_FORMS });
  if (!isOk(profile) || typeof profile.body !== "object") return;

  // The collection is found through the profile's `describes` link named "collection".
  const collectionLink = linksOf(profile.body, "describes").find((l) => l.name === "collection");
  const collectionPath = localPath(collectionLink?.href);
  if (!collectionPath) {
    console.error(`  no describes[name=collection] link on ${profilePath}`);
    return;
  }
  const sep = collectionPath.includes("?") ? "&" : "?";
  const page = await request(`${collectionPath}${sep}size=5`);
  if (!isOk(page) || typeof page.body !== "object") return;

  const tasks = [];
  for (const embedded of (page.body._embedded?.item ?? []).slice(0, ITEMS_PER_ENTITY)) {
    tasks.push(recordItem(embedded?._links?.self?.href));
  }
  await Promise.all(tasks);
}

const started = Date.now();
const root = await request("/profile", { accept: HAL_FORMS });
if (!isOk(root)) {
  console.error(
    `GET /profile answered ${root?.status ?? "no response"}. ${root?.status === 401 ? "The token is expired or invalid." : ""}`,
  );
  process.exit(1);
}
await Promise.all(linksOf(root.body, "cg:entity").map(recordEntity));

const sorted = Object.fromEntries(Object.entries(responses).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  args.out,
  `${JSON.stringify({ capturedAt: new Date().toISOString().slice(0, 10), responses: sorted }, null, 2)}\n`,
);
console.error(
  `Done: ${requestCount} responses in ${Math.round((Date.now() - started) / 1000)}s -> ${args.out}`,
);
if (unauthorized > 0) {
  console.error(
    `WARNING: ${unauthorized} request(s) were answered 401 (token expired mid-run?). Re-run with a fresh token.`,
  );
  process.exit(2);
}
