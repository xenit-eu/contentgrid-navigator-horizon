import { type ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { NavigatorDataProvider, ensureProfileEntity } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  type CollectionViewState,
  EntityItemCollectionView,
} from "../entity-item-collection/entity-item-collection-view";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { INVOICE_COLLECTION_URL, createInvoiceCollectionFixtureFetch } from "./invoice-collection";
import { PROFILE_URL } from "./item-detail";

/** What the collection request does in a story: never answers, answers once, or fails. */
export type CollectionStoryState = "loading" | "paging" | "failed";

const NEXT_PAGE_URL = `${INVOICE_COLLECTION_URL}?_cursor=page2`;
const NEVER = new Promise<Response>(() => {});

function fixtureFetch(state: CollectionStoryState) {
  const answer = createInvoiceCollectionFixtureFetch();
  return async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const isCollection =
      url === INVOICE_COLLECTION_URL || url.startsWith(`${INVOICE_COLLECTION_URL}?`);
    if (isCollection && state === "loading") return NEVER;
    if (isCollection && state === "paging" && url === NEXT_PAGE_URL) return NEVER;
    if (isCollection && state === "failed") {
      return new Response(
        JSON.stringify({ type: "about:blank", title: "Internal Server Error", status: 500 }),
        { status: 500, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return answer(input);
  };
}

/**
 * Mounts the invoice collection view in a fixed-size box (ADR-009) with its collection request
 * held in one state. A held request never settles, so these stories are not `async-content`
 * (they would be busy for ever); instead the box carries `data-story-ready` once the state shows:
 * for "paging", after the first page has loaded and the next one was asked for.
 */
export function CollectionStateStoryHarness({
  state,
  children,
}: Readonly<{ state: CollectionStoryState; children: (props: ViewState) => ReactNode }>) {
  const [apiFetch] = useState(() => fixtureFetch(state) as unknown as TypedFetch);
  // Failing fast: the collection query retries, which would keep the page loading for seconds.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } }),
  );
  const [recording] = useState(() => createRecordingNavigation());
  const [profileLoaded, setProfileLoaded] = useState(false);
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  // The profile is in the cache before the view mounts, so its first render already is the state.
  useEffect(() => {
    void ensureProfileEntity(queryClient, apiFetch, PROFILE_URL, { name: "invoice" }).then(() =>
      setProfileLoaded(true),
    );
  }, [queryClient, apiFetch]);

  return (
    <div className="overflow-hidden rounded-md border" style={{ width: 1240, height: 820 }}>
      {profileLoaded && (
        <QueryClientProvider client={queryClient}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={contentFetch}
            profileUrl={PROFILE_URL}
          >
            <RecordingNavigationProvider recording={recording}>
              <Driver state={state}>{children}</Driver>
            </RecordingNavigationProvider>
          </NavigatorDataProvider>
        </QueryClientProvider>
      )}
    </div>
  );
}

type ViewState = Pick<
  React.ComponentProps<typeof EntityItemCollectionView>,
  "state" | "onStateChange"
>;

function Driver({
  state,
  children,
}: Readonly<{ state: CollectionStoryState; children: (props: ViewState) => ReactNode }>) {
  const [viewState, setViewState] = useState<CollectionViewState>({});
  const [ready, setReady] = useState(false);
  const fetching = useIsFetching();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // "paging": once the first page is in, ask for the next one, which never answers.
  const askNextPage = state === "paging" && mounted && fetching === 0 && !viewState.pageUrl;
  useEffect(() => {
    if (askNextPage) setViewState({ pageUrl: NEXT_PAGE_URL });
  }, [askNextPage]);

  // After the commit that shows the state.
  useEffect(() => {
    if (mounted && (state !== "paging" || viewState.pageUrl)) setReady(true);
  }, [mounted, state, viewState.pageUrl]);

  return (
    <div data-story-ready={ready || undefined} className="h-full">
      {children({ state: viewState, onStateChange: setViewState })}
    </div>
  );
}
