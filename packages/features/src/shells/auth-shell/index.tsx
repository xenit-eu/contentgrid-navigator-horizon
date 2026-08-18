import type { ReactNode } from "react";
import { NavigatorDataProvider, isAuthReady, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Root-level auth gate: shows nothing while resolving, the sign-in page when
 * unauthenticated, and otherwise provides NavigatorDataProvider to children.
 * `isAuthReady` is the same check `RouterContextBridge` uses to decide when
 * it's safe to push `apiFetch`/`profileUrl` into router context — kept in
 * one place so the two can't silently drift out of sync.
 */
export function AuthShell({ children }: Readonly<AuthShellProps>) {
  const { auth, apiFetch, contentFetch, profileUrl } = useAppAuth();

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

  if (auth.error) {
    return <SignInGate error={auth.error.message} onSignIn={() => auth.signinRedirect()} />;
  }

  if (auth.isLoading || auth.user?.expired) {
    return null;
  }

  return <SignInGate onSignIn={() => auth.signinRedirect()} />;
}
