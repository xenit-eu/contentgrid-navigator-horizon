import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileRenderer } from "./file-renderer";
import { fileField } from "./test-fixtures";

describe("FileRenderer", () => {
  it("disables the dropzone when read-only", () => {
    render(
      <FileRenderer {...fileField({ readOnly: true })} value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Attachment" })).toBeDisabled();
  });

  it("keeps the picked file visible but not removable when read-only", () => {
    const file = new File(["content"], "invoice.pdf", { type: "application/pdf" });
    render(<FileRenderer {...fileField({ readOnly: true })} value={file} onChange={vi.fn()} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove file/i })).not.toBeInTheDocument();
  });
});
