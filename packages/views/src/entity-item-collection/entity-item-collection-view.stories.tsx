import { type ReactNode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEntityDisplayPreferencesStore } from "@contentgrid/features/preferences";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { createCollectionFixtureFetch } from "../test-fixtures/collection";
import { CollectionStateStoryHarness } from "../test-fixtures/collection-state-story-harness";
import { createInvoiceCollectionFixtureFetch } from "../test-fixtures/invoice-collection";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { EntityItemCollectionView } from "./entity-item-collection-view";

type FixtureOptions = Parameters<typeof createCollectionFixtureFetch>[0];

/**
 * Mounts the view on the collection fixture (empty unless `fixtureOptions` says otherwise) in a
 * fixed-size box (ADR-009): the view fills the box and never sizes itself to the window. The
 * view's loading pages are `aria-busy`, so the visual harness's `async-content` wait covers the
 * profile and collection fetches.
 */
function CollectionStoryHarness({
  children,
  fixtureOptions = { empty: true },
  invoices = false,
  height = 560,
  width = 960,
}: Readonly<{
  children: ReactNode;
  fixtureOptions?: FixtureOptions;
  /** Answers the invoice fixture (text, number, date, boolean and file columns) instead. */
  invoices?: boolean;
  height?: number;
  width?: number;
}>) {
  const [fixture] = useState(() =>
    invoices
      ? { fetch: createInvoiceCollectionFixtureFetch() }
      : createCollectionFixtureFetch(fixtureOptions),
  );
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const apiFetch = fixture.fetch as unknown as TypedFetch;
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  return (
    <div className="overflow-hidden rounded-md border" style={{ width, height }}>
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
    </div>
  );
}

const meta = {
  title: "Views/EntityItemCollectionView",
  component: EntityItemCollectionView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: (args) => (
    <CollectionStoryHarness>
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
} satisfies Meta<typeof EntityItemCollectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { entityName: "customer" },
};

/** An empty collection the user may not create in: the same screen, without the button. */
export const EmptyReadOnly: Story = {
  args: { entityName: "customer" },
  render: (args) => (
    <CollectionStoryHarness fixtureOptions={{ empty: true, creatable: false }}>
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** Renders the view on a collection with items; the title shows the entity name and its count. */
export const Titled: Story = {
  args: { entityName: "customer" },
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{ unfilteredPage: { size: 2, total_items_exact: 1284 } }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** A filter is active: the filtered count in the pill and the unfiltered total under the title. */
export const Filtered: Story = {
  args: {
    entityName: "customer",
    state: { filters: { "name~prefix": "acme" } },
    onStateChange: () => {},
  },
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{
        unfilteredPage: { size: 2, total_items_exact: 1284 },
        filteredPage: { size: 2, total_items_exact: 37 },
      }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** The filters match nothing: the notice takes the table's place, the title says 0 of 1 284. */
export const NoMatch: Story = {
  args: Filtered.args,
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{
        unfilteredPage: { size: 2, total_items_exact: 1284 },
        filteredPage: { size: 0, total_items_exact: 0 },
        filteredEmpty: true,
      }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** The API only estimates the total: the pill and the "Filtered from" line say "about". */
export const EstimatedCount: Story = {
  args: Filtered.args,
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{
        unfilteredPage: { size: 2, total_items_estimate: 1204 },
        filteredPage: { size: 2, total_items_estimate: 40 },
      }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** More rows than fit: the page scrolls, not the table, and the header row sticks to its top. */
export const ManyRows: Story = {
  args: { entityName: "customer" },
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{ itemCount: 30, unfilteredPage: { size: 30, total_items_exact: 30 } }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/**
 * The invoice stories show the columns of board 02: the title cell with its file tile and file
 * line (also "No file"), booleans as True / False / Not set pills, a file column with a dash when
 * empty, right-aligned numbers, the two-arrow icon on sortable headers, and Previous / Next at the
 * right of the paging bar.
 */
function InvoiceStoryHarness({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <CollectionStoryHarness invoices height={820} width={1240}>
      {children}
    </CollectionStoryHarness>
  );
}

/** The title shows the invoice reference; the display settings pick the other columns. */
function useInvoiceDisplaySettings() {
  useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
    nameAttribute: "reference",
    visibleColumns: ["amount", "issued", "paid", "annex"],
  });
}

export const Invoices: Story = {
  args: { entityName: "invoice" },
  beforeEach: useInvoiceDisplaySettings,
  render: (args) => (
    <InvoiceStoryHarness>
      <EntityItemCollectionView {...args} />
    </InvoiceStoryHarness>
  ),
};

/** Sorted by amount ascending: its arrow and label are in the accent colour. */
export const InvoicesSortedByAmount: Story = {
  args: { entityName: "invoice", state: { sort: "amount,asc" }, onStateChange: () => {} },
  beforeEach: useInvoiceDisplaySettings,
  render: (args) => (
    <InvoiceStoryHarness>
      <EntityItemCollectionView {...args} />
    </InvoiceStoryHarness>
  ),
};

/** Design columns of board 25: Invoice, Supplier, Amount, Issue date. */
function useStateStoryColumns() {
  useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
    nameAttribute: "reference",
    visibleColumns: ["supplier", "amount", "issued"],
  });
}

/**
 * First load: the title with a skeleton count pill and the column headers show at once, over
 * placeholder rows in the table's shape. The page request never answers.
 */
export const Loading: Story = {
  args: { entityName: "invoice" },
  tags: ["!async-content", "pending-state"],
  beforeEach: useStateStoryColumns,
  render: (args) => (
    <CollectionStateStoryHarness state="loading">
      {() => <EntityItemCollectionView {...args} />}
    </CollectionStateStoryHarness>
  ),
};

/** Paging: the previous page's rows stay, dimmed, until the next page arrives (it never does here). */
export const PagingDimmed: Story = {
  args: { entityName: "invoice" },
  // The design dims the rows to 0.45, which axe reads as low contrast.
  tags: ["!async-content", "pending-state", "axe-no-contrast"],
  beforeEach: useStateStoryColumns,
  render: (args) => (
    <CollectionStateStoryHarness state="paging">
      {(viewState) => <EntityItemCollectionView {...args} {...viewState} />}
    </CollectionStateStoryHarness>
  ),
};

/** The page request got no answer (a network error): the title stays, under it a red alert with Try again. */
export const FailedToLoad: Story = {
  args: { entityName: "invoice" },
  beforeEach: useStateStoryColumns,
  render: (args) => (
    <CollectionStateStoryHarness state="failed">
      {() => <EntityItemCollectionView {...args} />}
    </CollectionStateStoryHarness>
  ),
};

/** The server answered with a problem: the alert shows the problem's detail instead. */
export const FailedToLoadWithProblem: Story = {
  args: { entityName: "invoice" },
  beforeEach: useStateStoryColumns,
  render: (args) => (
    <CollectionStateStoryHarness state="problem">
      {() => <EntityItemCollectionView {...args} />}
    </CollectionStateStoryHarness>
  ),
};
