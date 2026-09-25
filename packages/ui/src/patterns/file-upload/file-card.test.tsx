import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileCard } from "./file-card";

describe("FileCard", () => {
  it("falls back to 'Document' when the name is null", () => {
    render(<FileCard name={null} size={1000} type="application/pdf" actions={null} />);
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("shows the detail in place of the size and type line when given", () => {
    render(
      <FileCard
        name="doc.pdf"
        size={1000}
        type="application/pdf"
        actions={null}
        detail={<span>uploading</span>}
      />,
    );
    expect(screen.getByText("uploading")).toBeInTheDocument();
    expect(screen.queryByText("1 KB · application/pdf")).not.toBeInTheDocument();
  });

  it("shows only the size when the file has no type", () => {
    render(<FileCard name="notes" size={1000} type="" actions={null} />);
    expect(screen.getByText("1 KB")).toBeInTheDocument();
  });
});
