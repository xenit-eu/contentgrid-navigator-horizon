import type { Meta, StoryObj } from "@storybook/react";
import { ImageVideoViewer } from "./image-video-viewer";

/** A 480×320 image: a blue field with a white box. */
const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">' +
  '<rect width="480" height="320" fill="#1d4ed8"/>' +
  '<rect x="160" y="100" width="160" height="120" fill="#ffffff"/></svg>';

const meta = {
  title: "Features/EntityItemContentFocus/ImageVideoViewer",
  component: ImageVideoViewer,
  tags: ["autodocs"],
  render: (args) => (
    <div style={{ height: 500, width: 700 }}>
      <ImageVideoViewer {...args} />
    </div>
  ),
} satisfies Meta<typeof ImageVideoViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Image: Story = {
  args: {
    source: { kind: "image", blob: new Blob([SAMPLE_SVG], { type: "image/svg+xml" }), etag: null },
    filename: "sample.svg",
    toolbarStart: <span className="text-sm">File</span>,
    onDownload: () => {},
    onLoadError: () => {},
  },
};
