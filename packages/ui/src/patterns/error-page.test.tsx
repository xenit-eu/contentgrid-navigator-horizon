import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorPage } from "./error-page";

describe("ErrorPage", () => {
  it("renders the error message", () => {
    render(<ErrorPage message="Failed to load invoices" />);
    expect(screen.getByText("Failed to load invoices")).toBeInTheDocument();
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorPage message="Failed to load invoices" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a retry button with the given label and calls onRetry when clicked", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorPage message="Failed to load invoices" onRetry={onRetry} retryLabel="Try again" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("defaults the retry label to Retry", () => {
    render(<ErrorPage message="Failed to load invoices" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
