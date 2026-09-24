import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ContentPreviewFrame } from "./content-preview-frame";

const genericProblem: ProblemDisplayModel = {
  kind: "unknown",
  status: 500,
  title: "Internal Server Error",
  detail: "Something broke.",
};

describe("ContentPreviewFrame", () => {
  it("renders the drop zone and caption for noFile, with no Download or Retry button", () => {
    render(<ContentPreviewFrame state="noFile" onDownload={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText("No file")).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop a file/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("renders a skeleton and caption for loading, with Download but no Retry", () => {
    const onDownload = vi.fn();
    render(<ContentPreviewFrame state="loading" onDownload={onDownload} onRetry={vi.fn()} />);

    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    screen.getByRole("button", { name: "Download" }).click();
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("renders the preparing-preview caption distinctly from loading", () => {
    render(<ContentPreviewFrame state="preparingPreview" />);
    expect(screen.getByText("Preparing preview…")).toBeInTheDocument();
  });

  it("renders children for ready", () => {
    render(
      <ContentPreviewFrame state="ready">
        <div>the viewer</div>
      </ContentPreviewFrame>,
    );
    expect(screen.getByText("the viewer")).toBeInTheDocument();
  });

  it("renders the default message with Download but no Retry for previewUnavailable", () => {
    render(
      <ContentPreviewFrame state="previewUnavailable" onDownload={vi.fn()} onRetry={vi.fn()} />,
    );

    expect(screen.getByText(/Preview isn't available/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("renders a ProblemAlert instead of the default message when a problem is given", () => {
    render(<ContentPreviewFrame state="couldNotPrepare" problem={genericProblem} />);

    expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't prepare a preview/)).not.toBeInTheDocument();
  });

  it("renders Retry for couldNotPrepare, couldNotRetrieve and viewerFailure when supplied", () => {
    for (const state of ["couldNotPrepare", "couldNotRetrieve", "viewerFailure"] as const) {
      const { unmount } = render(<ContentPreviewFrame state={state} onRetry={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      unmount();
    }
  });

  it("never renders Retry for cannotDisplay or protected, even when onRetry is supplied", () => {
    for (const state of ["cannotDisplay", "protected"] as const) {
      const { unmount } = render(<ContentPreviewFrame state={state} onRetry={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("omits Retry entirely when onRetry is not supplied, even for a retryable state", () => {
    render(<ContentPreviewFrame state="viewerFailure" />);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("supports custom labels (FR-031)", () => {
    render(<ContentPreviewFrame state="noFile" labels={{ noFileCaption: "Geen bestand" }} />);
    expect(screen.getByText("Geen bestand")).toBeInTheDocument();
  });
});
