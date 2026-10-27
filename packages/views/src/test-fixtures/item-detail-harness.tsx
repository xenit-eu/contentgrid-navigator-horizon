import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { PROFILE_URL, createFixtureFetch } from "./item-detail";

/**
 * The provider stack every `EntityItemDetailView` test mounts under: a query client, the
 * navigator-data provider wired to the item-detail fixture (or a caller-supplied fetch/query
 * client), and a recording navigation. Shared so the view's test files don't each hand-roll the
 * same three providers.
 */
export function createItemDetailTestHarness(
  options: Readonly<{ queryClient?: QueryClient; fetchFn?: unknown }> = {},
) {
  const fixture = createFixtureFetch();
  const apiFetch = (options.fetchFn ?? fixture.fetch) as TypedFetch;
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });
  const queryClient =
    options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const recording = createRecordingNavigation();

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          <RecordingNavigationProvider recording={recording}>
            {children}
          </RecordingNavigationProvider>
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, recording, queryClient, apiFetch, counts: fixture.counts };
}
