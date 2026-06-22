import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./banner";

describe("Banner", () => {
  it("renders message text", () => {
    render(<Banner text="This is a notice" />);
    expect(screen.getByText("This is a notice")).toBeInTheDocument();
  });

  it("renders with info tone (default) — has status role", () => {
    render(<Banner text="Info message" tone="info" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with edit tone — has status role", () => {
    render(<Banner text="Edit mode" tone="edit" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with warning tone — has alert role", () => {
    render(<Banner text="Warning!" tone="warning" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders SVG icon for each tone", () => {
    const tones = ["info", "edit", "warning"] as const;
    for (const tone of tones) {
      const { container, unmount } = render(<Banner text="Test" tone={tone} />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders custom icon when icon prop is provided", () => {
    render(<Banner text="Custom" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("uses info tone as default when tone is omitted", () => {
    render(<Banner text="Default" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has data-slot=banner attribute", () => {
    const { container } = render(<Banner text="Test" />);
    expect(container.querySelector("[data-slot='banner']")).toBeInTheDocument();
  });
});
