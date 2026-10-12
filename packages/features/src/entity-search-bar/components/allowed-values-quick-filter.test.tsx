import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WithOpenState } from "../test-utils";
import type { AllowedValuesQuickFilter as Model } from "../util/build-quick-filters";
import { AllowedValuesQuickFilter } from "./allowed-values-quick-filter";

function model(value?: string): Model {
  return {
    kind: "allowed-values",
    groupKey: "status",
    label: "Status",
    param: "status",
    paramNames: ["status"],
    options: [
      { value: "draft", label: "Draft" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
    value,
    isActive: value !== undefined,
    tone: value === undefined ? "idle" : "active",
  };
}

describe("AllowedValuesQuickFilter", () => {
  it("narrows the allowed values as the user types and applies the picked one", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <WithOpenState>
        {(openState) => (
          <AllowedValuesQuickFilter
            {...openState}
            quickFilter={model()}
            onApply={onApply}
            onClear={vi.fn()}
          />
        )}
      </WithOpenState>,
    );

    await user.click(screen.getByRole("button", { name: "Status" }));
    await user.keyboard("app");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Approved"]);

    await user.click(screen.getByRole("option", { name: "Approved" }));
    expect(onApply).toHaveBeenCalledWith("status", { status: "approved" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the active value and an ×", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <AllowedValuesQuickFilter
        open={false}
        onOpenChange={vi.fn()}
        quickFilter={model("approved")}
        onApply={vi.fn()}
        onClear={onClear}
      />,
    );
    expect(screen.getByRole("button", { name: "Status: Approved" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='filter-button']")).toHaveAttribute(
      "data-tone",
      "active",
    );
    await user.click(screen.getByRole("button", { name: "Clear Status filter" }));
    expect(onClear).toHaveBeenCalledWith("status");
  });
});
