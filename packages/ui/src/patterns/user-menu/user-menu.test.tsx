import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("renders the user's name and email", () => {
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
  });

  it("renders initials derived from the name", () => {
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("falls back to the first two letters for a single-word name", () => {
    render(<UserMenu name="Madonna" email="madonna@example.com" />);
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("does not show the menu until the trigger is clicked", () => {
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });

  it("shows a Log out item after clicking the trigger", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("calls onLogOut when Log out is selected", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    render(<UserMenu name="John Doe" email="john.doe@example.com" onLogOut={onLogOut} />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    await user.click(screen.getByText("Log out"));
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("shows a Settings item above Log out after clicking the trigger", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));

    const items = screen.getAllByRole("menuitem");
    const labels = items.map((item) => item.textContent);
    expect(labels.indexOf("Settings")).toBeLessThan(labels.indexOf("Log out"));
  });

  it("calls onSettingsClick when Settings is selected", async () => {
    const user = userEvent.setup();
    const onSettingsClick = vi.fn();
    render(
      <UserMenu name="John Doe" email="john.doe@example.com" onSettingsClick={onSettingsClick} />,
    );
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    await user.click(screen.getByText("Settings"));
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });
});
