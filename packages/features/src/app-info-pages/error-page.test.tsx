import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ErrorPage } from "../app-info-pages/error-page";

describe("ErrorPage", () => {
  it("renders a generic error message when no model is provided", () => {
    render(<ErrorPage />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();
  });

  it("renders the problem detail when a model is provided", () => {
    const model: ProblemDisplayModel = {
      kind: "unknown",
      status: 500,
      title: "Internal server error",
      detail: "something broke",
    };

    render(<ErrorPage model={model} />);

    expect(screen.getByText("Internal server error")).toBeInTheDocument();
    expect(screen.getByText("something broke")).toBeInTheDocument();
    // The generic fallback message should not be shown alongside the model.
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorPage />);

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("fires onRetry when the retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorPage onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses a custom retry label when provided", () => {
    render(<ErrorPage onRetry={vi.fn()} retryLabel="Reload" />);

    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
