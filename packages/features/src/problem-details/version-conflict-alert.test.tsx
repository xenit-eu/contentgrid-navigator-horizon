import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { VersionConflictAlert } from "./version-conflict-alert";

describe("VersionConflictAlert", () => {
  const model: Extract<ProblemDisplayModel, { kind: "unsatisfiedVersion" }> = {
    kind: "unsatisfiedVersion",
    status: 412,
    title: "Version conflict",
    actualVersion: 'W/"2"',
  };

  it("tells the user the item has been updated by someone else", () => {
    render(<VersionConflictAlert model={model} />);
    expect(screen.getByText("This item has been updated by someone else")).toBeInTheDocument();
    expect(screen.getByText("Refresh to load the latest version.")).toBeInTheDocument();
  });

  it("fires onRetryClick when clicked", async () => {
    const user = userEvent.setup();
    const onRetryClick = vi.fn();
    render(<VersionConflictAlert model={model} onRetryClick={onRetryClick} />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRetryClick).toHaveBeenCalledOnce();
  });

  it("does not render a Refresh button when the callback is omitted", () => {
    render(<VersionConflictAlert model={model} />);
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });
});
