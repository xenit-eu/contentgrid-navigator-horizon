import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordRowConfirmAction } from "./record-row-confirm-action";

function renderAction(onConfirm = vi.fn()) {
  render(
    <RecordRowConfirmAction
      label="Unlink"
      icon={null}
      title="Unlink product"
      description="Remove the link?"
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("RecordRowConfirmAction", () => {
  it("calls onConfirm only once the dialog is confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = renderAction();
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Unlink" }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not call onConfirm when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = renderAction();
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
