import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type ContentChanges,
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
import { Toaster } from "@contentgrid/ui";
import { server } from "../../../test-setup";
import { EditEntityItemContainer } from "./edit-entity-item-container";
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
  }: {
    onClose?: () => void;
    onRefresh?: () => void;
    onPreview?: (attributeName: string) => void;
  } = {},
) {
  // Holds the file changes the way `useEntityItemContext` does for the item pages.
  function Form() {
    const [pendingContent, setPendingContent] = useState<ContentChanges>(new Map());
    return (
      <EditEntityItemContainer
        item={item as EditableEntityItem}
        onClose={onClose}
        onRefresh={onRefresh}
        pendingContent={pendingContent}
        onPendingContentChange={setPendingContent}
        onPreview={onPreview}
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
  await screen.findByLabelText("Text");
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
  });
});
