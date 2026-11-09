import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

// Runs the real recorder against a local server with the real link shape: cg:entity links point at
// profiles, and the collection is only reachable through profile `describes[name=collection]`.
it("crawls profile -> describes collection -> items -> relations", async () => {
  const requests = [];
  const server = createServer((req, res) => {
    const o = `http://${req.headers.host}`;
    requests.push(`${req.method} ${req.url}`);
    const json = (status, body, headers = {}) => {
      res.writeHead(status, { "content-type": "application/hal+json", ...headers });
      res.end(JSON.stringify(body));
    };
    const item = (id) => ({
      id,
      _links: {
        self: { href: `${o}/things/${id}` },
        "cg:relation": [{ href: `${o}/things/${id}/owner`, name: "owner" }],
      },
    });
    switch (req.url) {
      case "/profile":
        return json(200, { _links: { "cg:entity": [{ href: `${o}/profile/things` }] } });
      case "/profile/things":
        return json(200, {
          _links: {
            describes: [
              { href: `${o}/things`, name: "collection" },
              { href: `${o}/things/{id}`, name: "item", templated: true },
            ],
          },
        });
      case "/things?size=5":
        return json(200, { _embedded: { item: [item("a")] } });
      case "/things/a":
        return json(200, item("a"));
      case "/things/a/owner":
        return json(302, {}, { location: `${o}/things/b` });
      case "/things/b":
        return json(200, item("b"));
      default:
        return json(404, { status: 404 });
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const dir = mkdtempSync(join(tmpdir(), "record-"));
  writeFileSync(join(dir, "token"), "t");
  const script = join(
    process.cwd(),
    "packages/navigator-data/test-fixtures/recorded/scripts/record.mjs",
  );
  try {
    await new Promise((resolve, reject) => {
      import("node:child_process").then(({ execFile }) =>
        execFile(
          process.execPath,
          [
            script,
            "--base",
            `http://127.0.0.1:${port}`,
            "--token",
            join(dir, "token"),
            "--out",
            join(dir, "out.json"),
          ],
          (err) => (err ? reject(err) : resolve()),
        ),
      );
    });
  } finally {
    server.close();
  }
  const { responses } = JSON.parse(readFileSync(join(dir, "out.json"), "utf8"));
  expect(Object.keys(responses).sort()).toEqual([
    "/profile",
    "/profile/things",
    "/things/a",
    "/things/a/owner",
    "/things/b",
    "/things/b/owner",
    "/things?size=5",
  ]);
  expect(requests.every((r) => r.startsWith("GET "))).toBe(true);
});
