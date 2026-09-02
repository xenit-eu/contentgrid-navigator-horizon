import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentAttributeRenderer } from "./content-attribute-renderer";

describe("ContentAttributeRenderer", () => {
  it("renders an empty attribute value when metadata is null", () => {
    render(<ContentAttributeRenderer metadata={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("ignores the icon when metadata is null", () => {
    render(<ContentAttributeRenderer metadata={null} icon={<span data-testid="icon" />} />);
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
  });

  it("falls back to 'Untitled' when filename is null", () => {
    render(<ContentAttributeRenderer metadata={{ filename: null, length: 512 }} />);
    expect(screen.getByText("Untitled · 0.5 kB")).toBeInTheDocument();
  });

  it("formats sizes under 1 MB in kB", () => {
    render(<ContentAttributeRenderer metadata={{ filename: "invoice.pdf", length: 2048 }} />);
    expect(screen.getByText("invoice.pdf · 2.0 kB")).toBeInTheDocument();
  });

  it("formats sizes at or above 1 MB in MB", () => {
    render(
      <ContentAttributeRenderer metadata={{ filename: "photo.jpg", length: 5 * 1024 * 1024 }} />,
    );
    expect(screen.getByText("photo.jpg · 5.0 MB")).toBeInTheDocument();
  });

  it("formats sizes at or above 1 GB in GB", () => {
    render(
      <ContentAttributeRenderer
        metadata={{ filename: "archive.zip", length: 2.5 * 1024 * 1024 * 1024 }}
      />,
    );
    expect(screen.getByText("archive.zip · 2.5 GB")).toBeInTheDocument();
  });

  it("does not grow a TB tier past GB", () => {
    render(
      <ContentAttributeRenderer
        metadata={{ filename: "huge.bin", length: 5000 * 1024 * 1024 * 1024 }}
      />,
    );
    expect(screen.getByText("huge.bin · 5000.0 GB")).toBeInTheDocument();
  });

  it("renders the icon alongside the value when provided", () => {
    render(
      <ContentAttributeRenderer
        metadata={{ filename: "invoice.pdf", length: 1024 }}
        icon={<span data-testid="icon" />}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("invoice.pdf · 1.0 kB")).toBeInTheDocument();
  });
});
