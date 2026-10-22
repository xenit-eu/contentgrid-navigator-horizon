import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/**
 * The one object a host provides for opening things (contract `navigation-context.md`). Views call
 * it instead of the router; features get callback props that their view wires to it. The host
 * decides what happens next.
 *
 * `openClassifyCreate`, `openEditItem` and `openCreateItem` are added with the pages that use them.
 */
export interface Navigation {
  openHome(): void;
  /** Opens the entity's list, restored as the user left it. */
  openEntityItemCollection(entityName: string): void;
  openItem(entityName: string, id: string): void;
}

const NavigationContext = createContext<Navigation | null>(null);

// Outside development a missing provider degrades to a no-op rather than crashing the page.
const noopNavigation: Navigation = {
  openHome: () => {},
  openEntityItemCollection: () => {},
  openItem: () => {},
};

export function NavigationProvider({
  navigation,
  children,
}: Readonly<{
  /** Must be referentially stable (e.g. via `useMemo`) — consumers of this context memoise on it. */
  navigation: Navigation;
  children: ReactNode;
}>) {
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

// Logged once per module lifetime so a host that never wires a <NavigationProvider> doesn't spam
// the console on every call.
let hasLoggedMissingProvider = false;

/** Reads the host's navigation object. Throws in development when there is no provider. */
export function useViewNavigation(): Navigation {
  const navigation = useContext(NavigationContext);
  if (navigation) return navigation;
  if (import.meta.env.DEV) {
    throw new Error("useViewNavigation must be used inside a <NavigationProvider>");
  }
  if (!hasLoggedMissingProvider) {
    hasLoggedMissingProvider = true;
    // eslint-disable-next-line no-console -- intentional, once per module; see the comment above.
    console.error(
      "useViewNavigation was called outside a <NavigationProvider>; navigation is a no-op.",
    );
  }
  return noopNavigation;
}

/**
 * Gives one child view its own navigation object (contract rule 6). A parent view wraps each child
 * with this; calls the parent does not override go to the parent's own navigation.
 */
export function ChildNavigationProvider({
  overrides,
  children,
}: Readonly<{
  /** Must be referentially stable (e.g. via `useMemo`) — this provider memoises on it. */
  overrides: Partial<Navigation>;
  children: ReactNode;
}>) {
  const parent = useViewNavigation();
  const { openHome, openEntityItemCollection, openItem } = overrides;
  const navigation = useMemo<Navigation>(
    () => ({
      openHome: openHome ?? parent.openHome,
      openEntityItemCollection: openEntityItemCollection ?? parent.openEntityItemCollection,
      openItem: openItem ?? parent.openItem,
    }),
    [parent, openHome, openEntityItemCollection, openItem],
  );
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
