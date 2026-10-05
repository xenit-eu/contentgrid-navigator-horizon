import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
import { Toaster } from "@contentgrid/ui";
import { server } from "../../../test-setup";
import { EditEntityItemContainer } from "./edit-entity-item-container";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function problem(status: number, body: Record<string, unknown>) {
  return HttpResponse.json(
    { status, ...body },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

function renderForm(item: EntityItem, onSaved: () => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider
        apiFetch={createApiClient(noopSupplier)}
        contentFetch={createContentClient(noopSupplier)}
        profileUrl="https://api.example.contentgrid.com/profile"
      >
        <EditEntityItemContainer
          item={item}
          updateTemplate={item.updateTemplate!}
          onSaved={onSaved}
          onCancel={vi.fn()}
        />
        <Toaster />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );
}

/** Answers the reload that follows a successful PUT. */
const reloadHandler = http.get(ALL_ATTRIBUTE_ITEM_URL, () =>
  HttpResponse.json(allAttributeItemBodyWith(), { headers: { ETag: '"v2"' } }),
);

describe("EditEntityItemContainer", () => {
  it("prefills every field from the item and saves with a PUT carrying the item's ETag", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    let sent: { ifMatch: string | null; body: unknown } | undefined;
    server.use(
      reloadHandler,
      http.put(ALL_ATTRIBUTE_ITEM_URL, async ({ request }) => {
        sent = { ifMatch: request.headers.get("If-Match"), body: await request.json() };
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderForm(makeAllAttributeItem({}, '"v1"'), onSaved);

    const text = screen.getByLabelText("Text");
    expect(text).toHaveValue("Test string");
    expect(screen.getByLabelText("Content: Filename")).toHaveValue("Bob.pdf");

    await user.clear(text);
    await user.type(text, "Changed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
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
    const onSaved = vi.fn();
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
    renderForm(makeAllAttributeItem({}, '"v1"'), onSaved);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Already in use")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("on 412 reloads the item and keeps only the user's own changes on top of it", async () => {
    const user = userEvent.setup();
    const puts: { ifMatch: string | null; body: unknown }[] = [];
    server.use(
      // Someone else filled in the text that was empty when the form opened.
      http.get(ALL_ATTRIBUTE_ITEM_URL, () =>
        HttpResponse.json(allAttributeItemBodyWith({ text: "Theirs" }), {
          headers: { ETag: '"v2"' },
        }),
      ),
      http.put(ALL_ATTRIBUTE_ITEM_URL, async ({ request }) => {
        puts.push({ ifMatch: request.headers.get("If-Match"), body: await request.json() });
        if (puts.length > 1) return new HttpResponse(null, { status: 204 });
        return problem(412, {
          type: "https://contentgrid.cloud/problems/unsatisfied-version",
          title: "Unsatisfied version",
        });
      }),
    );
    renderForm(makeAllAttributeItem({ text: null }, '"v1"'));

    const filename = screen.getByLabelText("Content: Filename");
    await user.clear(filename);
    await user.type(filename, "mine.pdf");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByLabelText("Text")).toHaveValue("Theirs"));
    expect(screen.getByLabelText("Content: Filename")).toHaveValue("mine.pdf");
    expect(screen.getByText("Unsatisfied version")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]?.ifMatch).toBe('"v2"');
    expect(puts[1]?.body).toMatchObject({ text: "Theirs", content: { filename: "mine.pdf" } });
    expect(screen.queryByText("Unsatisfied version")).not.toBeInTheDocument();
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
    renderForm(makeAllAttributeItem({}, '"v1"'));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Entity item not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
