import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInGate } from "./sign-in-gate";

describe("SignInGate", () => {
  it("renders a Sign in button", () => {
    render(<SignInGate onSignIn={() => {}} />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls onSignIn when the button is clicked", async () => {
    const onSignIn = vi.fn();
    render(<SignInGate onSignIn={onSignIn} />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});
