import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileRenderer } from "./file-renderer";
import { fileField } from "./test-fixtures";

describe("FileRenderer", () => {
  it("offers no dropzone or file picker when read-only", () => {
    render(
      <FileRenderer {...fileField({ readOnly: true })} value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });
});
