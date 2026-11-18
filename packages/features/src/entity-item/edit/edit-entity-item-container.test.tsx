import { createRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  ALL_ATTRIBUTE_ITEM_URL,
  allAttributeItemBodyWith,
  makeAllAttributeItem,
} from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import {
  ORDER_ITEM_URL,
  makeOrderItem,
} from "@contentgrid/navigator-data/test-fixtures/hal/order-item";
import { Toaster } from "@contentgrid/ui";
import { server } from "../../../test-setup";
import { useEntityItemContext } from "../use-entity-item-context";
import {
  EditEntityItemContainer,
  type EditEntityItemFormHandle,
} from "./edit-entity-item-container";
import type { EditableEntityItem } from "./editable-entity-item";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function problem(status: number, body: Record<string, unknown>) {
  return HttpResponse.json(
    { status, ...body },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Renders inside a router, which the form's unsaved-changes guard needs. */
async function renderForm(
  item: EntityItem,
  {
    onClose = vi.fn(),
    onRefresh = vi.fn(),
    onPreview,
    onSavingChange,
    remountOnRefresh = false,
    ref,
  }: {
    onClose?: () => void;
    onRefresh?: () => void;
    onPreview?: (attributeName: string) => void;
    onSavingChange?: (isSaving: boolean) => void;
    /** Remounts the form on Refresh, as the item pages do when the refetched item has a new ETag. */
    remountOnRefresh?: boolean;
    ref?: React.Ref<EditEntityItemFormHandle>;
  } = {},
) {
  // Holds the file changes and their failures like the item pages do.
  function Form() {
    const context = useEntityItemContext(item);
    const [version, setVersion] = useState(0);
    return (
      <EditEntityItemContainer
        key={version}
        item={item as EditableEntityItem}
        onClose={onClose}
        onRefresh={() => {
          onRefresh();
          if (remountOnRefresh) setVersion((current) => current + 1);
        }}
        pendingContent={context.pendingContent}
        onPendingContentChange={context.setPendingContent}
        contentFailures={context.contentFailures}
        onContentFailuresChange={context.setContentFailures}
        onPreview={onPreview}
        onSavingChange={onSavingChange}
        ref={ref}
      />
    );
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree: createRootRoute({ component: Form }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl="https://api.example.contentgrid.com/profile"
      >
        <RouterProvider router={router} />
        <Toaster />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Save" });
}

/** Answers the reload that follows a successful PUT. */
const reloadHandler = http.get(ALL_ATTRIBUTE_ITEM_URL, () =>
  HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v2"' } }),
);

describe("EditEntityItemContainer", () => {
  it("prefills every field from the item and saves with a PUT carrying the item's ETag", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let sent: { ifMatch: string | null; body: unknown } | undefined;
    server.use(
      reloadHandler,
      http.put(ALL_ATTRIBUTE_ITEM_URL, async ({ request }) => {
        sent = { ifMatch: request.headers.get("If-Match"), body: await request.json() };
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose });

    const text = screen.getByLabelText("Text");
    expect(text).toHaveValue("Test string");
    expect(screen.getByLabelText("Content: Filename")).toHaveValue("Bob.pdf");

    await user.clear(text);
    await user.type(text, "Changed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent?.ifMatch).toBe('"v1"');
    expect(sent?.body).toMatchObject({
      text: "Changed",
      long: 0,
      constrained_text: "Constraint A",
      content: { filename: "Bob.pdf", mimetype: "application/pdf" },
    });
    expect(
      await screen.findByText("All-attribute has been successfully updated!"),
    ).toBeInTheDocument();
  });

  it("shows a server validation error on its field and stays open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, () =>
        problem(400, {
          type: "https://contentgrid.cloud/problems/input/validation",
          title: "Validation failed",
          errors: [
            {
              type: "https://contentgrid.cloud/problems/input/validation/duplicate",
              title: "Already in use",
              field: "text",
              conflicting_item: "https://api.example.contentgrid.com/all-attributes/other",
            },
          ],
        }),
      ),
    );
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Already in use")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("on 412 offers Refresh, which asks the caller to reload the item, and blocks saving", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, () =>
        problem(412, {
          type: "https://contentgrid.cloud/problems/unsatisfied-version",
          title: "Unsatisfied version",
        }),
      ),
    );
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onRefresh });

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("reports an item that no longer exists without offering to save again", async () => {
    const user = userEvent.setup();
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, () =>
        problem(404, {
          type: "https://contentgrid.cloud/problems/not-found/entity-item",
          title: "Entity item not found",
        }),
      ),
    );
    await renderForm(makeAllAttributeItem({}, '"v1"'));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Entity item not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("cancel() closes an unchanged form straight away", async () => {
    const onClose = vi.fn();
    const ref = createRef<EditEntityItemFormHandle>();
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose, ref });

    act(() => ref.current?.cancel());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancel() asks for confirmation when there are unsaved changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const ref = createRef<EditEntityItemFormHandle>();
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose, ref });

    await user.type(screen.getByLabelText("Text"), " changed");
    act(() => ref.current?.cancel());

    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel() does nothing while Save runs", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const ref = createRef<EditEntityItemFormHandle>();
    let releaseSave: () => void = () => {};
    const saveHeld = new Promise<void>((resolve) => (releaseSave = resolve));
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, async () => {
        await saveHeld;
        return new HttpResponse(null, { status: 204 });
      }),
      reloadHandler,
    );
    await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose, ref });

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    act(() => ref.current?.cancel());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Leave without saving?")).not.toBeInTheDocument();

    releaseSave();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  describe("file changes", () => {
    const CONTENT_URL = `${ALL_ATTRIBUTE_ITEM_URL}/content`;
    const contentHead = http.head(
      CONTENT_URL,
      () => new HttpResponse(null, { status: 200, headers: { ETag: '"content-v1"' } }),
    );
    const itemSaved = http.put(
      ALL_ATTRIBUTE_ITEM_URL,
      () => new HttpResponse(null, { status: 204 }),
    );

    function pickFile(user: ReturnType<typeof userEvent.setup>, file: File) {
      return user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    }

    it("removes the stored file only on Save, after the metadata, then closes", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const requests: string[] = [];
      let metadataBody: unknown;
      server.use(
        contentHead,
        http.put(ALL_ATTRIBUTE_ITEM_URL, async ({ request }) => {
          requests.push("PUT item");
          metadataBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
        http.delete(CONTENT_URL, () => {
          requests.push("DELETE content");
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose });

      expect(screen.getByLabelText("Content: Filename")).toHaveValue("Bob.pdf");
      expect(screen.getByLabelText("Content: Mimetype")).toHaveValue("application/pdf");
      await user.click(screen.getByRole("button", { name: "Remove file" }));
      // No file left, so no filename or mimetype to edit.
      expect(screen.queryByLabelText("Content: Filename")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Content: Mimetype")).not.toBeInTheDocument();
      expect(requests).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(requests).toEqual(["PUT item", "DELETE content"]);
      // The DELETE clears the file's metadata; until then the stored values stay.
      expect(metadataBody).toMatchObject({
        content: { filename: "Bob.pdf", mimetype: "application/pdf" },
      });
    });

    it("names a file that was not saved and moves onto the latest item instead of closing", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onRefresh = vi.fn();
      server.use(
        contentHead,
        itemSaved,
        http.delete(CONTENT_URL, () =>
          problem(412, {
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
            title: "Unsatisfied version",
          }),
        ),
      );
      await renderForm(makeAllAttributeItem({}, '"v1"'), { onClose, onRefresh });

      await user.click(screen.getByRole("button", { name: "Remove file" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText(
          "Changes saved, but the file of Content was not: Unsatisfied version",
        ),
      ).toBeInTheDocument();
      expect(onRefresh).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      // The failed removal still waits, so Save tries it again.
      expect(screen.queryByLabelText("Content: Filename")).not.toBeInTheDocument();
    });

    it("stores a picked file under the name edited in its filename field", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      server.use(
        itemSaved,
        http.head(CONTENT_URL, () => new HttpResponse(null, { status: 404 })),
        http.put(CONTENT_URL, () => new HttpResponse(null, { status: 204 })),
      );
      // Spy rather than read the body back: jsdom loses a File's name in a multipart body.
      const appendSpy = vi.spyOn(FormData.prototype, "append");
      await renderForm(makeAllAttributeItem({ content: null }, '"v1"'), { onClose });

      const picked = new File(["new"], "new.txt", { type: "text/plain" });
      await pickFile(user, picked);
      const filename = screen.getByLabelText("Content: Filename");
      await user.clear(filename);
      await user.type(filename, "renamed.txt");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(appendSpy).toHaveBeenCalledWith("file", picked, "renamed.txt");
      appendSpy.mockRestore();
    });

    it("stores a picked file under the media type edited in its mimetype field", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      server.use(
        itemSaved,
        http.head(CONTENT_URL, () => new HttpResponse(null, { status: 404 })),
        http.put(CONTENT_URL, () => new HttpResponse(null, { status: 204 })),
      );
      // Read the part off the spy: undici can't parse a multipart body back into jsdom Files.
      const appendSpy = vi.spyOn(FormData.prototype, "append");
      await renderForm(makeAllAttributeItem({ content: null }, '"v1"'), { onClose });

      await pickFile(user, new File(["new"], "new.txt", { type: "text/plain" }));
      const mimetype = screen.getByLabelText("Content: Mimetype");
      await user.clear(mimetype);
      await user.type(mimetype, "text/markdown");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      const part = appendSpy.mock.calls.find(([field]) => field === "file")?.[1] as File;
      expect(part.type).toBe("text/markdown");
      appendSpy.mockRestore();
    });

    it("keeps the file fields read-only while Save runs", async () => {
      const user = userEvent.setup();
      let releaseSave: () => void = () => {};
      const saveHeld = new Promise<void>((resolve) => (releaseSave = resolve));
      const onSavingChange = vi.fn();
      server.use(
        contentHead,
        http.put(ALL_ATTRIBUTE_ITEM_URL, async () => {
          await saveHeld;
          return new HttpResponse(null, { status: 204 });
        }),
        http.delete(CONTENT_URL, () => new HttpResponse(null, { status: 204 })),
      );
      await renderForm(makeAllAttributeItem({}, '"v1"'), { onSavingChange });

      expect(screen.getByRole("button", { name: "Remove file" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument(),
      );
      expect(onSavingChange).toHaveBeenLastCalledWith(true);
      releaseSave();
      await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false));
    });

    it("brings a picked file into the preview, but not a removal", async () => {
      const user = userEvent.setup();
      const onPreview = vi.fn();
      await renderForm(makeAllAttributeItem({}, '"v1"'), { onPreview });

      await user.click(screen.getByRole("button", { name: "Remove file" }));
      expect(onPreview).not.toHaveBeenCalled();

      await pickFile(user, new File(["new"], "new.txt", { type: "text/plain" }));
      expect(onPreview).toHaveBeenCalledWith("content");
    });

    it("removing a file picked for an attribute without a stored file sends no file request", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      // Any HEAD/PUT/DELETE on the content link would be an unhandled request and fail the test.
      server.use(itemSaved);
      await renderForm(makeAllAttributeItem({ content: null }, '"v1"'), { onClose });

      await pickFile(user, new File(["new"], "new.txt", { type: "text/plain" }));
      await user.click(screen.getByRole("button", { name: "Remove file" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
    it("removing a file picked for an attribute without a stored file leaves the form clean", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const ref = createRef<EditEntityItemFormHandle>();
      await renderForm(makeAllAttributeItem({ content: null }, '"v1"'), { onClose, ref });

      await pickFile(user, new File(["new"], "new.txt", { type: "text/plain" }));
      await user.click(screen.getByRole("button", { name: "Remove file" }));
      act(() => ref.current?.cancel());

      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByText("Leave without saving?")).not.toBeInTheDocument();
    });

    it("on retry sends only the file change that failed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const DOCUMENT_URL = `${ORDER_ITEM_URL}/document`;
      const RECEIPT_URL = `${ORDER_ITEM_URL}/receipt`;
      const requests: string[] = [];
      let failReceipt = true;
      server.use(
        http.put(ORDER_ITEM_URL, () => new HttpResponse(null, { status: 204 })),
        http.head(DOCUMENT_URL, () => {
          requests.push("HEAD document");
          return new HttpResponse(null, { status: 200, headers: { ETag: '"d1"' } });
        }),
        http.delete(DOCUMENT_URL, () => {
          requests.push("DELETE document");
          return new HttpResponse(null, { status: 204 });
        }),
        http.head(RECEIPT_URL, () => {
          requests.push("HEAD receipt");
          return new HttpResponse(null, { status: 200, headers: { ETag: '"r1"' } });
        }),
        http.delete(RECEIPT_URL, () => {
          requests.push("DELETE receipt");
          return failReceipt
            ? problem(412, {
                type: "https://contentgrid.cloud/problems/unsatisfied-version",
                title: "Unsatisfied version",
              })
            : new HttpResponse(null, { status: 204 });
        }),
      );
      await renderForm(makeOrderItem({}, '"v1"'), { onClose, remountOnRefresh: true });

      const removeButtons = screen.getAllByRole("button", { name: "Remove file" });
      expect(removeButtons).toHaveLength(2);
      await user.click(removeButtons[0]);
      await user.click(screen.getAllByRole("button", { name: "Remove file" })[0]);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText("This file was not saved: Unsatisfied version. Save to try again."),
      ).toBeInTheDocument();
      expect(requests).toContain("DELETE document");
      expect(requests).toContain("DELETE receipt");

      requests.length = 0;
      failReceipt = false;
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(requests.filter((request) => request.endsWith("document"))).toEqual([]);
      expect(requests).toContain("DELETE receipt");
    });

    describe("after a file change failed", () => {
      const failedMessage = "This file was not saved: Unsatisfied version. Save to try again.";
      const conflict = () =>
        problem(412, {
          type: "https://contentgrid.cloud/problems/unsatisfied-version",
          title: "Unsatisfied version",
        });

      it("shows the failure on its card until another file is picked", async () => {
        const user = userEvent.setup();
        server.use(
          contentHead,
          itemSaved,
          http.delete(CONTENT_URL, () => conflict()),
        );
        await renderForm(makeAllAttributeItem({}, '"v1"'), { remountOnRefresh: true });

        await user.click(screen.getByRole("button", { name: "Remove file" }));
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText(failedMessage)).toBeInTheDocument();

        await pickFile(user, new File(["new"], "new.txt", { type: "text/plain" }));
        expect(screen.queryByText(failedMessage)).not.toBeInTheDocument();
      });

      it("keeps the filename the user typed, and the retry stores the file under it", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        let failPut = true;
        server.use(
          itemSaved,
          http.head(CONTENT_URL, () => new HttpResponse(null, { status: 404 })),
          http.put(CONTENT_URL, () =>
            failPut ? conflict() : new HttpResponse(null, { status: 204 }),
          ),
        );
        const appendSpy = vi.spyOn(FormData.prototype, "append");
        await renderForm(makeAllAttributeItem({ content: null }, '"v1"'), {
          onClose,
          remountOnRefresh: true,
        });

        const picked = new File(["new"], "new.txt", { type: "text/plain" });
        await pickFile(user, picked);
        const filename = screen.getByLabelText("Content: Filename");
        await user.clear(filename);
        await user.type(filename, "renamed.txt");
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText(failedMessage)).toBeInTheDocument();
        expect(screen.getByLabelText("Content: Filename")).toHaveValue("renamed.txt");

        failPut = false;
        appendSpy.mockClear();
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        const part = appendSpy.mock.calls.find(([field]) => field === "file");
        expect(part?.[2]).toBe("renamed.txt");
        appendSpy.mockRestore();
      });
    });
  });
});
