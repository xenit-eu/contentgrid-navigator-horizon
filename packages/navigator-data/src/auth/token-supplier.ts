import type { User } from "oidc-client-ts";
import type { AuthenticationTokenSupplier } from "@contentgrid/fetch-hook-authentication";

export function createOidcTokenSupplier(
  getUser: () => Promise<User | null>,
): AuthenticationTokenSupplier {
  return async () => {
    const user = await getUser();
    if (!user?.access_token) {
      return null;
    }
    return {
      token: user.access_token,
      expiresAt: user.expires_at ? new Date(user.expires_at * 1000) : null,
    };
  };
}
