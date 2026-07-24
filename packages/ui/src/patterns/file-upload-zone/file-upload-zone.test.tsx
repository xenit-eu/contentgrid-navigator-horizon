import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FileUploadZone } from "./file-upload-zone";

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

describe("FileUploadZone — drop-zone view (no file)", () => {
  it("renders the drop-zone prompt text", () => {
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("renders a role=button for the drop zone", () => {
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("changes text to 'Drop the file here' on dragover", () => {
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone, { preventDefault: () => {} });
    expect(screen.getByText(/drop the file here/i)).toBeInTheDocument();
  });

  it("restores original text on dragleave", () => {
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("calls onFileChange when a file is dropped", () => {
    const onFileChange = vi.fn();
    render(<FileUploadZone file={null} onFileChange={onFileChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("test.pdf", "application/pdf");
    fireEvent.drop(zone, {
      dataTransfer: { files: [file] },
    });
    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it("does not call onFileChange when drop has no files", () => {
    const onFileChange = vi.fn();
    render(<FileUploadZone file={null} onFileChange={onFileChange} />);
    const zone = screen.getByRole("button");
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("opens the file input when the drop-zone button is clicked", async () => {
    const user = userEvent.setup();
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("activates the file input via native Enter key on the focused button", async () => {
    const user = userEvent.setup();
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("activates the file input via native Space key on the focused button", async () => {
    const user = userEvent.setup();
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("passes accept string to the hidden input", () => {
    render(
      <FileUploadZone
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
    render(<FileUploadZone file={null} onFileChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("");
  });

  it("calls onFileChange when a file is selected via input change", () => {
    const onFileChange = vi.fn();
    render(<FileUploadZone file={null} onFileChange={onFileChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("doc.txt", "text/plain");
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(onFileChange).toHaveBeenCalledWith(file);
  });
});

describe("FileUploadZone — file selected view", () => {
  it("renders file name", () => {
    const file = makeFile("report.pdf", "application/pdf", 2048);
    render(<FileUploadZone file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  it.each([
    { bytes: 0, expected: "0 B" },
    { bytes: 2048, expected: "2.0 KB" },
    { bytes: 1024 * 1024, expected: "1.0 MB" },
    { bytes: 1024 * 1024 * 1024, expected: "1.0 GB" },
  ])("formats a $bytes byte file size as $expected", ({ bytes, expected }) => {
    const file = makeFile("report.pdf", "application/pdf", 1);
    Object.defineProperty(file, "size", { value: bytes });
    render(<FileUploadZone file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders the MIME type badge", () => {
    const file = makeFile("report.pdf", "application/pdf");
    render(<FileUploadZone file={file} onFileChange={vi.fn()} />);
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  it("renders a remove button and calls onFileChange(null) when clicked", async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const file = makeFile("report.pdf", "application/pdf");
    render(<FileUploadZone file={file} onFileChange={onFileChange} />);
    await user.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it("renders image preview for image files", () => {
    const file = makeFile("photo.png", "image/png");
    render(<FileUploadZone file={file} onFileChange={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Preview" })).toBeInTheDocument();
  });

  it("does not render an image preview for non-image files", () => {
    const file = makeFile("doc.pdf", "application/pdf");
    render(<FileUploadZone file={file} onFileChange={vi.fn()} />);
    expect(screen.queryByRole("img", { name: "Preview" })).not.toBeInTheDocument();
  });
});
