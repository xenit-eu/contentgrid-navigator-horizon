import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

const meta = {
  title: "Patterns/UnsavedChangesDialog",
  component: UnsavedChangesDialog,
  tags: ["autodocs"],
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  // axe-no-contrast: confirmation dialog portal composites into axe background calc.
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    open: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onConfirm: fn(),
    onCancel: fn(),
  },
};

export const ConfirmInteraction: Story = {
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    open: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    await userEvent.click(within(dialog!).getByRole("button", { name: /^leave$/i }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const CancelInteraction: Story = {
  tags: ["no-visual-test", "axe-no-contrast"],
  args: {
    open: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
  play: async ({ args }) => {
    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = within(document.body).getByRole("alertdialog");
      expect(dialog).toBeVisible();
    });

    await userEvent.click(within(dialog!).getByRole("button", { name: /^stay$/i }));
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
  },
};
