import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationToManyRenderer } from "./relation-to-many-renderer";
import { relationToManyField } from "./test-fixtures";

describe("RelationToManyRenderer", () => {
  it("offers Link but no Clear when nothing is linked", () => {
    render(<RelationToManyRenderer {...relationToManyField({ onClear: vi.fn() })} />);
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("offers Clear once items are linked", () => {
    render(<RelationToManyRenderer {...relationToManyField({ count: 2, onClear: vi.fn() })} />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides the Link button when onLink is absent", () => {
    render(<RelationToManyRenderer {...relationToManyField({ onLink: undefined })} />);
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("hides all actions when readOnly", () => {
    render(
      <RelationToManyRenderer
        {...relationToManyField({ readOnly: true, count: 1, onClear: vi.fn() })}
      />,
    );
    expect(screen.queryByRole("button", { name: /^(link|clear)$/i })).not.toBeInTheDocument();
  });

  it("renders the error message when provided", () => {
    render(<RelationToManyRenderer {...relationToManyField({ error: "Required" })} />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
