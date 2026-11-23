import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("shows only the avatar in the trigger: no name, e-mail or caret", () => {
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    const trigger = screen.getByRole("button", { name: /john doe/i });
    expect(trigger).toHaveTextContent(/^JD$/);
    expect(trigger.querySelector("svg")).not.toBeInTheDocument();
    expect(trigger).toHaveClass("bg-white/15", "rounded-lg");
    expect(screen.queryByText("john.doe@example.com")).not.toBeInTheDocument();
  });

  it("opens with an account block holding the avatar, name and e-mail", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toHaveClass("truncate");
    expect(screen.getAllByText("JD")).toHaveLength(2); // trigger + account block
  });

  it("sizes the menu 264px wide with 34px items", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    expect(screen.getByRole("menu")).toHaveClass("w-[264px]", "rounded-[10px]", "p-1.5");
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item).toHaveClass("h-[34px]", "text-[13.5px]");
    }
  });

  it("marks Settings as current only when a settings page is open", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserMenu name="John Doe" email="john.doe@example.com" />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).not.toHaveAttribute("aria-current");
    unmount();

    render(<UserMenu name="John Doe" email="john.doe@example.com" settingsCurrent />);
    await user.click(screen.getByRole("button", { name: /john doe/i }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
