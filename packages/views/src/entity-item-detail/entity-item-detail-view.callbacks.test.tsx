/**
 * The view's wiring of the item feature's callbacks. `EntityItemContentFocusView` is stubbed to
 * buttons that fire the same callbacks the real feature does, so these tests isolate what the
 * view does with them: relation clicks go to the navigation object, relation problems open the
 * dialog, and "create" is handed to the host.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { RecordingNavigationProvider, createRecordingNavigation } from "../navigation/testing";
import { PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { EntityItemDetailView } from "./entity-item-detail-view";

vi.mock("@contentgrid/features/entity-item", () => ({
  EntityItemContentFocusView: (props: {
    toolbar?: unknown;
    onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
    onRelationItemCreateNew?: (entityName: string) => void;
    onMissingRelationTargetClick?: (url: string, field?: string) => void;
    onBlindRelationOverwriteClick?: (info: { existingItem?: string; newItem?: string }) => void;
    onRequiredRelationClick?: (affectedRelation: string) => void;
  }) => (
    <div>
      <button onClick={() => props.onRelationItemClick?.({ entityName: "company", itemId: "c-1" })}>
        relation-click
      </button>
      <button onClick={() => props.onRelationItemCreateNew?.("company")}>relation-create</button>
      <button onClick={() => props.onMissingRelationTargetClick?.("https://api.example.com/x")}>
        missing
      </button>
      <button
        onClick={() =>
          props.onBlindRelationOverwriteClick?.({ existingItem: "https://api.example.com/e" })
        }
      >
        blind
      </button>
      <button onClick={() => props.onRequiredRelationClick?.("owner")}>required</button>
      <span>{props.toolbar === false ? "toolbar-off" : "toolbar-on"}</span>
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

const target = { kind: "name", entityName: "customer", itemId: "cust-001" } as const;

describe("EntityItemDetailView — feature callbacks", () => {
  it("opens a clicked relation item through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText("relation-click"));

    expect(recording.calls).toEqual([{ method: "openItem", args: ["company", "c-1"] }]);
  });

  it("hands relation creation to the host", async () => {
    const { Wrapper } = setup();
    const onRelationItemCreateNew = vi.fn();
    render(
      <EntityItemDetailView target={target} onRelationItemCreateNew={onRelationItemCreateNew} />,
      {
        wrapper: Wrapper,
      },
    );

    await userEvent.click(await screen.findByText("relation-create"));

    expect(onRelationItemCreateNew).toHaveBeenCalledWith("company");
  });

  it.each([
    ["missing", "Linked item not found"],
    ["blind", "Relation already linked"],
    ["required", "Required relation"],
  ])("opens the problem dialog for %s", async (button, title) => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByText(button));
    expect(await screen.findByText(title)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it("tells the feature to draw no toolbar when hidden", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={target} hideToolbar />, { wrapper: Wrapper });
    expect(await screen.findByText("toolbar-off")).toBeInTheDocument();
  });
});
