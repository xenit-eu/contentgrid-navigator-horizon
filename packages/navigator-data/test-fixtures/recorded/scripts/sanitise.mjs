#!/usr/bin/env node
/**
 * Sanitiser for raw recordings (see ../README.md). Plain Node 20, no dependencies.
 *
 *   node sanitise.mjs --in raw.json --out recorded-dump.json --origin <tenant origin>
 *
 * Rewrites the tenant origin to https://recorded.navigator.test everywhere (bodies and `location`),
 * then pseudonymises, deterministically (counters follow first appearance in the input):
 *   - created_by / last_modified_by (and *_by variants): "User A", "User B", ... / "Service Account"
 *     (values matching --service-account, default /service[-_ ]?account|^sa[-_]/i)
 *   - email addresses anywhere in a string: user-N@example.test
 *   - on item objects (objects with an `id` and `_links`) in every collection, never in /profile
 *     bodies: name, creator, author, owner, first/last/full/display name style keys (plus any
 *     --person-keys): "Person N"; birth-date style keys: 1990-01-DD (shape preserved)
 *   - every `filename`: file-N.ext
 * Already-pseudonymised values are left alone, so running it on a sanitised dump changes nothing.
 *
 * It finishes with a leftover scan of the OUTPUT (including decoded content bytes): the tenant host,
 * emails not ending in example.test, JWT-looking strings and "Bearer ". Any hit is listed and the
 * exit code is 1 (and nothing is written). Item strings that look like "Firstname Lastname" only
 * produce a REVIEW warning (exit code unaffected) so a human checks them. This is a safety net, not a guarantee: names inside free
 * text, PDF/Office metadata and the like need a manual look at the diff. The token is never read.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PLACEHOLDER_ORIGIN = "https://recorded.navigator.test";
const USAGE = `Usage: node sanitise.mjs --in <raw.json> --out <sanitised.json> --origin <tenant origin>
  [--service-account <regex>] [--person-keys <comma separated extra key names>]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i];
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!args.in || !args.out || !args.origin) {
  console.error(USAGE);
  process.exit(1);
}

const tenantOrigin = new URL(args.origin).origin;
const tenantHost = new URL(args.origin).host;
const serviceAccount = new RegExp(args["service-account"] ?? "service[-_ ]?account|^sa[-_]", "i");
const extraPersonKeys = new Set((args["person-keys"] ?? "").split(",").filter(Boolean));

const AUDIT_KEY = /^(created|last_modified|modified|updated)_by$/;
const PERSON_KEY =
  /^(name|creator|author|owner|first_?name|last_?name|full_?name|given_?name|family_?name|surname|display_?name|person_?name|user_?name)$/i;
const NAME_LIKE = /^[A-Z][a-z]+( [A-Z][a-z]+){1,2}$/;
const BIRTH_KEY = /birth|^dob$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ALREADY = {
  audit: /^(User [A-Z]+|Service Account)$/,
  person: /^Person \d+$/,
  file: /^file-\d+(\.[a-z0-9]+)?$/,
  email: /^user-\d+@example\.test$/,
  birth: /^1990-\d{2}-\d{2}/,
};

/** Hands out a stable pseudonym per distinct original value. */
function pseudonymiser(make) {
  const seen = new Map();
  return (value) => {
    if (!seen.has(value)) seen.set(value, make(seen.size));
    return seen.get(value);
  };
}

function letters(index) {
  let label = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1)
    label = String.fromCodePoint(65 + (n % 26)) + label;
  return label;
}

const auditName = pseudonymiser((i) => `User ${letters(i)}`);
const personName = pseudonymiser((i) => `Person ${i + 1}`);
const emailName = pseudonymiser((i) => `user-${i + 1}@example.test`);
const fileStem = pseudonymiser((i) => `file-${i + 1}`);
const birthDate = pseudonymiser((i) => {
  const day = String((i % 28) + 1).padStart(2, "0");
  const month = String((Math.floor(i / 28) % 12) + 1).padStart(2, "0");
  return `1990-${month}-${day}`;
});

function pseudonymiseString(value) {
  return value.replace(EMAIL, (email) =>
    /@example\.test$/i.test(email) ? email : emailName(email.toLowerCase()),
  );
}

function pseudonymiseFilename(filename) {
  if (ALREADY.file.test(filename)) return filename;
  const dot = filename.lastIndexOf(".");
  const extension = dot > 0 ? filename.slice(dot).toLowerCase() : "";
  return `${fileStem(filename)}${extension}`;
}

