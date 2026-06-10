import { useMemo } from "react";
import type { User, UserManagerEvents, UserManagerSettings } from "oidc-client-ts";
import { AuthContext } from "react-oidc-context";
import type { AuthContextProps } from "react-oidc-context";

const noop = () => {};
const asyncNoop = async () => {};
const noopSubscribe = () => noop;

const mockEvents = {
  load: asyncNoop,
  unload: asyncNoop,
  addAccessTokenExpiring: noopSubscribe,
  removeAccessTokenExpiring: noopSubscribe,
  addAccessTokenExpired: noopSubscribe,
  removeAccessTokenExpired: noopSubscribe,
  addSilentRenewError: noopSubscribe,
  removeSilentRenewError: noopSubscribe,
  addUserLoaded: noopSubscribe,
  removeUserLoaded: noopSubscribe,
  addUserUnloaded: noopSubscribe,
  removeUserUnloaded: noopSubscribe,
  addUserSignedIn: noopSubscribe,
  removeUserSignedIn: noopSubscribe,
  addUserSignedOut: noopSubscribe,
  removeUserSignedOut: noopSubscribe,
  addUserSessionChanged: noopSubscribe,
  removeUserSessionChanged: noopSubscribe,
} as unknown as UserManagerEvents;

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function createMockUser(token: string): User {
  const claims = decodeJwtPayload(token);
  return {
    profile: {
      email: (claims["email"] as string) ?? "dev@localhost",
      sub: (claims["sub"] as string) ?? "dev",
      iss: (claims["iss"] as string) ?? "dev",
      aud: (claims["aud"] as string) ?? "dev",
      exp: (claims["exp"] as number) ?? 0,
      iat: (claims["iat"] as number) ?? 0,
    },
    access_token: token,
    token_type: "Bearer",
    expired: false,
    expires_in: undefined,
    expires_at: undefined,
    scopes: ["openid"],
    session_state: null,
    state: undefined,
    toStorageString: () => "",
  } as User; // NOSONAR: object literal intentionally omits optional User fields; cast is required by TypeScript
}

export function DevAuthProvider({
  token,
  children,
}: Readonly<{ token: string; children: React.ReactNode }>) {
  const mockAuthContext = useMemo<AuthContextProps>(
    () => ({
      user: createMockUser(token),
      isLoading: false,
      isAuthenticated: true,
      activeNavigator: undefined,
      error: undefined,
      settings: {} as UserManagerSettings,
      events: mockEvents,
      clearStaleState: asyncNoop,
      removeUser: asyncNoop,
      signinPopup: asyncNoop as unknown as AuthContextProps["signinPopup"],
      signinSilent: asyncNoop as unknown as AuthContextProps["signinSilent"],
      signinRedirect: asyncNoop,
      signinResourceOwnerCredentials:
        asyncNoop as unknown as AuthContextProps["signinResourceOwnerCredentials"],
      signoutRedirect: asyncNoop,
      signoutPopup: asyncNoop,
      signoutSilent: asyncNoop,
      querySessionStatus: asyncNoop as unknown as AuthContextProps["querySessionStatus"],
      revokeTokens: asyncNoop,
      startSilentRenew: noop,
      stopSilentRenew: noop,
    }),
    [token],
  );

  return <AuthContext.Provider value={mockAuthContext}>{children}</AuthContext.Provider>;
}
