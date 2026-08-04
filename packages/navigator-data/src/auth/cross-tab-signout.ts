import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { getAppConfig } from "./auth-config";

// Matches oidc-client-ts's WebStorageStateStore default key format
// (prefix "oidc." + UserManager._userStoreKey "user:<authority>:<client_id>").
function getOidcUserStorageKey(authority: string, clientId: string): string {
  return `oidc.user:${authority}:${clientId}`;
}

function addCrossTabSignOutListener(
  authority: string,
  clientId: string,
  signOut: () => void,
): () => void {
  const oidcKey = getOidcUserStorageKey(authority, clientId);

  function handleStorageChange(event: StorageEvent) {
    // event.key is null specifically on a full localStorage.clear() — the
    // session is gone either way, so treat it the same as the key being cleared.
    if ((event.key === oidcKey || event.key === null) && !event.newValue) {
      signOut();
    }
  }

  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

export function useCrossTabSignOut(): void {
  const auth = useAuth();

  // Ref so the listener always signs out with the latest auth instance
  // without re-subscribing to `storage` on every token refresh.
  const authRef = useRef(auth);
  authRef.current = auth;

  useEffect(() => {
    const { authority, clientId } = getAppConfig();
    return addCrossTabSignOutListener(authority, clientId, () => {
      authRef.current.signoutRedirect();
    });
  }, []);
}
