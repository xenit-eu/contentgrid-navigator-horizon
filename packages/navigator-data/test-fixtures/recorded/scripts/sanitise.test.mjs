import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const script = join(
  process.cwd(),
  "packages/navigator-data/test-fixtures/recorded/scripts/sanitise.mjs",
);
const TENANT = "https://tenant.example.org";

function run(raw, origin = TENANT) {
  const dir = mkdtempSync(join(tmpdir(), "sanitise-"));
  writeFileSync(join(dir, "raw.json"), JSON.stringify(raw));
  const result = spawnSync(
    process.execPath,
    [script, "--in", join(dir, "raw.json"), "--out", join(dir, "out.json"), "--origin", origin],
    { encoding: "utf8" },
  );
  let out;
  try {
    out = JSON.parse(readFileSync(join(dir, "out.json"), "utf8"));
  } catch {
    out = undefined;
  }
  return { ...result, out };
}

const item = (extra) => ({
  id: "i1",
  _links: { self: { href: `${TENANT}/widgets/i1` } },
  ...extra,
});
const raw = {
  capturedAt: "2026-01-01",
  responses: {
    "/profile/widgets": { status: 200, body: { name: "widget", title: "Widget" } },
    "/widgets/i1": {
      status: 200,
      body: item({
        name: "Jane Smith",
        creator: "Jane Smith",
        owner: "Bob Jones",
        title: "Mary Ann Lee",
        note: "plain text",
      }),
    },
  },
};

it("pseudonymises name/creator/owner on items of any collection, never in profiles", () => {
  const { status, out } = run(raw);
  expect(status).toBe(0);
  const body = out.responses["/widgets/i1"].body;
  expect(body.name).toBe("Person 1");
  expect(body.creator).toBe("Person 1");
  expect(body.owner).toBe("Person 2");
  expect(out.responses["/profile/widgets"].body.name).toBe("widget");
});

it("warns (without failing) about remaining Firstname Lastname values, and is idempotent", () => {
  const first = run(raw);
  expect(first.stderr).toContain("REVIEW");
  expect(first.stderr).toContain('title: "Mary Ann Lee"');
  expect(first.stderr).not.toContain("Jane Smith");
  const second = run(first.out, "https://recorded.navigator.test");
  expect(second.status).toBe(0);
  expect(second.out).toEqual(first.out);
});

it("still fails on leftovers", () => {
  const bad = JSON.parse(JSON.stringify(raw));
  bad.responses["/widgets/i1"].body.note = "see Bearer abc";
  expect(run(bad).status).toBe(1);
});
