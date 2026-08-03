import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ContentUploadField } from "./content-upload-field";

// jsdom doesn't implement URL.createObjectURL; stub it out
beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:mock-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn(),
  });
});

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(["x".repeat(size)], name, { type });
  return file;
}

describe("ContentUploadField — drop-zone view (no file)", () => {
  it("renders the drop-zone prompt text", () => {
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("renders a role=button for the drop zone", () => {
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("changes text to 'Drop the file here' on dragover", () => {
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone, { preventDefault: () => {} });
    expect(screen.getByText(/drop the file here/i)).toBeInTheDocument();
  });

  it("restores original text on dragleave", () => {
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("calls onFileChange when a file is dropped", () => {
    const onFileChange = vi.fn();
    render(<ContentUploadField file={null} onFileChange={onFileChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("test.pdf", "application/pdf");
    fireEvent.drop(zone, {
      dataTransfer: { files: [file] },
    });
    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it("does not call onFileChange when drop has no files", () => {
    const onFileChange = vi.fn();
    render(<ContentUploadField file={null} onFileChange={onFileChange} />);
    const zone = screen.getByRole("button");
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("opens the file input when the drop-zone button is clicked", async () => {
    const user = userEvent.setup();
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("activates the file input via native Enter key on the focused button", async () => {
    const user = userEvent.setup();
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("activates the file input via native Space key on the focused button", async () => {
    const user = userEvent.setup();
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("passes accept string to the hidden input", () => {
    render(
      <ContentUploadField
        file={null}
        onFileChange={vi.fn()}
        accept={{ "application/pdf": [".pdf"], "image/png": [".png"] }}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain("application/pdf");
    expect(input.accept).toContain("image/png");
  });

  it("no accept attribute when accept prop is omitted", () => {
    render(<ContentUploadField file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("");
  });

  it("calls onFileChange when a file is selected via input change", () => {
    const onFileChange = vi.fn();
    render(<ContentUploadField file={null} onFileChange={onFileChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("doc.txt", "text/plain");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(onFileChange).toHaveBeenCalledWith(file);
  });
});

describe("ContentUploadField — file selected view", () => {
  it("renders file name", () => {
    const file = makeFile("report.pdf", "application/pdf", 2048);
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  it("renders formatted file size", () => {
    const file = makeFile("report.pdf", "application/pdf", 2048);
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("renders the MIME type badge", () => {
    const file = makeFile("report.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  it("renders a remove button and calls onFileChange(null) when clicked", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const file = makeFile("report.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={onFileChange} />);
    await user.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it("renders image preview for image files", () => {
    const file = makeFile("photo.png", "image/png");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Preview" })).toBeInTheDocument();
  });

  it("does not render an image preview for non-image files", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.queryByRole("img", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("renders '0 B' for a file with size 0", () => {
    const file = makeFile("empty.txt", "text/plain", 0);
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("0 B")).toBeInTheDocument();
  });

  it("renders GB formatted size for large files", () => {
    const file = makeFile("big.bin", "application/octet-stream", 1);
    Object.defineProperty(file, "size", { value: 1024 * 1024 * 1024 });
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("1.0 GB")).toBeInTheDocument();
  });

  it("renders MB formatted size", () => {
    const file = makeFile("medium.bin", "application/octet-stream", 1024 * 1024);
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
  });
});

describe("ContentUploadField — upload progress", () => {
  it("renders a progress bar when uploadProgress is defined", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} uploadProgress={40} />);
    expect(screen.getByRole("progressbar", { name: /upload progress/i })).toBeInTheDocument();
  });

  it("sets the current progress percentage as the progress value", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} uploadProgress={65} />);
    // Native <progress> maps `value` to the accessible aria-valuenow — it isn't
    // reflected as a literal DOM attribute, so assert on the element property instead.
    expect(screen.getByRole("progressbar", { name: /upload progress/i })).toHaveValue(65);
  });

  it("does not render a progress bar when uploadProgress is undefined", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("hides the progress bar when uploadError is true", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={vi.fn()}
        uploadProgress={50}
        uploadError={true}
      />,
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("ContentUploadField — cancel button", () => {
  it("renders a Cancel button when onCancelUpload is provided", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} onCancelUpload={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel upload/i })).toBeInTheDocument();
  });

  it("calls onCancelUpload when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancelUpload = vi.fn();
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField file={file} onFileChange={vi.fn()} onCancelUpload={onCancelUpload} />,
    );
    await user.click(screen.getByRole("button", { name: /cancel upload/i }));
    expect(onCancelUpload).toHaveBeenCalledOnce();
  });

  it("hides the Remove button when onCancelUpload is provided", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} onCancelUpload={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /remove file/i })).not.toBeInTheDocument();
  });
});

describe("ContentUploadField — error and retry", () => {
  it("shows 'Upload failed' text when uploadError is true", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<ContentUploadField file={file} onFileChange={vi.fn()} uploadError={true} />);
    expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
  });

  it("renders a Retry button when uploadError and onRetryUpload are both provided", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={vi.fn()}
        uploadError={true}
        onRetryUpload={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetryUpload when Retry is clicked", async () => {
    const user = userEvent.setup();
    const onRetryUpload = vi.fn();
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={vi.fn()}
        uploadError={true}
        onRetryUpload={onRetryUpload}
      />,
    );
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetryUpload).toHaveBeenCalledOnce();
  });

  it("does not render a Retry button when uploadError is false", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={vi.fn()}
        uploadError={false}
        onRetryUpload={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("still shows the Remove button in error+retry state — retry isn't a dead end", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={vi.fn()}
        uploadError={true}
        onRetryUpload={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /remove file/i })).toBeInTheDocument();
  });

  it("calls onFileChange with null when Remove is clicked in error+retry state", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const file = makeFile("doc.pdf", "application/pdf");
    render(
      <ContentUploadField
        file={file}
        onFileChange={onFileChange}
        uploadError={true}
        onRetryUpload={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });
});
