import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import recordedDump from "../recorded/recorded-dump.json";
import { createDemoHandlers } from "./demo-handlers";

// Hand-checks the committed recording through the handlers: relations replay their recorded
// redirects, and what they point at is served.
const BASE = "https://demo.test";
const AUTH = { Authorization: "Bearer test" };
const responses = recordedDump.responses as unknown as Record<
  string,
  { status: number; location?: string }
>;

const get = (url: string) => fetch(url, { headers: AUTH, redirect: "manual" });
const local = (location: string) => location.replace(BASE, "");

describe("committed recording through the demo handlers", () => {
  it("to-one relation: 302 to an item that is served", async () => {
    server.use(...createDemoHandlers(BASE));
    const [key, entry] = Object.entries(responses).find(
      ([k, v]) => v.status === 302 && !v.location?.includes("?") && k.split("/").length === 4,
    )!;
    const res = await get(`${BASE}${key}`);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toBe(entry.location!.replace("https://recorded.navigator.test", BASE));
    const target = await get(location);
    expect(target.status).toBe(200);
    expect(((await target.json()) as { id: string }).id).toBeTruthy();
  });

  it("to-many relation: 302 to a filtered collection URL served with items", async () => {
    server.use(...createDemoHandlers(BASE));
    const [key] = Object.entries(responses).find(
      ([, v]) => v.status === 302 && v.location?.includes("?"),
    )!;
    const res = await get(`${BASE}${key}`);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("?");
    expect(`/${local(location).split("/").slice(1).join("/")}` in responses).toBe(true);
    const target = await get(location);
    expect(target.status).toBe(200);
    const body = (await target.json()) as { _embedded?: { item: unknown[] } };
    expect(body._embedded?.item.length).toBeGreaterThan(0);
    // Served from the recording, not the generic page.
    const recorded = responses[local(location)] as unknown as { body: unknown };
    expect(body).toEqual(
      JSON.parse(JSON.stringify(recorded.body).replaceAll("https://recorded.navigator.test", BASE)),
    );
  });

  it("unset to-one relation: the recorded 404", async () => {
    server.use(...createDemoHandlers(BASE));
    const [key] = Object.entries(responses).find(([, v]) => v.status === 404)!;
    const res = await get(`${BASE}${key}`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { type: string }).type).toContain("not-found/relation-item");
  });
});
