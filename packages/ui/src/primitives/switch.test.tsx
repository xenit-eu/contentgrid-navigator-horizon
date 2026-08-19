import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders unchecked by default", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "unchecked");
  });

  it("renders checked when defaultChecked is set", () => {
    render(<Switch aria-label="Toggle" defaultChecked />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });

  it("toggles state on click", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" />);
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);
    expect(switchEl).toHaveAttribute("data-state", "checked");
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle" disabled />);
    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
  });
});
