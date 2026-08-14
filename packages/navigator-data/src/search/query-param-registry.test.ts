import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { extractParamFromHref, mintHrefToken, resolveHrefToken } from "./query-param-registry";

describe("extractParamFromHref", () => {
  it("extracts a named param from an absolute href", () => {
    expect(
      extractParamFromHref("https://api.example.com/invoices?_cursor=0p4jtvf1", "_cursor"),
    ).toBe("0p4jtvf1");
  });

  it("extracts a named param from a relative href", () => {
    expect(extractParamFromHref("/invoices?_size=20&_cursor=0p4jtvf1", "_cursor")).toBe("0p4jtvf1");
  });

  it("extracts a param other than _cursor", () => {
    expect(extractParamFromHref("/invoices?_size=20&_cursor=0p4jtvf1", "_size")).toBe("20");
  });

  it("returns undefined when href is undefined", () => {
    expect(extractParamFromHref(undefined, "_cursor")).toBeUndefined();
  });

  it("returns undefined when the href has no matching param", () => {
    expect(extractParamFromHref("/invoices?_size=20", "_cursor")).toBeUndefined();
  });

  it("returns undefined when the href cannot be parsed", () => {
    expect(extractParamFromHref("http://[::1", "_cursor")).toBeUndefined();
  });
});

describe("mintHrefToken / resolveHrefToken", () => {
  it("mints the token from href and resolves it back to that literal href", () => {
    const queryClient = new QueryClient();
    const href = "https://api.example.com/invoices?_size=20&_cursor=0p4jtvf1";

    const token = mintHrefToken(queryClient, "invoice", "_cursor", href);

    expect(token).toBe("0p4jtvf1");
    expect(resolveHrefToken(queryClient, "invoice", "_cursor", "0p4jtvf1")).toBe(href);
  });

  it("mints nothing and returns undefined when href has no matching param", () => {
    const queryClient = new QueryClient();

    expect(mintHrefToken(queryClient, "invoice", "_cursor", "/invoices")).toBeUndefined();
  });

  it("mints nothing and returns undefined when href is undefined", () => {
    const queryClient = new QueryClient();

    expect(mintHrefToken(queryClient, "invoice", "_cursor", undefined)).toBeUndefined();
  });

  it("returns undefined for a token that was never minted", () => {
    const queryClient = new QueryClient();

    expect(resolveHrefToken(queryClient, "invoice", "_cursor", "unregistered")).toBeUndefined();
  });

  it("scopes tokens by entity name — the same token for a different entity misses", () => {
    const queryClient = new QueryClient();
    const href = "https://api.example.com/invoices?_size=20&_cursor=0p4jtvf1";

    mintHrefToken(queryClient, "invoice", "_cursor", href);

    expect(resolveHrefToken(queryClient, "product", "_cursor", "0p4jtvf1")).toBeUndefined();
  });

  it("scopes tokens by param name — a different param name for the same value misses", () => {
    const queryClient = new QueryClient();
    const href = "https://api.example.com/invoices?_size=20&_cursor=0p4jtvf1";

    mintHrefToken(queryClient, "invoice", "_size", href);

    expect(resolveHrefToken(queryClient, "invoice", "_cursor", "20")).toBeUndefined();
  });
});
