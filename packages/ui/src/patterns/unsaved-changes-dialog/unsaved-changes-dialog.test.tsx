import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

describe("UnsavedChangesDialog", () => {
  it("renders nothing when closed", () => {
    render(<UnsavedChangesDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders the confirmation when open", () => {
    render(<UnsavedChangesDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByText("Leave without saving?")).toBeVisible();
  });
});
