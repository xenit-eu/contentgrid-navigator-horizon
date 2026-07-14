import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { RelationConflictAlert } from "./relation-conflict-alert";

describe("RelationConflictAlert", () => {
  it("fires onBlindRelationOverwriteClick with the existing/new item info", async () => {
    const user = userEvent.setup();
    const onBlindRelationOverwriteClick = vi.fn();
    const model: Extract<ProblemDisplayModel, { kind: "blindRelationOverwrite" }> = {
      kind: "blindRelationOverwrite",
      status: 409,
      title: "Would overwrite",
      existingItem: "https://app/products/1",
      existingRelation: "https://app/orders/2/product",
      newItem: "https://app/products/2",
      newRelation: "https://app/orders/1/product",
    };
    render(
      <RelationConflictAlert
        model={model}
        onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View existing link" }));
    expect(onBlindRelationOverwriteClick).toHaveBeenCalledWith({
      existingItem: "https://app/products/1",
      existingRelation: "https://app/orders/2/product",
      newItem: "https://app/products/2",
      newRelation: "https://app/orders/1/product",
    });
  });

  it("does not render a button when onBlindRelationOverwriteClick is omitted", () => {
    const model: Extract<ProblemDisplayModel, { kind: "blindRelationOverwrite" }> = {
      kind: "blindRelationOverwrite",
      status: 409,
      title: "Would overwrite",
    };
    render(<RelationConflictAlert model={model} />);
    expect(screen.queryByRole("button", { name: "View existing link" })).not.toBeInTheDocument();
  });

  it("fires onRequiredRelationClick with the affected relation", async () => {
    const user = userEvent.setup();
    const onRequiredRelationClick = vi.fn();
    const model: Extract<ProblemDisplayModel, { kind: "requiredRelation" }> = {
      kind: "requiredRelation",
      status: 409,
      title: "Relation is required",
      affectedRelation: "https://app/orders/1/customer",
    };
    render(
      <RelationConflictAlert model={model} onRequiredRelationClick={onRequiredRelationClick} />,
    );
    await user.click(screen.getByRole("button", { name: "View affected relation" }));
    expect(onRequiredRelationClick).toHaveBeenCalledWith("https://app/orders/1/customer");
  });
});
