import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { createApiClient, createContentClient } from "../api/client";
import type { TypedFetch } from "../api/client";
import { getAppConfig } from "./auth-config";
import { createOidcTokenSupplier } from "./token-supplier";

export interface AppAuthResult {
  auth: ReturnType<typeof useAuth>;
  /** Authenticated fetch client for HAL JSON requests (sets Accept: hal+json). */
  apiFetch: TypedFetch;
  /**
   * Authenticated fetch client for binary content requests (no Accept: hal+json header).
   * Use exclusively for PUT/GET to cg:content links.
   */
  contentFetch: TypedFetch;
  profileUrl: string;
}

/**
 * Whether auth has settled into a definite, usable state: not still loading,
 * not silently refreshing an expired session, and actually authenticated.
 * Shared by `AuthShell` (gates rendering children) and `RouterContextBridge`
 * (gates pushing `apiFetch`/`profileUrl` into router context) so both agree
 * on exactly when it's safe to start firing authenticated requests.
 *
 * Checks `user.expired` directly rather than trusting `isAuthenticated` alone —
 * react-oidc-context only recomputes `isAuthenticated` on a `USER_LOADED`-type
 * dispatch, so it stays stale (true) if a background silent-renewal attempt
 * fails and never re-dispatches. Reading `user.expired` avoids depending on
 * that staleness window.
 */
export function isAuthReady(auth: ReturnType<typeof useAuth>): boolean {
  return !auth.isLoading && auth.isAuthenticated && !auth.user?.expired;
}

export function useAppAuth(): AppAuthResult {
  const auth = useAuth();

  // Keep a ref so the token supplier always reads the latest user without recreating apiFetch.
  const authRef = useRef(auth);
  authRef.current = auth;

  const { apiFetch, contentFetch } = useMemo(() => {
    const supplier = createOidcTokenSupplier(async () => authRef.current.user ?? null);
    return {
      apiFetch: createApiClient(supplier),
      contentFetch: createContentClient(supplier),
    };
  }, []); // created once; token is read via ref on each request

  const { apiBaseUrl } = getAppConfig();

  useEffect(() => {
    if (!auth.isLoading && !auth.error && auth.user?.expired) {
      // signinSilent() never rejects — on failure it resolves `null` after
      // dispatching its own error internally (react-oidc-context), so a
      // `.catch()` here would never run. Detect failure via the resolved
      // value instead.
      auth.signinSilent().then((user) => {
        if (!user) auth.removeUser();
      });
    }
  }, [auth]);

  return { auth, apiFetch, contentFetch, profileUrl: `${apiBaseUrl}/profile` };
}
