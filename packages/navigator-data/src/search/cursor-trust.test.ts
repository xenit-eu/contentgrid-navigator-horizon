import { describe, expect, it } from "vitest";
import { resolveTrustedCollectionUrl } from "./cursor-trust";

const API_BASE = "https://api.example.com/profile";

describe("resolveTrustedCollectionUrl", () => {
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
