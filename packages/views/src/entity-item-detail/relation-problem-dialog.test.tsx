import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationProblemDialog } from "./relation-problem-dialog";

describe("RelationProblemDialog", () => {
  it("renders nothing while there is no problem", () => {
    render(<RelationProblemDialog state={null} onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the missing relation target with its field and url", () => {
    render(
      <RelationProblemDialog
        state={{ kind: "missingRelationTarget", url: "https://api.example.com/x", field: "owner" }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("Linked item not found")).toBeInTheDocument();
    expect(screen.getByText(/owner/)).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/x")).toBeInTheDocument();
  });

  it("shows the missing relation target without a field", () => {
    render(
      <RelationProblemDialog
        state={{ kind: "missingRelationTarget", url: "https://api.example.com/x" }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByText(/Field/)).not.toBeInTheDocument();
  });

  it("shows both items of a blind relation overwrite", () => {
    render(
      <RelationProblemDialog
        state={{
          kind: "blindRelationOverwrite",
          existingItem: "https://api.example.com/existing",
          newItem: "https://api.example.com/new",
        }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("Relation already linked")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/existing")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/new")).toBeInTheDocument();
  });

  it("omits the items a blind relation overwrite did not report", () => {
    render(
      <RelationProblemDialog state={{ kind: "blindRelationOverwrite" }} onOpenChange={() => {}} />,
    );
    expect(screen.queryByText("Currently linked item")).not.toBeInTheDocument();
    expect(screen.queryByText("Item you tried to link")).not.toBeInTheDocument();
  });

  it("shows the affected relation of a required relation", () => {
    render(
      <RelationProblemDialog
        state={{ kind: "requiredRelation", affectedRelation: "owner" }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("Required relation")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("reports closing", async () => {
    const onOpenChange = vi.fn();
    render(
      <RelationProblemDialog
        state={{ kind: "requiredRelation", affectedRelation: "owner" }}
        onOpenChange={onOpenChange}
      />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