function pseudonymiseBirth(value) {
  if (ALREADY.birth.test(value)) return value;
  const match = /^\d{4}-\d{2}-\d{2}(.*)$/.exec(value);
  if (!match) return value;
  return `${birthDate(value.slice(0, 10))}${match[1]}`;
}

function isItem(node) {
  return (
    node &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    typeof node.id === "string" &&
    node._links
  );
}

function sanitiseAuditValue(value) {
  if (ALREADY.audit.test(value)) return value;
  if (serviceAccount.test(value)) return "Service Account";
  return auditName(value);
}

function walk(node, context) {
  if (typeof node === "string") {
    return pseudonymiseString(node.split(tenantOrigin).join(PLACEHOLDER_ORIGIN));
  }
  if (Array.isArray(node)) return node.map((child) => walk(child, context));
  if (!node || typeof node !== "object") return node;

  const item = isItem(node);
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && AUDIT_KEY.test(key)) {
      out[key] = sanitiseAuditValue(value);
    } else if (typeof value === "string" && key === "filename") {
      out[key] = pseudonymiseFilename(value);
    } else if (
      item &&
      typeof value === "string" &&
      !context.profile &&
      (PERSON_KEY.test(key) || extraPersonKeys.has(key))
    ) {
      out[key] =
        ALREADY.person.test(value) || ALREADY.email.test(value) ? value : personName(value);
    } else if (item && typeof value === "string" && BIRTH_KEY.test(key)) {
      out[key] = pseudonymiseBirth(value);
    } else {
      out[key] = walk(value, context);
    }
  }
  return out;
}

const raw = JSON.parse(readFileSync(args.in, "utf8"));
const responses = {};
for (const [key, entry] of Object.entries(raw.responses ?? {})) {
  const safeKey = key.split(tenantOrigin).join(PLACEHOLDER_ORIGIN);
  const path = safeKey.replace(/^[A-Z]+ /, "").split("?")[0];
  // Profile bodies describe the model: their `name` is the entity name, never a person.
  const context = { profile: path === "/profile" || path.startsWith("/profile/") };
  const clean = {};
  for (const [field, value] of Object.entries(entry)) {
    clean[field] = field === "bodyBase64" ? value : walk(value, context);
  }
  responses[safeKey] = clean;
}
const output = { capturedAt: raw.capturedAt ?? null, responses };

// Leftover scan.
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/;
const BAD_EMAIL = /[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*example\.test\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const leftovers = [];

function scan(text, where) {
  const checks = [
    ["Bearer token header", /Bearer /],
    ["JWT-looking string", JWT],
    ["email not ending in example.test", BAD_EMAIL],
  ];
  if (tenantOrigin !== PLACEHOLDER_ORIGIN) {
    checks.push(["tenant host", new RegExp(tenantHost.replaceAll(".", String.raw`\.`), "i")]);
  }
  for (const [label, regex] of checks) {
    const match = regex.exec(text);
    if (match) {
      const at = Math.max(0, match.index - 15);
      leftovers.push(`${label} in ${where}: ...${text.slice(at, at + 70).replace(/\s+/g, " ")}...`);
    }
  }
}

for (const [key, entry] of Object.entries(responses)) {
  scan(key, `key ${key}`);
  for (const [field, value] of Object.entries(entry)) {
    if (field === "bodyBase64")
      scan(Buffer.from(value, "base64").toString("latin1"), `${key} (content bytes)`);
    else scan(JSON.stringify(value) ?? "", `${key} ${field}`);
  }
}

// Review warnings (do not fail): item strings that look like "Firstname Lastname".
const warnings = [];
function findNames(node, where) {
  if (Array.isArray(node)) return node.forEach((child) => findNames(child, where));
  if (!node || typeof node !== "object") return;
  if (isItem(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && NAME_LIKE.test(value) && !key.startsWith("_")) {
        warnings.push(`${where} ${key}: "${value}"`);
      }
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== "_links" && key !== "_templates") findNames(value, where);
  }
}
for (const [key, entry] of Object.entries(responses)) {
  if (!key.startsWith("/profile")) findNames(entry.body, key);
}
if (warnings.length > 0) {
  console.error(`REVIEW (${warnings.length}): values that look like a person's name:`);
  for (const line of warnings) console.error(`  ? ${line}`);
}

if (leftovers.length > 0) {
  console.error(`Leftovers found (${leftovers.length}); nothing written:`);
  for (const line of leftovers) console.error(`  - ${line}`);
  process.exit(1);
}

writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
console.error(
  `Sanitised ${Object.keys(responses).length} responses -> ${args.out}; leftover scan clean.`,
);
