import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProvenanceTag } from "./provenance-tag";

describe("ProvenanceTag", () => {
  it("renders default 'Extracted' label when kind=extracted and no label", () => {
    render(<ProvenanceTag kind="extracted" />);
    expect(screen.getByText("Extracted")).toBeInTheDocument();
  });

  it("renders custom label when label is provided (kind=extracted)", () => {
    render(<ProvenanceTag kind="extracted" label="AI-extracted" />);
    expect(screen.getByText("AI-extracted")).toBeInTheDocument();
  });

  it("renders default 'Modified' label when kind=modified and no label", () => {
    render(<ProvenanceTag kind="modified" />);
    expect(screen.getByText("Modified")).toBeInTheDocument();
  });

  it("renders custom label when label is provided (kind=modified)", () => {
    render(<ProvenanceTag kind="modified" label="Manually edited" />);
    expect(screen.getByText("Manually edited")).toBeInTheDocument();
  });

  it("renders the Sparkle icon for extracted kind", () => {
    const { container } = render(<ProvenanceTag kind="extracted" />);
    expect(
      container.querySelector('[data-testid="provenance-icon-extracted"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="provenance-icon-modified"]'),
    ).not.toBeInTheDocument();
  });

  it("renders the PencilSimple icon for modified kind", () => {
    const { container } = render(<ProvenanceTag kind="modified" />);
    expect(container.querySelector('[data-testid="provenance-icon-modified"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="provenance-icon-extracted"]'),
    ).not.toBeInTheDocument();
  });

  it("defaults to extracted when kind is omitted", () => {
    render(<ProvenanceTag />);
    expect(screen.getByText("Extracted")).toBeInTheDocument();
  });

  it("renders data-slot=provenance-tag attribute", () => {
    const { container } = render(<ProvenanceTag />);
    expect(container.querySelector("[data-slot='provenance-tag']")).toBeInTheDocument();
  });
});
