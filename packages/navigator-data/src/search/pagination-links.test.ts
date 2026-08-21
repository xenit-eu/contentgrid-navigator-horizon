import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  recallCollectionPageHref,
  rememberCollectionPageHref,
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

describe("collection page-href memo (rememberCollectionPageHref / recallCollectionPageHref)", () => {
  function makeQueryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }

  it("recalls a href previously remembered for the same entity", () => {
    const queryClient = makeQueryClient();
    rememberCollectionPageHref(
      queryClient,
      "invoice",
      "https://api.example.com/invoices?_cursor=0p4jtvf1",
    );

    expect(recallCollectionPageHref(queryClient, "invoice")).toBe(
      "https://api.example.com/invoices?_cursor=0p4jtvf1",
    );
  });

  it("returns undefined when nothing was ever remembered (bookmark/reload/share)", () => {
    const queryClient = makeQueryClient();

    expect(recallCollectionPageHref(queryClient, "invoice")).toBeUndefined();
  });

  it("scopes entries by entity name — same client, different entity, does not collide", () => {
    const queryClient = makeQueryClient();
    rememberCollectionPageHref(queryClient, "invoice", "https://api.example.com/invoices?p=1");
    rememberCollectionPageHref(queryClient, "customer", "https://api.example.com/customers?p=1");

    expect(recallCollectionPageHref(queryClient, "invoice")).toBe(
      "https://api.example.com/invoices?p=1",
    );
    expect(recallCollectionPageHref(queryClient, "customer")).toBe(
      "https://api.example.com/customers?p=1",
    );
  });

  it("is scoped to its own QueryClient instance — a fresh client has no entries", () => {
    const first = makeQueryClient();
    rememberCollectionPageHref(first, "invoice", "https://api.example.com/invoices?p=1");

    const second = makeQueryClient();
    expect(recallCollectionPageHref(second, "invoice")).toBeUndefined();
  });

  it("clears the remembered href when passed undefined, rather than leaving it stale", () => {
    const queryClient = makeQueryClient();
    rememberCollectionPageHref(queryClient, "invoice", "https://api.example.com/invoices?p=2");
    rememberCollectionPageHref(queryClient, "invoice", undefined);

    expect(recallCollectionPageHref(queryClient, "invoice")).toBeUndefined();
  });
});
