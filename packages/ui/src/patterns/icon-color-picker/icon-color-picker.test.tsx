import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconColorPickerContent } from "./icon-color-picker";

describe("IconColorPickerContent", () => {
  it("renders both the icon grid and the color swatches with no trigger of its own", () => {
    render(
      <IconColorPickerContent
        icon={undefined}
        onIconChange={vi.fn()}
        color={undefined}
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Folder")).toBeInTheDocument();
    expect(screen.getByTitle("Green")).toBeInTheDocument();
  });

  it("calls onIconChange when an icon option is clicked", async () => {
    const user = userEvent.setup();
    const onIconChange = vi.fn();
    render(
      <IconColorPickerContent
        icon={undefined}
        onIconChange={onIconChange}
        color={undefined}
        onColorChange={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("Folder"));

    expect(onIconChange).toHaveBeenCalledWith("Folder");
  });

  it("calls onColorChange when a swatch is clicked", async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();
    render(
      <IconColorPickerContent
        icon={undefined}
        onIconChange={vi.fn()}
        color={undefined}
        onColorChange={onColorChange}
      />,
    );

    await user.click(screen.getByTitle("Green"));

    expect(onColorChange).toHaveBeenCalledWith("oklch(0.55 0.17 155)");
  });

  it("reflects the currently selected icon and color", () => {
    render(
      <IconColorPickerContent
        icon="Database"
        onIconChange={vi.fn()}
        color="oklch(0.55 0.17 155)"
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Database")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTitle("Green")).toHaveAttribute("aria-pressed", "true");
  });
});
