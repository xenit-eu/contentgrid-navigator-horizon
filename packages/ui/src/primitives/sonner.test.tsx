import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

// next-themes useTheme is called inside Toaster; provide a minimal mock
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

describe("Toaster (sonner)", () => {
  it("mounts without throwing", () => {
    const { container } = render(<Toaster />);
    expect(container).toBeInTheDocument();
  });
});
