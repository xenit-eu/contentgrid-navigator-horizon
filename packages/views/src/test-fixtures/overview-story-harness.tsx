import { type ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { NavigatorDataProvider, ensureProfileEntity } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { OVERVIEW_ENTITY_NAMES, createEntityOverviewFixtureFetch } from "./entity-overview";
import { PROFILE_URL } from "./item-detail";

/**
 * Mounts the Home or Settings view on the overview fixture in a fixed-size box (ADR-009). The
 * profiles load before the view mounts, so its cards appear in its first render; the box stays
 * `aria-busy` until the requests those cards start (the item counts) have finished, which is what
 * the visual harness's `async-content` wait looks for.
 */
export function OverviewStoryHarness({ children }: Readonly<{ children: ReactNode }>) {
  const [apiFetch] = useState(() => createEntityOverviewFixtureFetch() as unknown as TypedFetch);
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  useEffect(() => {
    const loads = OVERVIEW_ENTITY_NAMES.map((name) =>
      ensureProfileEntity(queryClient, apiFetch, PROFILE_URL, { name }),
    );
    void Promise.all(loads).then(() => setProfilesLoaded(true));
  }, [queryClient, apiFetch]);

  return (
    <div className="overflow-hidden rounded-md border" style={{ width: 960, height: 600 }}>
      {profilesLoaded ? (
        <QueryClientProvider client={queryClient}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={contentFetch}
            profileUrl={PROFILE_URL}
          >
            <RecordingNavigationProvider recording={recording}>
              <BusyWhileFetching>{children}</BusyWhileFetching>
            </RecordingNavigationProvider>
          </NavigatorDataProvider>
        </QueryClientProvider>
      ) : (
        <div aria-busy className="h-full" />
      )}
    </div>
  );
}

/**
 * Busy until the first render has committed and no query is fetching. The children's requests
 * start while that first render commits, before this component's own effect runs, so the box never
 * reports ready between mounting and those requests starting.
 */
function BusyWhileFetching({ children }: Readonly<{ children: ReactNode }>) {
  const fetching = useIsFetching();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div aria-busy={!mounted || fetching > 0} className="h-full">
      {children}
    </div>
  );
}
