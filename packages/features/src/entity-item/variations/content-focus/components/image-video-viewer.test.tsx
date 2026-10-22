import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageVideoViewer } from "./image-video-viewer";

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

describe("ImageVideoViewer", () => {
  it("switches an image between fitting the panel and its actual size", async () => {
    render(
      <ImageVideoViewer
        source={{ kind: "image", blob: new Blob(), etag: null }}
        filename="scan.png"
        onDownload={() => {}}
        onLoadError={() => {}}
      />,
    );
    const image = await screen.findByRole("img", { name: "scan.png" });
    expect(image).toHaveClass("max-w-full");

    await userEvent.click(screen.getByRole("button", { name: "Actual size" }));
    expect(image).toHaveClass("max-w-none");

    await userEvent.click(screen.getByRole("button", { name: "Fit to panel" }));
    expect(image).toHaveClass("max-w-full");
  });

  it("offers no size switch for a video", () => {
    render(
      <ImageVideoViewer
        source={{ kind: "video", blob: new Blob(), etag: null }}
        filename="clip.mp4"
        onDownload={() => {}}
        onLoadError={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "Actual size" })).not.toBeInTheDocument();
  });
});
