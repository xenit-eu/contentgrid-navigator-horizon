import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ENTITY_COLOR_THEMES, ThemeSelector } from "./theme-selector";

describe("ThemeSelector", () => {
  it("does not show the theme list until the trigger is clicked", () => {
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={undefined}
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(screen.queryByRole("radio", { name: "Vibrant" })).not.toBeInTheDocument();
  });

  it("renders every theme by name after opening", async () => {
    const user = userEvent.setup();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={undefined}
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));

    for (const theme of ENTITY_COLOR_THEMES) {
      expect(screen.getByRole("radio", { name: theme.name })).toBeInTheDocument();
    }
  });

  it("disables Apply when no theme is selected", async () => {
    const user = userEvent.setup();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={undefined}
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));

    expect(screen.getByRole("button", { name: "Apply theme" })).toBeDisabled();
  });

  it("enables Apply once a theme is selected", async () => {
    const user = userEvent.setup();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value="Vibrant"
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));

    expect(screen.getByRole("button", { name: "Apply theme" })).toBeEnabled();
  });

  it("marks the selected theme's radio as checked", async () => {
    const user = userEvent.setup();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value="Warm"
        onValueChange={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));

    expect(screen.getByRole("radio", { name: "Warm" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Vibrant" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onValueChange with the theme's name when clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value={undefined}
        onValueChange={onValueChange}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(screen.getByRole("radio", { name: "Cool" }));

    expect(onValueChange).toHaveBeenCalledWith("Cool");
  });

  it("calls onApply and closes the popover when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value="Vibrant"
        onValueChange={vi.fn()}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(screen.getByRole("button", { name: "Apply theme" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("radio", { name: "Vibrant" })).not.toBeInTheDocument();
  });

  it("respects an explicit applyDisabled override even when a theme is selected", async () => {
    const user = userEvent.setup();
    render(
      <ThemeSelector
        themes={ENTITY_COLOR_THEMES}
        value="Vibrant"
        onValueChange={vi.fn()}
        onApply={vi.fn()}
        applyDisabled
      />,
    );

    await user.click(screen.getByRole("button", { name: "Theme" }));

    expect(screen.getByRole("button", { name: "Apply theme" })).toBeDisabled();
  });
});
