import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "./not-found-page";

describe("NotFoundPage", () => {
  it("renders a not-found message", () => {
    render(<NotFoundPage onBackHome={vi.fn()} />);

    expect(screen.getByText("This page doesn't exist.")).toBeInTheDocument();
  });

  it("calls onBackHome when the back-to-home button is clicked", async () => {
    const onBackHome = vi.fn();
    render(<NotFoundPage onBackHome={onBackHome} />);

    await userEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});
