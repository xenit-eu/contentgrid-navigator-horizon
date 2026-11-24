import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useEntityDisplayPreferencesStore } from "@contentgrid/features/preferences";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { type ItemTemplate, PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { EntityItemDetailView } from "./entity-item-detail-view";
import { preloadEntityItemDetail } from "./preload";

const entityName = "customer";
const itemId = "cust-001";

const StoryContent = createContext<{ content: ReactNode; onMount: () => void }>({
  content: null,
  onMount: () => {},
});

function StoryPage() {
  const { content, onMount } = useContext(StoryContent);
  useEffect(onMount, [onMount]);
  return content;
}

/**
 * The edit form guards unsaved changes through the router, so the story needs one: a memory router
 * whose only page is the story. `onMount` fires once the page has rendered.
 */
function StoryRouter({
  children,
  onMount,
}: Readonly<{ children: ReactNode; onMount: () => void }>) {
  const [router] = useState(() => {
    const root = createRootRoute();
    const index = createRoute({ getParentRoute: () => root, path: "/", component: StoryPage });
    return createRouter({
      routeTree: root.addChildren([index]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  return (
    <StoryContent value={{ content: children, onMount }}>
      <RouterProvider router={router} />
    </StoryContent>
  );
}

interface ItemDetailStoryHarnessProps {
  readonly children: ReactNode;
  /** The item's templates: Edit shows with `default`, Delete with `delete`. */
  readonly templates?: readonly ItemTemplate[];
  /** `"columns"` renders the side-by-side layout instead of the stacked sections. */
  readonly itemLayout?: "columns";
  /** Clicks the toolbar's Edit once it shows, so the story captures edit mode. */
  readonly startEditing?: boolean;
}

/**
 * Preloads the item, then mounts the view in a fixed-size box (ADR-009): the view fills the box
 * and never sizes itself to the window. `aria-busy` covers the preload (and, with `startEditing`,
 * the click on Edit), so the visual harness's `async-content` wait has no gap between the empty
 * root and the final state.
 */
function ItemDetailStoryHarness({
  children,
  templates,
  itemLayout,
  startEditing = false,
}: Readonly<ItemDetailStoryHarnessProps>) {
  const [fixture] = useState(() => createFixtureFetch({ templates }));
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const [ready, setReady] = useState(false);
  const [routed, setRouted] = useState(false);
  const [editing, setEditing] = useState(!startEditing);
  const box = useRef<HTMLDivElement>(null);
  const apiFetch = fixture.fetch as unknown as TypedFetch;
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  useEffect(() => {
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, entityName, { itemLayout });
    return () =>
      useEntityDisplayPreferencesStore
        .getState()
        .setOverride(PROFILE_URL, entityName, { itemLayout: undefined });
  }, [itemLayout]);

  useEffect(() => {
    void preloadEntityItemDetail(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      entityName,
      itemId,
    ).then(() => setReady(true));
  }, [queryClient, apiFetch]);

  useEffect(() => {
    if (!ready || !routed || editing) return;
    const timer = setInterval(() => {
      const edit = [...(box.current?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === "Edit",
      );
      if (edit) {
        edit.click();
        setEditing(true);
      }
    }, 20);
    return () => clearInterval(timer);
  }, [ready, routed, editing]);

  return (
    <div
      ref={box}
      aria-busy={!ready || !routed || !editing}
      className="overflow-hidden rounded-md border"
      style={{ width: 960, height: 560 }}
    >
      <StoryRouter onMount={() => setRouted(true)}>
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
      </StoryRouter>
    </div>
  );
}

const meta = {
  title: "Views/EntityItemDetailView",
  component: EntityItemDetailView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: (args, { parameters }) => (
    <ItemDetailStoryHarness {...parameters.harness}>
      <EntityItemDetailView {...args} />
    </ItemDetailStoryHarness>
  ),
} satisfies Meta<typeof EntityItemDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The item allows neither Edit nor Delete: the breadcrumb bar has no actions. */
export const Default: Story = {
  args: { entityName, itemId },
};

/** The item allows both: Edit and Delete sit side by side in the breadcrumb bar. */
export const EditAndDelete: Story = {
  args: { entityName, itemId },
  parameters: { harness: { templates: ["default", "delete"] } },
};

export const EditOnly: Story = {
  args: { entityName, itemId },
  parameters: { harness: { templates: ["default"] } },
};

export const DeleteOnly: Story = {
  args: { entityName, itemId },
  parameters: { harness: { templates: ["delete"] } },
};

/** Edit mode: the button reads "Cancel edit" and Delete is out of the way. */
export const Editing: Story = {
  args: { entityName, itemId },
  parameters: { harness: { templates: ["default", "delete"], startEditing: true } },
};

/** The side-by-side layout keeps the same actions in the same place. */
export const SideBySideEditAndDelete: Story = {
  args: { entityName, itemId },
  parameters: { harness: { templates: ["default", "delete"], itemLayout: "columns" } },
};

export const ToolbarHidden: Story = {
  args: { entityName, itemId, toolbar: false },
};
