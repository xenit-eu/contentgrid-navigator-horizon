import type { ReactNode } from "react";
import type { Decorator } from "@storybook/react";
import { NavigationProvider } from "./navigation-context";
import type { Navigation } from "./navigation-context";

export type NavigationCall =
  | { method: "openHome"; args: [] }
  | { method: "openEntityItemCollection"; args: [entityName: string] }
  | { method: "openItem"; args: [entityName: string, id: string] };

export interface RecordingNavigation {
  navigation: Navigation;
  /** Every call so far, in call order. */
  calls: NavigationCall[];
}

/** A navigation object that stores each call instead of navigating, for stories and tests. */
export function createRecordingNavigation(): RecordingNavigation {
  const calls: NavigationCall[] = [];
  const navigation: Navigation = {
    openHome: () => {
      calls.push({ method: "openHome", args: [] });
    },
    openEntityItemCollection: (entityName) => {
      calls.push({ method: "openEntityItemCollection", args: [entityName] });
    },
    openItem: (entityName, id) => {
      calls.push({ method: "openItem", args: [entityName, id] });
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
