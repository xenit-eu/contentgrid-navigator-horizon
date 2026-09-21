import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { useDownloadContent, useUploadContent } from "@contentgrid/navigator-data";
import { ContentAttributeRenderer } from "./content-attribute-renderer";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useUploadContent: vi.fn(), useDownloadContent: vi.fn() };
});

const mutate = vi.fn();
const cancel = vi.fn();
const reset = vi.fn();
const downloadMutate = vi.fn();

function mockUploadState(state: Partial<{ progress: number; isError: boolean }> = {}) {
  vi.mocked(useUploadContent).mockReturnValue({
    mutate,
    cancel,
    reset,
    progress: state.progress ?? 0,
    isError: state.isError ?? false,
  } as unknown as ReturnType<typeof useUploadContent>);
}

vi.mocked(useDownloadContent).mockReturnValue({
  mutate: downloadMutate,
  isPending: false,
} as unknown as ReturnType<typeof useDownloadContent>);

function makeEntityItem(
  canUploadContent: boolean,
  canDownloadContent: boolean = false,
): EntityItem {
  return {
    canUploadContent: () => canUploadContent,
    canDownloadContent: () => canDownloadContent,
  } as unknown as EntityItem;
}

describe("ContentAttributeRenderer", () => {
  it("renders an empty attribute value when metadata is null", () => {
    render(<ContentAttributeRenderer metadata={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("ignores the icon when metadata is null", () => {
    render(<ContentAttributeRenderer metadata={null} icon={<span data-testid="icon" />} />);
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
  });

  it("falls back to 'Untitled' when filename is null", () => {
    render(<ContentAttributeRenderer metadata={{ filename: null, length: 512 }} />);
    expect(screen.getByText("Untitled · 512 B")).toBeInTheDocument();
  });

  it("formats sizes under 1 MB in KB", () => {
    render(<ContentAttributeRenderer metadata={{ filename: "invoice.pdf", length: 2048 }} />);
    expect(screen.getByText("invoice.pdf · 2.0 KB")).toBeInTheDocument();
  });

  it("renders the icon alongside the value when provided", () => {
    render(
      <ContentAttributeRenderer
        metadata={{ filename: "invoice.pdf", length: 1024 }}
        icon={<span data-testid="icon" />}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("invoice.pdf · 1.0 KB")).toBeInTheDocument();
  });

  describe("replace upload affordance", () => {
    afterEach(() => {
      mutate.mockReset();
      cancel.mockReset();
      reset.mockReset();
      downloadMutate.mockReset();
    });

    it("renders no Replace button when entityItem/attributeName are omitted", () => {
      mockUploadState();
      render(<ContentAttributeRenderer metadata={{ filename: "invoice.pdf", length: 1024 }} />);
      expect(screen.queryByRole("button", { name: "Replace file" })).not.toBeInTheDocument();
    });

    it("renders no Replace button when upload is not ABAC-permitted", () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(false)}
          attributeName="file"
        />,
      );
      expect(screen.queryByRole("button", { name: "Replace file" })).not.toBeInTheDocument();
      expect(useUploadContent).not.toHaveBeenCalled();
    });

    it("uploads the picked file when permitted", async () => {
      mockUploadState();
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true)}
          attributeName="file"
        />,
      );

      const file = new File(["x"], "replacement.pdf", { type: "application/pdf" });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, file);

      expect(mutate).toHaveBeenCalledWith({ file });
    });

    it("shows upload progress once a file is picked", async () => {
      mockUploadState({ progress: 42 });
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true)}
          attributeName="file"
        />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], "replacement.pdf"));

      expect(screen.getByRole("progressbar")).toHaveValue(42);
      expect(screen.getByRole("button", { name: "Cancel upload" })).toBeInTheDocument();
    });

    it("shows Retry instead of Cancel once the upload errors, and re-mutates the same file on retry", async () => {
      mockUploadState({ isError: true });
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true)}
          attributeName="file"
        />,
      );
      const file = new File(["x"], "replacement.pdf");
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, file);
      mutate.mockClear();

      expect(screen.queryByRole("button", { name: "Cancel upload" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(mutate).toHaveBeenCalledWith({ file });
    });

    it("lets the user dismiss a failed upload back to the plain metadata view, without retrying", async () => {
      mockUploadState({ isError: true });
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true)}
          attributeName="file"
        />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], "replacement.pdf"));
      mutate.mockClear();

      await userEvent.click(screen.getByRole("button", { name: "Remove file" }));

      expect(mutate).not.toHaveBeenCalled();
      expect(reset).toHaveBeenCalledOnce();
      expect(screen.getByText("invoice.pdf · 1.0 KB")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replace file" })).toBeInTheDocument();
    });

    it("returns to the plain metadata view when the upload is cancelled", async () => {
      mockUploadState();
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true)}
          attributeName="file"
        />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], "replacement.pdf"));

      await userEvent.click(screen.getByRole("button", { name: "Cancel upload" }));

      expect(cancel).toHaveBeenCalledOnce();
      expect(screen.getByText("invoice.pdf · 1.0 KB")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replace file" })).toBeInTheDocument();
    });
  });

  describe("download affordance", () => {
    afterEach(() => {
      mutate.mockReset();
      cancel.mockReset();
      reset.mockReset();
      downloadMutate.mockReset();
    });

    it("renders no Download button when entityItem/attributeName are omitted", () => {
      mockUploadState();
      render(<ContentAttributeRenderer metadata={{ filename: "invoice.pdf", length: 1024 }} />);
      expect(screen.queryByRole("button", { name: "Download file" })).not.toBeInTheDocument();
    });

    it("renders no Download button when download is not ABAC-permitted", () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(false, false)}
          attributeName="file"
        />,
      );
      expect(screen.queryByRole("button", { name: "Download file" })).not.toBeInTheDocument();
    });

    it("renders no Download button when metadata is null, even if download is permitted", () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer
          metadata={null}
          entityItem={makeEntityItem(false, true)}
          attributeName="file"
        />,
      );
      expect(screen.queryByRole("button", { name: "Download file" })).not.toBeInTheDocument();
    });

    it("renders a Download button alongside the read-only metadata when upload isn't permitted but download is", async () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(false, true)}
          attributeName="file"
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Download file" }));
      expect(downloadMutate).toHaveBeenCalledOnce();
    });

    it("renders a Download button alongside Replace when both are permitted", async () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true, true)}
          attributeName="file"
        />,
      );
      expect(screen.getByRole("button", { name: "Replace file" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Download file" }));
      expect(downloadMutate).toHaveBeenCalledOnce();
    });

    it("hides the Download button once a replacement file is picked", async () => {
      mockUploadState();
      const { container } = render(
        <ContentAttributeRenderer
          metadata={{ filename: "invoice.pdf", length: 1024 }}
          entityItem={makeEntityItem(true, true)}
          attributeName="file"
        />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, new File(["x"], "replacement.pdf"));

      expect(screen.queryByRole("button", { name: "Download file" })).not.toBeInTheDocument();
    });
  });
});
