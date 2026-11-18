import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./file-preview";

beforeEach(() => {
  // jsdom doesn't implement Blob URLs.
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // @ts-expect-error -- removing the jsdom-absent methods stubbed above.
  delete URL.createObjectURL;
  // @ts-expect-error -- see above.
  delete URL.revokeObjectURL;
});

describe("FilePreview", () => {
  it("shows a picked image as it is", async () => {
    render(<FilePreview file={new File(["png"], "scan.png", { type: "image/png" })} />);

    expect(await screen.findByRole("img", { name: "scan.png" })).toBeInTheDocument();
  });

  it("names the file type that has no preview", () => {
    render(<FilePreview file={new File(["a,b"], "rows.csv", { type: "text/csv" })} />);

    expect(screen.getByText("Preview isn't available for text/csv files.")).toBeInTheDocument();
  });

  it("says a PDF can't be displayed when it can no longer be read", async () => {
    const unreadablePdf = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });
    unreadablePdf.arrayBuffer = () => Promise.reject(new Error("The file could not be read."));

    render(<FilePreview file={unreadablePdf} />);

    expect(await screen.findByText("This file can't be displayed.")).toBeInTheDocument();
  });

  it("drops a load error when another file is picked", async () => {
    const { rerender } = render(
      <FilePreview file={new File(["broken"], "broken.png", { type: "image/png" })} />,
    );
    fireEvent.error(await screen.findByRole("img", { name: "broken.png" }));
    expect(
      screen.getByText("Your browser can't open this image. You can download it instead."),
    ).toBeInTheDocument();

    rerender(<FilePreview file={new File(["png"], "scan.png", { type: "image/png" })} />);

    expect(await screen.findByRole("img", { name: "scan.png" })).toBeInTheDocument();
  });
});
