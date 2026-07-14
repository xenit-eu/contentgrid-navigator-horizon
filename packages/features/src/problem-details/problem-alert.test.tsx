import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ProblemAlert } from "./problem-alert";

describe("ProblemAlert (dispatcher)", () => {
  it("dispatches a validation model to ValidationAlert and forwards its callbacks", async () => {
    const user = userEvent.setup();
    const onConflictingItemClick = vi.fn();
    const model: ProblemDisplayModel = {
      kind: "validation",
      status: 400,
      title: "Validation error",
      fields: [
        {
          kind: "duplicate",
          field: "product_code",
          message: "Duplicate",
          conflictingItem: "https://app/products/1",
        },
      ],
    };
    render(<ProblemAlert model={model} onConflictingItemClick={onConflictingItemClick} />);
    await user.click(screen.getByRole("button", { name: "View conflicting item" }));
    expect(onConflictingItemClick).toHaveBeenCalledWith("https://app/products/1", "product_code");
  });

  it("dispatches blindRelationOverwrite/requiredRelation models to RelationConflictAlert", async () => {
    const user = userEvent.setup();
    const onRequiredRelationClick = vi.fn();
    const model: ProblemDisplayModel = {
      kind: "requiredRelation",
      status: 409,
      title: "Relation is required",
      affectedRelation: "https://app/orders/1/customer",
    };
    render(<ProblemAlert model={model} onRequiredRelationClick={onRequiredRelationClick} />);
    await user.click(screen.getByRole("button", { name: "View affected relation" }));
    expect(onRequiredRelationClick).toHaveBeenCalledWith("https://app/orders/1/customer");
  });

  it("dispatches an unsatisfiedVersion model to VersionConflictAlert", async () => {
    const user = userEvent.setup();
    const onRetryClick = vi.fn();
    const model: ProblemDisplayModel = {
      kind: "unsatisfiedVersion",
      status: 412,
      title: "Version conflict",
    };
    render(<ProblemAlert model={model} onRetryClick={onRetryClick} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryClick).toHaveBeenCalledOnce();
  });

  it("dispatches every other kind to GenericProblemAlert", () => {
    const model: ProblemDisplayModel = {
      kind: "unknown",
      status: 403,
      title: "Forbidden",
      detail: "no access",
    };
    render(<ProblemAlert model={model} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
    expect(screen.getByText("no access")).toBeInTheDocument();
  });
});
