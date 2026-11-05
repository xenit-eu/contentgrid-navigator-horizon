import { type ReactNode, useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { createContentFixtureFetch } from "../test-fixtures/content-item";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { EntityItemPreviewView } from "./entity-item-preview-view";
import { preloadEntityItemPreview } from "./preload";

const neverSettles = (() => new Promise<Response>(() => {})) as unknown as TypedFetch;

/**
 * Preloads the item (unless `hang` is set, for the loading story), then mounts the view in a
 * fixed-size box (ADR-009): the view fills the box and never sizes itself to the window.
 * `aria-busy` covers the preload, so the visual harness's `async-content` wait has no gap between
 * the empty root and the view.
 */
function PreviewStoryHarness({
  entityName,
  itemId,
  hang = false,
  children,
}: Readonly<{ entityName: string; itemId: string; hang?: boolean; children: ReactNode }>) {
  const [fixture] = useState(() => createContentFixtureFetch());
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const [ready, setReady] = useState(hang);
  const apiFetch = hang ? neverSettles : (fixture.fetch as unknown as TypedFetch);
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  useEffect(() => {
    if (hang) return;
    void preloadEntityItemPreview(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      entityName,
      itemId,
    ).then(() => setReady(true));
  }, [queryClient, apiFetch, entityName, itemId, hang]);

  return (
    <div
      aria-busy={!ready}
      className="overflow-hidden rounded-md border"
      style={{ width: 560, height: 560 }}
    >
      {ready && (
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
      )}
    </div>
  );
}

const meta = {
  title: "Views/EntityItemPreviewView",
  component: EntityItemPreviewView,
  tags: ["autodocs", "async-content"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A read-only preview of one item, for a pane next to a list: its content when it holds a file, " +
          "otherwise its attributes. No edit, delete or relation controls; Open goes to the full detail view " +
          "and Close (shown when `onClose` is given) is reported to the host.",
      },
    },
  },
  render: (args) => (
    <PreviewStoryHarness entityName={args.entityName} itemId={args.itemId}>
      <EntityItemPreviewView {...args} />
    </PreviewStoryHarness>
  ),
} satisfies Meta<typeof EntityItemPreviewView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The item holds a file: its content is previewed. */
export const WithContent: Story = {
  args: { entityName: "document", itemId: "doc-001", onClose: () => {} },
};

/** The item's content attribute holds no file: its attributes are shown. */
export const AttributesOnly: Story = {
  args: { entityName: "document", itemId: "doc-002", onClose: () => {} },
};

/** An entity without content attributes. */
export const NoContentAttributes: Story = {
  args: { entityName: "customer", itemId: "cust-001" },
};

export const ToolbarHidden: Story = {
  args: { entityName: "customer", itemId: "cust-001", toolbar: false },
};

/** Nothing has answered yet; the loading state is permanently busy, so no `async-content` wait. */
export const Loading: Story = {
  tags: ["!async-content"],
  args: { entityName: "customer", itemId: "cust-001" },
  render: (args) => (
    <PreviewStoryHarness entityName={args.entityName} itemId={args.itemId} hang>
      <EntityItemPreviewView {...args} />
    </PreviewStoryHarness>
  ),
};

export const NotFound: Story = {
  args: { entityName: "unknown", itemId: "1" },
};
