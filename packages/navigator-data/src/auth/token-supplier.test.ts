import { HttpResponse, http } from "msw";
import type { User } from "oidc-client-ts";
import { describe, expect, it } from "vitest";
import { createRequest } from "@contentgrid/typed-fetch";
import { server } from "../../test-setup";
import { createContentClient } from "../api/client";
import {
  TOKEN_EXCHANGE_PATH,
  createExtensionAwareTokenSupplier,
  createOidcTokenSupplier,
} from "./token-supplier";

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

const APP_URL = "https://app.example.com";
const RENDITION_URL =
  "https://renditions.example.com/pdf?url=https%3A%2F%2Fapp.example.com%2Fdocs%2F1%2Fcontent";
const RENDITION_JOB_URL = "https://renditions.example.com/jobs/42";

/**
 * A content client with the extension-aware supplier, plus an MSW-backed record of the token
 * exchanges and the `Authorization` header every request arrived with.
 */
function setUpExtensionAwareClient() {
  let user = "u1";
  const userWithSub = (sub: string) =>
    makeUser({
      access_token: `user-token-${sub}`,
      profile: { sub, iss: "https://oidc.example.com", aud: "client", exp: 0, iat: 0 },
    });
  const exchanges: { authorization: string | null; resource: string | null }[] = [];
  const authorizations: Record<string, string | null> = {};

  server.use(
    http.post(APP_URL + TOKEN_EXCHANGE_PATH, async ({ request }) => {
      const body = new URLSearchParams(await request.text());
      exchanges.push({
        authorization: request.headers.get("Authorization"),
        resource: body.get("resource"),
      });
      return HttpResponse.json({
        access_token: `extension-token-${exchanges.length}-for-${user}`,
        token_type: "Bearer",
        expires_in: 300,
      });
    }),
    http.get(/^https:\/\/(app|renditions)\.example\.com\/.*/, ({ request }) => {
      authorizations[request.url] = request.headers.get("Authorization");
      return new HttpResponse(new Uint8Array([1]));
    }),
  );

  const supplier = createExtensionAwareTokenSupplier({
    applicationUrl: APP_URL,
    getUser: async () => userWithSub(user),
  });
  const contentFetch = createContentClient(supplier);
  const get = (url: string) => contentFetch(createRequest({ url, method: "GET" }, {}));

  return {
    supplier,
    get,
    exchanges,
    authorizations,
    signIn: (sub: string) => {
      user = sub;
    },
  };
}

describe("createExtensionAwareTokenSupplier", () => {
  it("sends the user's own token to the application origin, without a token exchange", async () => {
    const { get, exchanges, authorizations } = setUpExtensionAwareClient();

    await get(`${APP_URL}/docs/1/content`);

    expect(authorizations[`${APP_URL}/docs/1/content`]).toBe("Bearer user-token-u1");
    expect(exchanges).toHaveLength(0);
  });

  it("sends an exchanged extension token to another origin, never the user's own token", async () => {
    const { get, exchanges, authorizations } = setUpExtensionAwareClient();

    await get(RENDITION_URL);

    expect(exchanges).toEqual([{ authorization: "Bearer user-token-u1", resource: RENDITION_URL }]);
    expect(authorizations[RENDITION_URL]).toBe("Bearer extension-token-1-for-u1");
  });

  it("reuses the extension token for every URL on the same origin", async () => {
    const { get, exchanges, authorizations } = setUpExtensionAwareClient();

    await get(RENDITION_URL);
    await get(RENDITION_JOB_URL);
    await get(RENDITION_JOB_URL);

    expect(exchanges).toHaveLength(1);
    expect(authorizations[RENDITION_JOB_URL]).toBe("Bearer extension-token-1-for-u1");
  });

  it("never hands a cached extension token to another user", async () => {
    const { get, exchanges, authorizations, signIn } = setUpExtensionAwareClient();

    await get(RENDITION_URL);
    signIn("u2");
    await get(RENDITION_JOB_URL);

    expect(exchanges).toHaveLength(2);
    expect(authorizations[RENDITION_JOB_URL]).toBe("Bearer extension-token-2-for-u2");
  });

  it("obtains a new extension token after clear()", async () => {
    const { supplier, get, exchanges, authorizations } = setUpExtensionAwareClient();

    await get(RENDITION_URL);
    supplier.clear();
    await get(RENDITION_JOB_URL);

    expect(exchanges).toHaveLength(2);
    expect(authorizations[RENDITION_JOB_URL]).toBe("Bearer extension-token-2-for-u1");
  });
});
