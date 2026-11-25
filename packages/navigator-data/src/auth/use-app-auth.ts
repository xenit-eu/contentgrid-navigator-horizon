import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { createApiClient, createContentClient } from "../api/client";
import type { ContentFetch, TypedFetch } from "../api/client";
import {
  DEFAULT_RENDITION_POLL_INTERVAL_MS,
  DEFAULT_RENDITION_TIMEOUT_MS,
} from "../preview/rendition-job";
import { getAppConfig } from "./auth-config";
import { createExtensionAwareTokenSupplier, createOidcTokenSupplier } from "./token-supplier";

export interface AppAuthResult {
  auth: ReturnType<typeof useAuth>;
  /** Authenticated fetch client for HAL JSON requests (sets Accept: hal+json). */
  apiFetch: TypedFetch;
  /**
   * Authenticated fetch client for binary content requests (no Accept: hal+json header).
   * Use exclusively for PUT/GET to cg:content links and rendition requests: the application
   * origin gets the user's token, any other origin (the rendition service) an exchanged
   * extension token — see `createExtensionAwareTokenSupplier`.
   */
  contentFetch: ContentFetch;
  profileUrl: string;
  /** URI template for the PDF rendition service, from `RuntimeAppConfig.renditionUriTemplate`. */
  renditionUriTemplate?: string;
  /**
   * Poll interval/ceiling for rendition jobs, populated with `RuntimeAppConfig`'s
   * `renditionPollIntervalMs`/`renditionTimeoutMs` (defaulting to 2000ms/60000ms) whenever
   * `renditionUriTemplate` is configured; `undefined` when renditions are disabled.
   */
  renditionPolling?: { intervalMs: number; timeoutMs: number };
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

  const { apiFetch, contentFetch, clearExtensionTokens } = useMemo(() => {
    const getUser = async () => authRef.current.user ?? null;
    const supplier = createOidcTokenSupplier(getUser);
    const contentSupplier = createExtensionAwareTokenSupplier({
      applicationUrl: getAppConfig().apiBaseUrl,
      getUser,
    });
    return {
      apiFetch: createApiClient(supplier),
      contentFetch: createContentClient(contentSupplier),
      clearExtensionTokens: contentSupplier.clear,
    };
  }, []); // created once; token is read via ref on each request

  // Drop the cached extension tokens when the user signs out or changes (and on unmount), so a
  // previous user's tokens don't stay in memory until they expire.
  const userSub = auth.user?.profile.sub;
  useEffect(() => clearExtensionTokens, [userSub, clearExtensionTokens]);

  const { apiBaseUrl, renditionUriTemplate, renditionPollIntervalMs, renditionTimeoutMs } =
    getAppConfig();

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

  // Memoised on the three primitive inputs: NavigatorDataProvider (context.tsx) memoises its
  // context value on this object's identity, so a fresh object every render would invalidate
  // every useNavigatorData() consumer on every AuthShell render.
  const renditionPolling = useMemo(
    () =>
      renditionUriTemplate
        ? {
            intervalMs: renditionPollIntervalMs ?? DEFAULT_RENDITION_POLL_INTERVAL_MS,
            timeoutMs: renditionTimeoutMs ?? DEFAULT_RENDITION_TIMEOUT_MS,
          }
        : undefined,
    [renditionUriTemplate, renditionPollIntervalMs, renditionTimeoutMs],
  );

  return {
    auth,
    apiFetch,
    contentFetch,
    profileUrl: `${apiBaseUrl}/profile`,
    renditionUriTemplate,
    renditionPolling,
  };
}
