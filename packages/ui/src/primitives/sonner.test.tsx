import { act, render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

// next-themes useTheme is called inside Toaster; provide a minimal mock
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

describe("Toaster (sonner)", () => {
  it("applies the theme from useTheme to the rendered toaster element", async () => {
    const { container } = render(<Toaster />);

    // sonner only renders its `[data-sonner-toaster]` list once at least one
    // toast exists, so a toast must be triggered to reach the themed element.
    act(() => {
      toast("Hello");
    });

    await waitFor(() => {
      expect(container.querySelector("[data-sonner-toaster]")).toBeInTheDocument();
    });

    const toaster = container.querySelector("[data-sonner-toaster]");
    // Confirms the mocked useTheme() (theme: "light") is actually threaded
    // through to sonner's `theme` prop and reflected in the DOM.
    expect(toaster).toHaveAttribute("data-sonner-theme", "light");
  });
});
