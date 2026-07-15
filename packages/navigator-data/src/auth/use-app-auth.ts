import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { createApiClient } from "../api/client";
import type { TypedFetch } from "../api/client";
import { getAppConfig } from "./auth-config";
import { createOidcTokenSupplier } from "./token-supplier";

export interface AppAuthResult {
  auth: ReturnType<typeof useAuth>;
  apiFetch: TypedFetch;
  profileUrl: string;
}

/**
 * Whether auth has settled into a definite, usable state: not still loading,
 * not silently refreshing an expired session, and actually authenticated.
 * Shared by `AuthShell` (gates rendering children) and `RouterContextBridge`
 * (gates pushing `apiFetch`/`profileUrl` into router context) so both agree
 * on exactly when it's safe to start firing authenticated requests.
 */
export function isAuthReady(auth: ReturnType<typeof useAuth>): boolean {
  return !auth.isLoading && !(auth.user?.expired && !auth.error) && auth.isAuthenticated;
}

export function useAppAuth(): AppAuthResult {
  const auth = useAuth();

  // Keep a ref so the token supplier always reads the latest user without recreating apiFetch.
  const authRef = useRef(auth);
  authRef.current = auth;

  const apiFetch = useMemo(() => {
    const supplier = createOidcTokenSupplier(async () => authRef.current.user ?? null);
    return createApiClient(supplier);
  }, []); // created once; token is read via ref on each request

  const { apiBaseUrl } = getAppConfig();

  useEffect(() => {
    if (!auth.isLoading && !auth.error && auth.user?.expired) {
      auth.signinSilent().catch(() => auth.removeUser());
    }
  }, [auth]);

  return { auth, apiFetch, profileUrl: `${apiBaseUrl}/profile` };
}
