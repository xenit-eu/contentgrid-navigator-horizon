import type { User } from "oidc-client-ts";
import {
  type AuthenticationTokenSupplier,
  CompositeTokenSupplierBuilder,
  createCachingTokenSupplier,
  createContentgridTokenExchangeTokenSupplier,
} from "@contentgrid/fetch-hook-authentication";

export function createOidcTokenSupplier(
  getUser: () => Promise<User | null>,
): AuthenticationTokenSupplier {
  return async () => {
    const user = await getUser();
    if (!user?.access_token || user.expired) {
      return null;
    }
    return {
      token: user.access_token,
      expiresAt: user.expires_at ? new Date(user.expires_at * 1000) : null,
    };
  };
}

/**
 * Path of the user-facing token exchange endpoint, on the application origin
 * (contentgrid-system-design `extension-authentication.md`, "User-facing token exchange").
 */
export const TOKEN_EXCHANGE_PATH = "/.contentgrid/authentication/external/token";

export interface ExtensionAwareTokenSupplierOptions {
  /** Base URL of the ContentGrid application (`RuntimeAppConfig.apiBaseUrl`). */
  applicationUrl: string;
  /**
   * The signed-in OIDC user. Its access token is used for the application origin and the token
   * exchange itself; its `sub` keeps exchanged tokens from being handed to another user.
   */
  getUser: () => Promise<User | null>;
}

/** A token supplier whose cached extension tokens can be dropped, e.g. when the user signs out or changes. */
export type ExtensionAwareTokenSupplier = AuthenticationTokenSupplier & {
  /** Removes all cached extension tokens. */
  clear(): void;
};

/**
 * Token supplier for requests that may leave the application origin, such as rendition requests.
 *
 * - The application origin gets the user's own access token, as before.
 * - Any other origin (an extension, e.g. the rendition service) gets an extension token, obtained
 *   from the application's token exchange endpoint. The user's own token, which grants access to
 *   every application of the organization, is never sent there.
 *
 * Extension tokens are cached per user and per origin until they are about to expire: the spec
 * allows sending one to every URL on the origin it was requested for. The token exchange request
 * goes through the same client, so it is on the application origin and carries the user's token.
 */
export function createExtensionAwareTokenSupplier({
  applicationUrl,
  getUser,
}: ExtensionAwareTokenSupplierOptions): ExtensionAwareTokenSupplier {
  const applicationOrigin = new URL(applicationUrl).origin;
  const extensionTokenSupplier = createCachingTokenSupplier(
    createContentgridTokenExchangeTokenSupplier({
      exchangeUrl: applicationOrigin + TOKEN_EXCHANGE_PATH,
    }),
    {
      uriKey: (uri) => new URL(uri).origin,
      scope: async () => (await getUser())?.profile.sub,
    },
  );
  const supplier = new CompositeTokenSupplierBuilder()
    .origin(applicationOrigin, createOidcTokenSupplier(getUser))
    .default(extensionTokenSupplier)
    .build();

  return Object.assign(supplier, { clear: () => extensionTokenSupplier.clear() });
}
