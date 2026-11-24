import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordRowMenu, type RecordRowMenuItem } from "./record-row-menu";

function renderMenu(items: readonly RecordRowMenuItem[], onRowClick = vi.fn()) {
  render(
    <div onClick={onRowClick}>
      <RecordRowMenu label="Actions for INV-1" items={items} />
    </div>,
  );
  return onRowClick;
}

const open = { key: "open", label: "Open", onSelect: vi.fn() };

describe("RecordRowMenu", () => {
  it("renders nothing without items", () => {
    renderMenu([]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is one button named by its label, with no menu until it is used", () => {
    renderMenu([open]);
    expect(screen.getByRole("button", { name: "Actions for INV-1" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens its items without reaching the row, and the trigger is bordered while open", async () => {
    const user = userEvent.setup();
    const onRowClick = renderMenu([open, { ...open, key: "x", label: "Other" }]);
    const trigger = screen.getByRole("button", { name: "Actions for INV-1" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("data-state", "open");
    expect(trigger).toHaveClass("data-[state=open]:border-border");
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Open", "Other"]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("calls onSelect when an item is chosen, without reaching the row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRowClick = renderMenu([{ ...open, onSelect }]);
    await user.click(screen.getByRole("button", { name: "Actions for INV-1" }));
    await user.click(screen.getByRole("menuitem", { name: "Open" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("draws a separator above an item that asks for one, and shows a destructive item as such", async () => {
    const user = userEvent.setup();
    renderMenu([
      open,
      { key: "del", label: "Delete…", onSelect: vi.fn(), destructive: true, separatorBefore: true },
    ]);
    await user.click(screen.getByRole("button", { name: "Actions for INV-1" }));

    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete…" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  describe("with a confirming item", () => {
    const confirming = (onSelect = vi.fn()): RecordRowMenuItem => ({
      key: "del",
      label: "Delete…",
      onSelect,
      destructive: true,
      confirm: { title: "Delete item", description: "Sure?", actionLabel: "Delete" },
    });

    it("asks first and calls onSelect only once confirmed, never reaching the row", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onRowClick = renderMenu([confirming(onSelect)]);
      await user.click(screen.getByRole("button", { name: "Actions for INV-1" }));
      await user.click(screen.getByRole("menuitem", { name: "Delete…" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText("Delete item")).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      expect(onSelect).toHaveBeenCalledOnce();
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it("does nothing when the dialog is cancelled", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderMenu([confirming(onSelect)]);
      await user.click(screen.getByRole("button", { name: "Actions for INV-1" }));
      await user.click(screen.getByRole("menuitem", { name: "Delete…" }));
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
      );

      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
