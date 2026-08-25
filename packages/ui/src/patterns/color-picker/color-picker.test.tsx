import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker } from "./color-picker";

describe("ColorPicker", () => {
  it("shows a placeholder label when no color is selected", () => {
    render(<ColorPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Choose color" })).toBeInTheDocument();
  });

  it("labels the trigger with the selected color value", () => {
    render(<ColorPicker value="oklch(0.55 0.17 155)" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Color: oklch(0.55 0.17 155)" })).toBeInTheDocument();
  });

  it("does not show the swatch grid until the trigger is clicked", () => {
    render(<ColorPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByTitle("Green")).not.toBeInTheDocument();
  });

  it("calls onChange with the swatch value when a preset is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /choose color/i }));
    await user.click(screen.getByTitle("Green"));

    expect(onChange).toHaveBeenCalledWith("oklch(0.55 0.17 155)");
  });

  it("calls onChange as the custom color input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /choose color/i }));
    await user.type(screen.getByLabelText("Custom color value"), "#f");

    expect(onChange).toHaveBeenCalledWith("#f");
  });

  it("renders custom trigger content instead of the default swatch when children are given", () => {
    render(
      <ColorPicker value={undefined} onChange={vi.fn()}>
        <span data-testid="custom-trigger-icon" />
      </ColorPicker>,
    );

    expect(screen.getByTestId("custom-trigger-icon")).toBeInTheDocument();
    expect(screen.queryByText("Choose color")).not.toBeInTheDocument();
  });

  it("still opens the swatch grid when using a custom trigger", async () => {
    const user = userEvent.setup();
    render(
      <ColorPicker value={undefined} onChange={vi.fn()}>
        <span data-testid="custom-trigger-icon" />
      </ColorPicker>,
    );

    await user.click(screen.getByRole("button", { name: "Choose color" }));

    expect(screen.getByTitle("Green")).toBeInTheDocument();
  });
});
