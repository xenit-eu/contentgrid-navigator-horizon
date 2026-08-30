import * as React from "react";
import { cn } from "../lib/utils";
import { TabBar, TabContent } from "../primitives/tab-bar";

export interface TabbedLayoutTab {
  readonly key: string;
  readonly label: string;
  /** Icon element rendered in an `IconBadge` before the label, e.g. a Phosphor icon. */
  readonly icon?: React.ReactNode;
  /** `IconBadge` background color for `icon`. Falls back to the theme's muted color. */
  readonly iconColor?: string;
  readonly active?: boolean;
}

export interface TabbedLayoutProps {
  readonly tabs: readonly TabbedLayoutTab[];
  /**
   * Renders one tab's trigger. Wrap `label` in a `TabLink asChild` (passing through
   * `tab.icon`/`tab.iconColor`/`tab.active`) around the caller's router `Link` (e.g.
   * TanStack Router) — packages/ui has no router dependency, so navigation stays the
   * caller's responsibility.
   */
  readonly renderTabLink: (tab: TabbedLayoutTab, label: React.ReactNode) => React.ReactNode;
  readonly orientation?: "horizontal" | "vertical";
  readonly className?: string;
  readonly children?: React.ReactNode;
}

/**
 * Arranges a `TabBar` of route-driven tabs above (or beside, when vertical) a
 * `TabContent` panel. Unlike `Tabs`/`TabsContent`, the active panel is whatever
 * `children` the caller renders for the current route — this pattern only lays
 * the two out together and does not track selection itself.
 */
function TabbedLayout({
  tabs,
  renderTabLink,
  orientation = "horizontal",
  className,
  children,
}: Readonly<TabbedLayoutProps>) {
  return (
    <div
      data-slot="tabbed-layout"
      className={cn(
        "flex flex-col gap-2",
        orientation === "vertical" && "flex-row gap-4",
        className,
      )}
    >
      <TabBar
        orientation={orientation}
        className={orientation === "vertical" ? "w-fit min-w-40" : undefined}
      >
        {tabs.map((tab) => renderTabLink(tab, tab.label))}
      </TabBar>
      <TabContent className={orientation === "vertical" ? "pt-0" : undefined}>
        {children}
      </TabContent>
    </div>
  );
}

export { TabbedLayout };
