import type { ReactNode } from "react";
import { NavigatorDataProvider, isAuthReady, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";
import { useCrossTabSignOut } from "./cross-tab-signout";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Root-level auth gate: shows nothing while resolving, the sign-in page when
 * unauthenticated, and otherwise provides NavigatorDataProvider to children.
 * `isAuthReady` is the same check `RouterContextBridge` uses to decide when
 * it's safe to push `apiFetch`/`profileUrl` into router context — kept in
 * one place so the two can't silently drift out of sync.
 *
 * Also wires up `useCrossTabSignOut` here rather than in `AuthProvider`
 * (`navigator-data`) — deciding to redirect this tab when another tab signs
 * out is a UX policy, not a data-access concern, so it belongs alongside
 * `AuthShell`'s other auth-reactive UI decisions.
 */
export function AuthShell({ children }: Readonly<AuthShellProps>) {
  const { auth, apiFetch, contentFetch, profileUrl } = useAppAuth();
  useCrossTabSignOut();

  if (isAuthReady(auth)) {
    return (
      <NavigatorDataProvider
        apiFetch={apiFetch}
        contentFetch={contentFetch}
        profileUrl={profileUrl}
      >
        {children}
      </NavigatorDataProvider>
    );
  }

  const handleSignIn = () => {
    const currentLocation = window.location.pathname + window.location.search;
    return auth.signinRedirect({ state: currentLocation });
  };

  if (auth.error) {
    return <SignInGate error={auth.error.message} onSignIn={handleSignIn} />;
  }

  if (auth.isLoading || auth.user?.expired) {
    return null;
  }

  return <SignInGate onSignIn={handleSignIn} />;
}
