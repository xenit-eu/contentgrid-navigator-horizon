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
  /**
   * The real address for each `open*` above, when the host has one to give (contract
   * `navigation-context.md`). Lets a view render an `<a href>` instead of a `<button>` — so
   * cmd/middle-click, copy link and screen-reader link semantics work — while a plain click still
   * goes through the matching `open*` function. A host with nothing to link to (a chat panel, a
   * split-view pane) simply omits it; views fall back to a button then. See `NavigationLink`.
   */
  hrefFor?: {
    home(): string;
    entityItemCollection(entityName: string): string;
    item(entityName: string, id: string): string;
  };
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
}: Readonly<{ navigation: Navigation; children: ReactNode }>) {
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

/** Reads the host's navigation object. Throws in development when there is no provider. */
export function useNavigation(): Navigation {
  const navigation = useContext(NavigationContext);
  if (navigation) return navigation;
  if (import.meta.env.DEV) {
    throw new Error("useNavigation must be used inside a <NavigationProvider>");
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
}: Readonly<{ overrides: Partial<Navigation>; children: ReactNode }>) {
  const parent = useNavigation();
  const { openHome, openEntityItemCollection, openItem, hrefFor } = overrides;
  const navigation = useMemo<Navigation>(
    () => ({
      openHome: openHome ?? parent.openHome,
      openEntityItemCollection: openEntityItemCollection ?? parent.openEntityItemCollection,
      openItem: openItem ?? parent.openItem,
      hrefFor: hrefFor ?? parent.hrefFor,
    }),
    [parent, openHome, openEntityItemCollection, openItem, hrefFor],
  );
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
