import { type ReactNode, useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { RecordingNavigationProvider, createRecordingNavigation } from "../navigation/testing";
import { PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import type { ViewTarget } from "../types";
import { EntityItemDetailView } from "./entity-item-detail-view";
import { preload } from "./preload";

const target: ViewTarget = { kind: "name", entityName: "customer", itemId: "cust-001" };

/**
 * Preloads the target, then mounts the view in a fixed-size box (ADR-009): the view fills the box
 * and never sizes itself to the window. `aria-busy` covers the preload, so the visual harness's
 * `async-content` wait has no gap between the empty root and the view.
 */
function ItemDetailStoryHarness({
  children,
}: Readonly<{ children: (target: ViewTarget) => ReactNode }>) {
  const [fixture] = useState(() => createFixtureFetch());
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const [ready, setReady] = useState(false);
  const apiFetch = fixture.fetch as unknown as TypedFetch;

  useEffect(() => {
    void preload({ queryClient, apiFetch, profileUrl: PROFILE_URL }, target, undefined).then(() =>
      setReady(true),
    );
  }, [queryClient, apiFetch]);

  return (
    <div
      aria-busy={!ready}
      className="overflow-hidden rounded-md border"
      style={{ width: 960, height: 560 }}
    >
      {ready && (
        <QueryClientProvider client={queryClient}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={apiFetch}
            profileUrl={PROFILE_URL}
          >
            <RecordingNavigationProvider recording={recording}>
              {children(target)}
            </RecordingNavigationProvider>
          </NavigatorDataProvider>
        </QueryClientProvider>
      )}
    </div>
  );
}

const meta = {
  title: "Views/EntityItemDetailView",
  component: EntityItemDetailView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: (args) => (
    <ItemDetailStoryHarness>
      {(resolvedTarget) => <EntityItemDetailView {...args} target={resolvedTarget} />}
    </ItemDetailStoryHarness>
  ),
} satisfies Meta<typeof EntityItemDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { target },
};

export const ToolbarHidden: Story = {
  args: { target, hideToolbar: true },
};
