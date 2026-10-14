import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { createFixtureFetch } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemCollectionView } from "./entity-item-collection-view";

// The collection feature has its own tests; here it is a stub that exposes what the view passes
// it and fires the callbacks the real one does.
vi.mock("@contentgrid/features/entity-item-collection", () => ({
  EntityItemCollectionView: (props: {
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

function setup(options?: { readonly withCreateTemplate?: boolean }) {
  return createItemDetailTestHarness({ fetchFn: createFixtureFetch(options).fetch });
}

const entityName = "customer";

describe("EntityItemCollectionView", () => {
  it("draws a Home / entity-name breadcrumb and a Create action, and places the feature", async () => {
    const { Wrapper } = setup({ withCreateTemplate: true });
    render(
      <EntityItemCollectionView
        entityName={entityName}
        filters={{ name: "Acme" }}
        pageUrl="https://api.example.com/customers?_cursor=2"
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByTestId("profile")).toHaveTextContent("customer");
    // A deterministic `hrefFor` is always given by the recording navigation, so the Home crumb
    // renders as a real link, not a button (see `NavigationLink`).
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.getByText("Customers", { selector: "[aria-current='page']" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create customer" })).toBeInTheDocument();
    // The host's state props reach the feature unchanged.
    expect(screen.getByTestId("filters")).toHaveTextContent('{"name":"Acme"}');
    expect(screen.getByTestId("page-url")).toHaveTextContent("_cursor=2");
  });

  it("opens home, the create form and a clicked item through the navigation object", async () => {
    const { Wrapper, recording } = setup({ withCreateTemplate: true });
    render(<EntityItemCollectionView entityName={entityName} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("link", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: "Create customer" }));
    await userEvent.click(screen.getByText("row"));

    expect(recording.calls).toEqual([
      { method: "openHome", args: [] },
      { method: "openCreateItem", args: ["customer"] },
      { method: "openItem", args: ["customer", "cust-001"] },
    ]);
  });

  it("draws no breadcrumb or Create action when the toolbar is hidden", async () => {
    const { Wrapper } = setup({ withCreateTemplate: true });
    render(<EntityItemCollectionView entityName={entityName} toolbar={false} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByTestId("profile")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create customer" })).not.toBeInTheDocument();
  });

  it("hides the Create action when the entity's profile has no create template", async () => {
    // Default fixture: no create-form template, i.e. create is not permitted for this entity.
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName={entityName} />, { wrapper: Wrapper });

    expect(await screen.findByTestId("profile")).toBeInTheDocument();
    // The rest of the toolbar still renders — only the Create action is gated.
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create customer" })).not.toBeInTheDocument();
  });

  it("shows the shared not-found state for an unknown entity", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="nope" />, { wrapper: Wrapper });
    expect(await screen.findByText(/No entity profile named "nope"/)).toBeInTheDocument();
  });
});
