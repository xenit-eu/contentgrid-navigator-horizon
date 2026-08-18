import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingPage } from "./loading-page";

describe("LoadingPage", () => {
  it("exposes an accessible busy status", () => {
    render(<LoadingPage />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("shows a default loading label when no message is provided", () => {
    render(<LoadingPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a custom message when provided", () => {
    render(<LoadingPage message="Fetching profile" />);

    expect(screen.getByText("Fetching profile")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
