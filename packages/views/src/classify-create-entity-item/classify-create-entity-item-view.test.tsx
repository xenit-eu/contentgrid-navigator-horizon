import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChildNavigationProvider } from "../navigation";
import { createCollectionFixtureFetch } from "../test-fixtures/collection";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { ClassifyCreateEntityItemView } from "./classify-create-entity-item-view";

function renderView(goBack?: () => boolean) {
  const fixture = createCollectionFixtureFetch({ creatable: true });
  const harness = createItemDetailTestHarness({ fetchFn: fixture.fetch });
  const view = goBack ? (
    <ChildNavigationProvider overrides={{ goBack }}>
      <ClassifyCreateEntityItemView />
    </ChildNavigationProvider>
  ) : (
    <ClassifyCreateEntityItemView />
  );
  render(view, { wrapper: harness.Wrapper });
  return harness;
}

describe("ClassifyCreateEntityItemView", () => {
  it("opens the chosen entity's create form on Continue", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("radio", { name: /Customer/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(recording.calls).toEqual([{ method: "openCreateItem", args: ["customer"] }]);
  });

  it("goes back on Cancel", async () => {
    const goBack = vi.fn(() => true);
    const { recording } = renderView(goBack);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(goBack).toHaveBeenCalledOnce();
    expect(recording.calls).toEqual([]);
  });

  it("goes home on Cancel when there is no earlier page", async () => {
    const { recording } = renderView();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    // The recording fake has no history, so goBack() returns false and the view falls back.
    expect(recording.calls).toEqual([
      { method: "goBack", args: [] },
      { method: "openHome", args: [] },
    ]);
  });
});
