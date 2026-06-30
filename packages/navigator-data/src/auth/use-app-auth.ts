import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { createApiClient, createContentClient } from "../api/client";
import type { TypedFetch } from "../api/client";
import { getAppConfig } from "./auth-config";
import { createOidcTokenSupplier } from "./token-supplier";

export interface AppAuthResult {
  auth: ReturnType<typeof useAuth>;
  apiFetch: TypedFetch;
  contentFetch: TypedFetch;
  getToken: () => Promise<string | null>;
  profileUrl: string;
}

export function useAppAuth(): AppAuthResult {
  const auth = useAuth();

  // Keep a ref so the token supplier always reads the latest user without recreating clients.
  const authRef = useRef(auth);
  authRef.current = auth;

  const { apiFetch, contentFetch, getToken } = useMemo(() => {
    const supplier = createOidcTokenSupplier(async () => authRef.current.user ?? null);
    return {
      apiFetch: createApiClient(supplier),
      contentFetch: createContentClient(supplier),
      // Read directly from the ref — the supplier type requires HTTP-layer args and is not
      // callable without them; the token is already available on the user object.
      getToken: async (): Promise<string | null> => {
        const user = authRef.current.user;
        if (!user?.access_token || user.expired) return null;
        return user.access_token;
      },
    };
  }, []); // created once; token is read via ref on each request

  const { apiBaseUrl } = getAppConfig();

  useEffect(() => {
    if (!auth.isLoading && !auth.error && auth.user?.expired) {
      auth.signinSilent().catch(() => auth.removeUser());
    }
  }, [auth]);

  return { auth, apiFetch, contentFetch, getToken, profileUrl: `${apiBaseUrl}/profile` };
}
