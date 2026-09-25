import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EntityItemAttributeContent,
  ProblemDetailError,
  useUploadContent,
} from "@contentgrid/navigator-data";
import { makeEntityItem } from "@contentgrid/navigator-data/test-fixtures/hal/entity-item";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { ContentAttributeRenderer } from "./content-attribute-renderer";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useUploadContent: vi.fn() };
});

const DUMMY_LINK = {} as ConstructorParameters<typeof EntityItemAttributeContent>[2];
const METADATA = { filename: "invoice.pdf", mimetype: "application/pdf", length: 1000 };
const REPLACEMENT = new File(["x"], "replacement.pdf", { type: "application/pdf" });
const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";
const ITEM_URL = "https://api.example.com/invoices/inv-1";
const PROFILE = makeProfileEntity({ _links: {} });

function invoiceItem(contentLinks: readonly { href: string; name: string }[]) {
  return makeEntityItem(
    {
      id: "inv-1",
      file: METADATA,
      _links: { self: { href: ITEM_URL }, [CG_CONTENT_REL]: contentLinks },
    },
    PROFILE,
  );
}

const ENTITY_ITEM = invoiceItem([{ href: `${ITEM_URL}/file`, name: "file" }]);

const mutate = vi.fn();
const cancel = vi.fn();

function contentAttribute(metadata: EntityItemAttributeContent["metadata"] = METADATA) {
  return new EntityItemAttributeContent("file", metadata, DUMMY_LINK);
}

function mockUploadState(
  state: Partial<{ isPending: boolean; progress: number; error: Error | null }> = {},
) {
  const inFlight = state.isPending || state.error;
  vi.mocked(useUploadContent).mockReturnValue({
    mutate,
    cancel,
    isPending: state.isPending ?? false,
    progress: state.progress ?? 0,
    error: state.error ?? null,
    variables: inFlight ? { file: REPLACEMENT } : undefined,
  } as unknown as ReturnType<typeof useUploadContent>);
}

afterEach(() => {
  mutate.mockReset();
  cancel.mockReset();
});

describe("ContentAttributeRenderer", () => {
  it("renders an empty attribute value when metadata is null", () => {
    render(<ContentAttributeRenderer attribute={contentAttribute(null)} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("falls back to 'Document' when filename is null", () => {
    render(
      <ContentAttributeRenderer attribute={contentAttribute({ ...METADATA, filename: null })} />,
    );
    expect(screen.getByText("Document · 1 KB")).toBeInTheDocument();
  });

  describe("replace upload affordance", () => {
    it("renders read-only, without a Replace button, when the item has no cg:content link for the attribute", () => {
      mockUploadState();
      render(
        <ContentAttributeRenderer attribute={contentAttribute()} entityItem={invoiceItem([])} />,
      );
      expect(screen.getByText("invoice.pdf · 1 KB")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Replace file" })).not.toBeInTheDocument();
    });

    it("shows the stored file with a Replace button while no upload is in flight", () => {
      mockUploadState();
      render(<ContentAttributeRenderer attribute={contentAttribute()} entityItem={ENTITY_ITEM} />);
      expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replace file" })).toBeInTheDocument();
    });

    it("uploads a file dropped onto the stored file", () => {
      mockUploadState();
      render(<ContentAttributeRenderer attribute={contentAttribute()} entityItem={ENTITY_ITEM} />);
      fireEvent.drop(screen.getByText("invoice.pdf"), { dataTransfer: { files: [REPLACEMENT] } });
      expect(mutate).toHaveBeenCalledWith({ file: REPLACEMENT });
    });

    it("shows the picked file in place of the stored one while pending, and cancels on clear", async () => {
      mockUploadState({ isPending: true, progress: 42 });
      render(<ContentAttributeRenderer attribute={contentAttribute()} entityItem={ENTITY_ITEM} />);
      expect(screen.getByText("replacement.pdf")).toBeInTheDocument();
      expect(screen.queryByText("invoice.pdf")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
      expect(cancel).toHaveBeenCalled();
      expect(mutate).not.toHaveBeenCalled();
    });

    it("renders the problem detail once the upload fails, and Retry re-uploads the same file", async () => {
      const error = new ProblemDetailError({
        status: 415,
        title: "Unsupported Media Type",
        detail: "The file type 'application/x-msdownload' is not permitted for this attribute.",
        type: "https://contentgrid.cloud/problems/unsupported-media-type",
      });
      mockUploadState({ error });
      render(<ContentAttributeRenderer attribute={contentAttribute()} entityItem={ENTITY_ITEM} />);

      expect(
        screen.getByText(
          "The file type 'application/x-msdownload' is not permitted for this attribute.",
        ),
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(mutate).toHaveBeenCalledWith({ file: REPLACEMENT });
    });
  });
});
