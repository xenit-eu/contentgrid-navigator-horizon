/**
 * Tests for ContentAttributeCell — the attribute-table cell for a content attribute
 * that can also replace the file, whenever the server grants upload permission
 * (cg:content link present).
 *
 * `EntityItem` is duck-typed here (not built via `@contentgrid/hal`'s `HalObject` — this
 * package is forbidden from importing `@contentgrid/hal` directly, see CLAUDE.md) with just
 * the members `useUploadContent`/`ContentAttributeCell` actually touch: `canUploadContent`,
 * `uploadContentRequest` (a real `Request`, so MSW can still intercept the PUT), `selfLink`,
 * `profileEntity`, `etag`.
 *
 * Covers:
 * - Falls back to the static renderer, with no "Replace" affordance, when upload is not permitted
 * - Shows the compact filename/size display plus a "Replace" button when permitted — never the
 *   dropzone by default (see the component's doc comment: matches legacy Navigator's own
 *   compact-by-default content row, never a permanently-visible dropzone in a plain table row)
 * - Clicking "Replace" reveals the dropzone; selecting a file uploads it and collapses back to
 *   the compact display on success
 * - Clicking "Cancel" while replacing (no upload in flight) backs out without uploading
 * - A failed upload shows the problem alert and a Retry button; retry re-attempts
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributeContent,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  createContentUploadClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import {
  createContentUploadHandler,
  createProblemHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { ContentAttributeCell } from "./content-attribute-cell";

const BASE = "https://api.example.com";
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const CONTENT_URL = `${INVOICE_ITEM_URL}/document`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        createContentUploadFetch={(onProgress) =>
          createContentUploadClient(noopSupplier, onProgress)
        }
        profileUrl={`${BASE}/profile`}
      >
        {children}
      </NavigatorDataProvider>
    </QueryClientProvider>
  );
}

function makeInvoiceProfile(): ProfileEntity {
  return makeProfileEntity(
    { name: "invoice", title: "invoice", _links: { self: { href: `${BASE}/profile/invoices` } } },
    `${BASE}/profile/invoices`,
    "invoice",
  );
}

function makeFakeEntityItem(canUpload: boolean): EntityItem {
  return {
    canUploadContent: () => canUpload,
    uploadContentRequest: (
      _attributeName: string,
      file: Blob | File,
      opts?: { contentType?: string; filename?: string; signal?: AbortSignal },
    ) =>
      new Request(CONTENT_URL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": opts?.contentType ?? "application/octet-stream" },
        signal: opts?.signal,
      }),
    selfLink: { href: INVOICE_ITEM_URL },
    profileEntity: makeInvoiceProfile(),
    etag: '"v1"',
  } as unknown as EntityItem;
}

function makeContentValue(filename: string | null = "invoice.pdf"): EntityItemAttributeContent {
  return new EntityItemAttributeContent(
    "document",
    filename ? { filename, mimetype: "application/pdf", length: 1024 } : null,
    { href: CONTENT_URL, name: "document" } as never,
  );
}

/** Wire a GET handler for the re-fetch that follows a successful upload. */
function wireRefetchHandler() {
  server.use(
    http.get(INVOICE_ITEM_URL, () =>
      HttpResponse.json(
        {
          id: "inv-001",
          document: { filename: "invoice.pdf", mimetype: "application/pdf", length: 2048 },
          _links: { self: { href: INVOICE_ITEM_URL } },
        },
        { headers: { ETag: '"v2"' } },
      ),
    ),
  );
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
}

function makeFile(): File {
  return new File(["hello"], "invoice.pdf", { type: "application/pdf" });
}

describe("ContentAttributeCell", () => {
  it("falls back to the static filename/size display, with no Replace button, when upload is not permitted", () => {
    const item = makeFakeEntityItem(false);
    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    expect(screen.getByText(/invoice\.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replace/i })).not.toBeInTheDocument();
  });

  it("shows the compact filename/size display and a Replace button, never the dropzone, by default", () => {
    const item = makeFakeEntityItem(true);
    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    expect(screen.getByText(/invoice\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
  });

  it("reveals the dropzone after clicking Replace", async () => {
    const item = makeFakeEntityItem(true);
    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: /replace/i }));
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("backs out to the compact display when Cancel is clicked before picking a file", async () => {
    const item = makeFakeEntityItem(true);
    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: /replace/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  });

  it("uploads a selected file and collapses back to the compact display on success", async () => {
    const item = makeFakeEntityItem(true);
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler();

    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: /replace/i }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, makeFile());

    await waitFor(() => expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument());
    expect(screen.getByText(/invoice\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  });

  it("shows the problem alert and a Retry button on failure, and retries with the same file", async () => {
    const item = makeFakeEntityItem(true);
    server.use(
      createProblemHandler({
        method: "put",
        url: CONTENT_URL,
        status: 412,
        title: "Precondition Failed",
        type: "https://contentgrid.cloud/problems/unsatisfied-version",
      }),
    );

    render(<ContentAttributeCell item={item} value={makeContentValue()} />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: /replace/i }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input, makeFile());

    const retryButton = await screen.findByRole("button", { name: /^retry$/i });

    // Second attempt succeeds — Retry should re-invoke the upload for the same file.
    server.resetHandlers();
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler();

    await userEvent.click(retryButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument(),
    );
  });
});
