import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileUpload } from "./file-upload";

const METADATA = { filename: "doc.pdf", mimetype: "application/pdf", length: 1000 };
const NEXT = new File(["x"], "next.pdf", { type: "application/pdf" });

describe("FileUpload — drop zone", () => {
  it("changes text to 'Drop the file here' on dragover and restores it on dragleave", () => {
    render(<FileUpload currentFileMetadata={null} onUpload={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone);
    expect(screen.getByText(/drop the file here/i)).toBeInTheDocument();
    fireEvent.dragLeave(zone);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("does not call onUpload when a drop has no files", () => {
    const onUpload = vi.fn();
    render(<FileUpload currentFileMetadata={null} onUpload={onUpload} />);
    fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
  });
});

describe("FileUpload — file card", () => {
  it("shows the file card with a Remove button instead of the drop zone when metadata is present", () => {
    render(<FileUpload currentFileMetadata={METADATA} onUpload={vi.fn()} />);
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove file" })).toBeInTheDocument();
  });

  it("replaces the file when another file is dropped onto the card, hinting it while dragged over", () => {
    const onUpload = vi.fn();
    render(<FileUpload currentFileMetadata={METADATA} onUpload={onUpload} />);
    fireEvent.dragOver(screen.getByText("doc.pdf"));
    expect(screen.getByText("Drop to replace the file")).toBeInTheDocument();
    fireEvent.drop(screen.getByText("doc.pdf"), { dataTransfer: { files: [NEXT] } });
    expect(onUpload).toHaveBeenCalledWith(NEXT);
  });
});

describe("FileUpload — status", () => {
  it("shows progress and a Cancel button, and ignores drops, while loading", () => {
    const onUpload = vi.fn();
    render(
      <FileUpload
        currentFileMetadata={METADATA}
        status={{ isLoading: true, error: null, progress: 42 }}
        onUpload={onUpload}
      />,
    );
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.queryByText("1 KB · application/pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel upload" })).toBeInTheDocument();
    fireEvent.drop(screen.getByText("doc.pdf"), { dataTransfer: { files: [NEXT] } });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("offers Retry and Discard once the upload has failed", () => {
    render(
      <FileUpload
        currentFileMetadata={METADATA}
        status={{ isLoading: false, error: new Error("failed") }}
        onUpload={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard upload" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("FileUpload — inline variant", () => {
  it("offers an Upload button instead of a drop zone when empty", () => {
    render(<FileUpload variant="inline" currentFileMetadata={null} onUpload={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload file" })).toBeInTheDocument();
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
  });

  it("offers Replace instead of Remove on a stored file", () => {
    render(<FileUpload variant="inline" currentFileMetadata={METADATA} onUpload={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Replace file" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument();
  });
});
