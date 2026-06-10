import type { User } from "oidc-client-ts";
import { describe, expect, it } from "vitest";
import { createOidcTokenSupplier } from "./token-supplier";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    access_token: "test-token",
    expired: false,
    expires_at: undefined,
    token_type: "Bearer",
    profile: { sub: "u1", iss: "https://oidc.example.com", aud: "client", exp: 0, iat: 0 },
    ...overrides,
  } as User;
}

describe("createOidcTokenSupplier", () => {
  it("returns the access token for a valid non-expired user", async () => {
    const supplier = createOidcTokenSupplier(async () => makeUser({ access_token: "abc123" }));
    const result = await supplier("https://api.example.com", { fetch: globalThis.fetch });
    expect(result).toEqual({ token: "abc123", expiresAt: null });
  });

  it("converts expires_at unix seconds to a Date", async () => {
    const supplier = createOidcTokenSupplier(async () =>
      makeUser({ access_token: "tok", expires_at: 2000 }),
    );
    const result = await supplier("https://api.example.com", { fetch: globalThis.fetch });
    expect(result?.expiresAt).toEqual(new Date(2_000_000));
  });

  it("returns null when getUser resolves to null", async () => {
    const supplier = createOidcTokenSupplier(async () => null);
    expect(await supplier("https://api.example.com", { fetch: globalThis.fetch })).toBeNull();
  });

  it("returns null when access_token is empty", async () => {
    const supplier = createOidcTokenSupplier(async () => makeUser({ access_token: "" }));
    expect(await supplier("https://api.example.com", { fetch: globalThis.fetch })).toBeNull();
  });

  it("returns null when the user is expired", async () => {
    const supplier = createOidcTokenSupplier(async () =>
      makeUser({ access_token: "tok", expired: true }),
    );
    expect(await supplier("https://api.example.com", { fetch: globalThis.fetch })).toBeNull();
  });
});
