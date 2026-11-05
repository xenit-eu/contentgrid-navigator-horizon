import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { CreateItemAction } from "./create-item-action";

const profile = (createTemplate: unknown) =>
  ({ name: "customer", singularName: "customer", createTemplate }) as unknown as ProfileEntity;

describe("CreateItemAction", () => {
  it("opens the create page in a new tab through the navigation object", async () => {
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<CreateItemAction profileEntity={profile({})} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: "Create customer" }));

    expect(recording.calls).toEqual([
      { method: "openCreateItem", args: ["customer", { openInNewTab: true }] },
    ]);
  });

  it("draws nothing without a create form or a profile", () => {
    const { Wrapper } = createItemDetailTestHarness();
    const { rerender } = render(<CreateItemAction profileEntity={profile(undefined)} />, {
      wrapper: Wrapper,
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<CreateItemAction profileEntity={undefined} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
