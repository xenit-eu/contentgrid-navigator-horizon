import type { ReactNode } from "react";
import type { Decorator } from "@storybook/react";
import { NavigationProvider } from "./navigation-context";
import type { Navigation, NavigationOptions } from "./navigation-context";

/** `options` is part of `args` only when the caller passed it, so plain calls stay `["invoice", "42"]`. */
export type NavigationCall =
  | { method: "openHome"; args: [] | [options: NavigationOptions] }
  | {
      method: "openEntityItemCollection";
      args: [entityName: string] | [entityName: string, options: NavigationOptions];
    }
  | {
      method: "openItem";
      args:
        | [entityName: string, id: string]
        | [entityName: string, id: string, options: NavigationOptions];
    }
  | {
      method: "openCreateItem";
      args: [entityName: string] | [entityName: string, options: NavigationOptions];
    }
  | { method: "openClassifyCreate"; args: [] | [options: NavigationOptions] }
  | { method: "openSettings"; args: [] | [options: NavigationOptions] };

export interface RecordingNavigation {
  navigation: Navigation;
  /** Every call so far, in call order. */
  calls: NavigationCall[];
}

/** A navigation object that stores each call instead of navigating, for stories and tests. */
export function createRecordingNavigation(): RecordingNavigation {
  const calls: NavigationCall[] = [];
  const navigation: Navigation = {
    openHome: (options) => {
      calls.push({ method: "openHome", args: options ? [options] : [] });
    },
    openEntityItemCollection: (entityName, options) => {
      calls.push({
        method: "openEntityItemCollection",
        args: options ? [entityName, options] : [entityName],
      });
    },
    openItem: (entityName, id, options) => {
      calls.push({
        method: "openItem",
        args: options ? [entityName, id, options] : [entityName, id],
      });
    },
    openCreateItem: (entityName, options) => {
      calls.push({
        method: "openCreateItem",
        args: options ? [entityName, options] : [entityName],
      });
    },
    openClassifyCreate: (options) => {
      calls.push({ method: "openClassifyCreate", args: options ? [options] : [] });
    },
    openSettings: (options) => {
      calls.push({ method: "openSettings", args: options ? [options] : [] });
    },
    hrefFor: {
      home: () => "/",
      entityItemCollection: (entityName) => `/${entityName}`,
      item: (entityName, id) => `/${entityName}/${id}`,
    },
  };
  return { navigation, calls };
}

export function RecordingNavigationProvider({
  recording,
  children,
}: Readonly<{ recording: RecordingNavigation; children: ReactNode }>) {
  return <NavigationProvider navigation={recording.navigation}>{children}</NavigationProvider>;
}

/** Storybook decorator that provides a recording navigation (optionally one the story inspects). */
export function withRecordingNavigation(
  recording: RecordingNavigation = createRecordingNavigation(),
): Decorator {
  return (Story) => (
    <RecordingNavigationProvider recording={recording}>
      <Story />
    </RecordingNavigationProvider>
  );
}
