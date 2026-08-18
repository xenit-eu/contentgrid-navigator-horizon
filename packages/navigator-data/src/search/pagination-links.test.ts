import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  registerCursorHref,
  resolveCursorHref,
  resolveTrustedCollectionUrl,
} from "./pagination-links";

describe("resolveTrustedCollectionUrl", () => {
  const API_BASE = "https://api.example.com/profile";

  it("resolves a relative same-origin cursor against the API base", () => {
    expect(resolveTrustedCollectionUrl("/invoices?cursor=abc", API_BASE)).toBe(
      "https://api.example.com/invoices?cursor=abc",
    );
  });

  it("accepts an absolute same-origin cursor verbatim", () => {
    expect(
      resolveTrustedCollectionUrl("https://api.example.com/invoices?cursor=abc", API_BASE),
    ).toBe("https://api.example.com/invoices?cursor=abc");
  });

  it("rejects an absolute cross-origin cursor", () => {
    expect(resolveTrustedCollectionUrl("https://evil.example/x", API_BASE)).toBeNull();
  });

  it("rejects a protocol-relative cursor pointing at another origin", () => {
    expect(resolveTrustedCollectionUrl("//evil.example/x", API_BASE)).toBeNull();
  });

  it("returns null when the cursor cannot be parsed even against the base", () => {
    expect(resolveTrustedCollectionUrl("http://[::1", API_BASE)).toBeNull();
  });

  it("returns null when the API base itself is not a valid absolute URL", () => {
    expect(resolveTrustedCollectionUrl("/invoices", "/relative-base")).toBeNull();
  });
});

describe("cursor registry (registerCursorHref / resolveCursorHref)", () => {
  function makeQueryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }

  it("resolves a href previously registered for the same entity + token", () => {
    const queryClient = makeQueryClient();
    registerCursorHref(
      queryClient,
      "invoice",
      "0p4jtvf1",
      "https://api.example.com/invoices?_cursor=0p4jtvf1",
    );

    expect(resolveCursorHref(queryClient, "invoice", "0p4jtvf1")).toBe(
      "https://api.example.com/invoices?_cursor=0p4jtvf1",
    );
  });

  it("returns undefined for a token that was never registered (bookmark/reload/share)", () => {
    const queryClient = makeQueryClient();

    expect(resolveCursorHref(queryClient, "invoice", "never-seen")).toBeUndefined();
  });

  it("scopes entries by entity name — same token, different entity, does not collide", () => {
    const queryClient = makeQueryClient();
    registerCursorHref(
      queryClient,
      "invoice",
      "abc",
      "https://api.example.com/invoices?_cursor=abc",
    );
    registerCursorHref(
      queryClient,
      "customer",
      "abc",
      "https://api.example.com/customers?_cursor=abc",
    );

    expect(resolveCursorHref(queryClient, "invoice", "abc")).toBe(
      "https://api.example.com/invoices?_cursor=abc",
    );
    expect(resolveCursorHref(queryClient, "customer", "abc")).toBe(
      "https://api.example.com/customers?_cursor=abc",
    );
  });

  it("is scoped to its own QueryClient instance — a fresh client has no entries", () => {
    const first = makeQueryClient();
    registerCursorHref(first, "invoice", "abc", "https://api.example.com/invoices?_cursor=abc");

    const second = makeQueryClient();
    expect(resolveCursorHref(second, "invoice", "abc")).toBeUndefined();
  });
});
