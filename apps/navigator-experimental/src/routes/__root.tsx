import { useEffect, useMemo, useRef } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import {
  NavigatorDataProvider,
  createApiClient,
  createOidcTokenSupplier,
  getAppConfig,
  useAuth,
} from "@contentgrid/navigator-data";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
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

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => auth.signinRedirect()}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <NavigatorDataProvider apiFetch={apiFetch} profileUrl={`${apiBaseUrl}/profile`}>
      <>
        <ExperimentalBanner />
        <Outlet />
      </>
    </NavigatorDataProvider>
  );
}
