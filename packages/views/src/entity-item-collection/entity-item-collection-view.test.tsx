import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { EntityItem, TypedFetch } from "@contentgrid/navigator-data";
import { RecordingNavigationProvider, createRecordingNavigation } from "../navigation/testing";
import { PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { EntityItemCollectionView } from "./entity-item-collection-view";

// The collection feature has its own tests; here it is a stub that exposes what the view passes
// it and fires the callbacks the real one does.
vi.mock("@contentgrid/features/entity-item-collection", () => ({
  EntityItemCollectionSearchView: (props: {
    profile: { name: string };
    filters?: Record<string, string>;
    pageUrl?: string;
    onEntityItemClick?: (item: EntityItem) => void;
  }) => (
    <div>
      <div data-testid="profile">{props.profile.name}</div>
      <div data-testid="filters">{JSON.stringify(props.filters)}</div>
      <div data-testid="page-url">{props.pageUrl}</div>
      <button onClick={() => props.onEntityItemClick?.({ id: "cust-001" } as EntityItem)}>
        row
      </button>
    </div>
  ),
}));

function setup() {
  const apiFetch = createFixtureFetch().fetch as unknown as TypedFetch;
  const recording = createRecordingNavigation();
  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NavigatorDataProvider apiFetch={apiFetch} contentFetch={apiFetch} profileUrl={PROFILE_URL}>
          <RecordingNavigationProvider recording={recording}>
            {children}
          </RecordingNavigationProvider>
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, recording };
}

const target = { kind: "name", entityName: "customer" } as const;

describe("EntityItemCollectionView", () => {
  it("draws a Home / entity-name breadcrumb and a Create action, and places the feature", async () => {
    const { Wrapper } = setup();
    render(
      <EntityItemCollectionView
        target={target}
        filters={{ name: "Acme" }}
        pageUrl="https://api.example.com/customers?_cursor=2"
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByTestId("profile")).toHaveTextContent("customer");
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.getByText("Customers", { selector: "[aria-current='page']" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create customer" })).toBeInTheDocument();
    // The host's state props reach the feature unchanged.
    expect(screen.getByTestId("filters")).toHaveTextContent('{"name":"Acme"}');
    expect(screen.getByTestId("page-url")).toHaveTextContent("_cursor=2");
  });

  it("opens home, the create form and a clicked item through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView target={target} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("button", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: "Create customer" }));
    await userEvent.click(screen.getByText("row"));

    expect(recording.calls).toEqual([
      { method: "openHome", args: [] },
      { method: "openCreateItem", args: ["customer"] },
      { method: "openItem", args: ["customer", "cust-001"] },
    ]);
  });

  it("draws no breadcrumb or Create action when the toolbar is hidden", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView target={target} hideToolbar />, { wrapper: Wrapper });

    expect(await screen.findByTestId("profile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create customer" })).not.toBeInTheDocument();
  });

  it("shows the shared not-found state for an unknown entity", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView target={{ kind: "name", entityName: "nope" }} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText(/No entity profile named "nope"/)).toBeInTheDocument();
  });
});
