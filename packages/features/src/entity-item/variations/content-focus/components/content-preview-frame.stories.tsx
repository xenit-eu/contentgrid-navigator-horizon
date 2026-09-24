import type { Meta, StoryObj } from "@storybook/react";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ContentPreviewFrame } from "./content-preview-frame";

const meta = {
  title: "Features/EntityItemContentFocus/ContentPreviewFrame",
  component: ContentPreviewFrame,
  tags: ["autodocs"],
  render: (args) => (
    <div style={{ height: 500, width: 700 }}>
      <ContentPreviewFrame {...args} />
    </div>
  ),
} satisfies Meta<typeof ContentPreviewFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

const timeoutProblem: ProblemDisplayModel = {
  kind: "unknown",
  title: "Something went wrong",
  detail: "The rendition service didn't finish converting this file in time.",
};

const downloadFailureProblem: ProblemDisplayModel = {
  kind: "unknown",
  status: 500,
  title: "Internal Server Error",
  detail: "The server encountered an unexpected condition.",
};

export const NoFile: Story = {
  args: { state: "noFile" },
};

export const Loading: Story = {
  args: { state: "loading", onDownload: () => {} },
};

export const PreparingPreview: Story = {
  args: { state: "preparingPreview", onDownload: () => {} },
};

export const Ready: Story = {
  args: {
    state: "ready",
    children: (
      <div className="flex h-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        PDF viewer goes here
      </div>
    ),
  },
};

export const PreviewUnavailable: Story = {
  args: { state: "previewUnavailable", onDownload: () => {} },
};

/**
 * The rendition path's own flavor of `previewUnavailable` (spec 002-pdf-viewer US2): either no
 * `renditionUri` is configured, or the rendition service itself reported `invalid-conversion` for
 * this file. `ContentPreviewPanel` names the actual mimetype in the message via a `labels`
 * override (`content-preview-panel.tsx`'s `buildPreviewUnavailableMessage`) rather than the
 * generic "this file type" default shown by the plain `PreviewUnavailable` story above.
 */
export const PreviewUnavailableRendition: Story = {
  args: {
    state: "previewUnavailable",
    onDownload: () => {},
    labels: { previewUnavailableMessage: "Preview isn't available for image/x-tiff files." },
  },
};

export const CouldNotPrepare: Story = {
  args: {
    state: "couldNotPrepare",
    problem: timeoutProblem,
    onDownload: () => {},
    onRetry: () => {},
  },
};

export const CouldNotRetrieve: Story = {
  args: {
    state: "couldNotRetrieve",
    problem: downloadFailureProblem,
    onDownload: () => {},
    onRetry: () => {},
  },
};

export const CannotDisplay: Story = {
  args: { state: "cannotDisplay", onDownload: () => {} },
};

export const Protected: Story = {
  args: { state: "protected", onDownload: () => {} },
};

export const ViewerFailure: Story = {
  args: {
    state: "viewerFailure",
    onDownload: () => {},
    onRetry: () => {},
  },
};
