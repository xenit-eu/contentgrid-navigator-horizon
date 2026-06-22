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
      auth.signinSilent().catch(() => auth.removeUser());
    }
  }, [auth]);

  return { auth, apiFetch, contentFetch, profileUrl: `${apiBaseUrl}/profile` };
}
