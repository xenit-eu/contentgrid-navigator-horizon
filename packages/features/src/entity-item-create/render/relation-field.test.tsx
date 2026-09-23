import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileRelation,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../../test-setup";
import type { FieldDescriptor } from "../model/field-descriptor";
import { RelationField } from "./relation-field";

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn() } }));

const API_URL = "https://api.example.com";
const ROOT_PROFILE_URL = `${API_URL}/profile`;
const SUPPLIER_PROFILE_URL = `${API_URL}/profile/suppliers`;
const SUPPLIER_COLLECTION_URL = `${API_URL}/suppliers`;
const SUPPLIER_1_URL = `${SUPPLIER_COLLECTION_URL}/1`;
const PRODUCT_PROFILE_URL = `${API_URL}/profile/products`;
const PRODUCT_COLLECTION_URL = `${API_URL}/products`;
const PRODUCT_1_URL = `${PRODUCT_COLLECTION_URL}/1`;
const PRODUCT_2_URL = `${PRODUCT_COLLECTION_URL}/2`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function targetProfileJson(name: string, profileUrl: string, collectionUrl: string) {
  return {
    name,
    title: name,
    _links: {
      self: { href: profileUrl },
      describes: [
        { href: collectionUrl, name: "collection" },
        { href: `${collectionUrl}/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          name: "blueprint",
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          templated: true,
        },
      ],
    },
    _embedded: {
      "blueprint:attribute": [
        {
          name: "name",
          title: "Name",
          type: "string",
          readOnly: false,
          _embedded: {
            "blueprint:constraint": [],
            "blueprint:search-param": [{ name: "name~prefix", type: "prefix-match" }],
          },
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {
      default: { method: "HEAD", target: collectionUrl, properties: [] },
      search: {
        method: "GET",
        target: collectionUrl,
        properties: [{ name: "name~prefix", type: "text" }],
      },
      "create-form": {
        method: "POST",
        target: collectionUrl,
        contentType: "application/json",
        properties: [],
      },
    },
  };
}

const SUPPLIER_PROFILE = makeProfileEntity(
  targetProfileJson("supplier", SUPPLIER_PROFILE_URL, SUPPLIER_COLLECTION_URL),
  SUPPLIER_PROFILE_URL,
  "supplier",
);
const PRODUCT_PROFILE = makeProfileEntity(
  targetProfileJson("product", PRODUCT_PROFILE_URL, PRODUCT_COLLECTION_URL),
  PRODUCT_PROFILE_URL,
  "product",
);

function relationItem(collectionUrl: string, id: string, name: string) {
  return { id, name, _links: { self: { href: `${collectionUrl}/${id}` } } };
}

function makeRelationField(
  overrides: Partial<Extract<FieldDescriptor, { kind: "relation" }>> = {},
): Extract<FieldDescriptor, { kind: "relation" }> {
  return {
    kind: "relation",
    name: "supplier",
    label: "Supplier",
    required: false,
    readOnly: false,
    multiValue: false,
    profileRelation: {
      getTargetProfile: () => SUPPLIER_PROFILE,
    } as unknown as ProfileRelation,
    ...overrides,
  } as Extract<FieldDescriptor, { kind: "relation" }>;
}

const rootProfileJson = {
  _links: {
    self: { href: ROOT_PROFILE_URL },
    "cg:entity": [
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
      { href: PRODUCT_PROFILE_URL, name: "product", title: "Product" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

function setupHandlers() {
  server.use(
    http.get(ROOT_PROFILE_URL, () => HttpResponse.json(rootProfileJson)),
    http.get(SUPPLIER_PROFILE_URL, () =>
      HttpResponse.json(
        targetProfileJson("supplier", SUPPLIER_PROFILE_URL, SUPPLIER_COLLECTION_URL),
      ),
    ),
    http.get(PRODUCT_PROFILE_URL, () =>
      HttpResponse.json(targetProfileJson("product", PRODUCT_PROFILE_URL, PRODUCT_COLLECTION_URL)),
    ),
    http.get(SUPPLIER_COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: { supplier: [relationItem(SUPPLIER_COLLECTION_URL, "1", "Acme Corp")] },
        _links: { self: { href: SUPPLIER_COLLECTION_URL } },
        page: { size: 1, total_items_exact: 1 },
      }),
    ),
    http.get(SUPPLIER_1_URL, () =>
      HttpResponse.json(relationItem(SUPPLIER_COLLECTION_URL, "1", "Acme Corp")),
    ),
    http.get(PRODUCT_COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: {
          product: [
            relationItem(PRODUCT_COLLECTION_URL, "1", "Widget A"),
            relationItem(PRODUCT_COLLECTION_URL, "2", "Widget B"),
          ],
        },
        _links: { self: { href: PRODUCT_COLLECTION_URL } },
        page: { size: 2, total_items_exact: 2 },
      }),
    ),
    http.get(PRODUCT_1_URL, () =>
      HttpResponse.json(relationItem(PRODUCT_COLLECTION_URL, "1", "Widget A")),
    ),
    http.get(PRODUCT_2_URL, () =>
      HttpResponse.json(relationItem(PRODUCT_COLLECTION_URL, "2", "Widget B")),
    ),
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={ROOT_PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function renderRelationField(props: Partial<Parameters<typeof RelationField>[0]> = {}) {
  setupHandlers();
  return render(
    <RelationField field={makeRelationField()} value="" onChange={vi.fn()} {...props} />,
    { wrapper: makeWrapper() },
  );
}

describe("RelationField — to-one", () => {
  it("shows 'No item linked' and a Link button when unset", () => {
    renderRelationField();
    expect(screen.getByText("No item linked")).toBeInTheDocument();
  });

  it("opens the search dialog and links the selected item's href on selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ onChange });

    await user.click(screen.getByRole("button", { name: "Link" }));
    const option = await screen.findByText("Acme Corp");
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(SUPPLIER_1_URL);
  });

  it("resolves and shows the linked item's summary for a non-empty value", async () => {
    renderRelationField({ value: SUPPLIER_1_URL });
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("clears the value via onChange when Unlink is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ value: SUPPLIER_1_URL, onChange });

    await screen.findByText("Acme Corp");
    await user.click(screen.getByRole("button", { name: "Unlink" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("hides the Link button when the target profile can't be resolved", () => {
    renderRelationField({ field: makeRelationField({ profileRelation: undefined }) });
    expect(screen.getByText("No item linked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("shows the picker's Create new affordance and forwards RelationField's onCreateNew", async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();
    renderRelationField({ onCreateNew });

    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.click(await screen.findByRole("button", { name: "Create" }));

    expect(onCreateNew).toHaveBeenCalledWith("supplier");
  });

  it("focuses the search input (not the Create button) when the picker opens", async () => {
    const user = userEvent.setup();
    renderRelationField({ onCreateNew: vi.fn() });

    await user.click(screen.getByRole("button", { name: "Link" }));

    expect(await screen.findByRole("combobox")).toHaveFocus();
  });

  it("does not show the picker's Create new affordance when onCreateNew is not provided", async () => {
    const user = userEvent.setup();
    renderRelationField();

    await user.click(screen.getByRole("button", { name: "Link" }));
    await screen.findByText("Acme Corp");
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });
});

describe("RelationField — to-many", () => {
  function makeProductsField(
    overrides: Partial<Extract<FieldDescriptor, { kind: "relation" }>> = {},
  ) {
    return makeRelationField({
      name: "products",
      label: "Products",
      multiValue: true,
      profileRelation: { getTargetProfile: () => PRODUCT_PROFILE } as unknown as ProfileRelation,
      ...overrides,
    });
  }

  it("starts collapsed and shows 'No items linked' once expanded, when value is empty", async () => {
    const user = userEvent.setup();
    renderRelationField({ field: makeProductsField(), value: [] });
    expect(screen.queryByText("No items linked")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /products/i }));
    expect(await screen.findByText("No items linked")).toBeInTheDocument();
  });

  it("resolves and shows a summary for each linked href", async () => {
    renderRelationField({ field: makeProductsField(), value: [PRODUCT_1_URL, PRODUCT_2_URL] });
    expect(await screen.findByText("Widget A")).toBeInTheDocument();
    expect(await screen.findByText("Widget B")).toBeInTheDocument();
  });

  it("appends the newly linked item's href without dropping the existing one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ field: makeProductsField(), value: [PRODUCT_1_URL], onChange });

    await screen.findByText("Widget A");
    await user.click(screen.getByRole("button", { name: "Link" }));
    const dialog = await screen.findByRole("dialog");
    // First is the header "select all" checkbox; Widget A, then Widget B follow.
    const checkboxes = await within(dialog).findAllByRole("checkbox");
    await user.click(checkboxes[2]);
    await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([PRODUCT_1_URL, PRODUCT_2_URL]));
  });

  it("links multiple checked items at once when Link entity items is confirmed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ field: makeProductsField(), value: [], onChange });

    await user.click(screen.getByRole("button", { name: "Link" }));
    const dialog = await screen.findByRole("dialog");
    const checkboxes = await within(dialog).findAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    expect(screen.getByText("2 items selected")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([PRODUCT_1_URL, PRODUCT_2_URL])),
    );
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("notifies and skips an already-linked item instead of duplicating it, while still linking the new one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // Widget A (PRODUCT_1_URL) is already linked; only Widget B should actually get added.
    renderRelationField({ field: makeProductsField(), value: [PRODUCT_1_URL], onChange });

    await screen.findByText("Widget A");
    await user.click(screen.getByRole("button", { name: "Link" }));
    const dialog = await screen.findByRole("dialog");
    const checkboxes = await within(dialog).findAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

    expect(toast.info).toHaveBeenCalledWith("1 item was already linked and was skipped.");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([PRODUCT_1_URL, PRODUCT_2_URL]));
  });

  it("does not call onChange when every checked item is already linked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({
      field: makeProductsField(),
      value: [PRODUCT_1_URL, PRODUCT_2_URL],
      onChange,
    });

    await screen.findByText("Widget A");
    await user.click(screen.getByRole("button", { name: "Link" }));
    const dialog = await screen.findByRole("dialog");
    const checkboxes = await within(dialog).findAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

    expect(toast.info).toHaveBeenCalledWith("2 items were already linked and were skipped.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes only the unlinked item's href from value once the unlink dialog is confirmed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({
      field: makeProductsField(),
      value: [PRODUCT_1_URL, PRODUCT_2_URL],
      onChange,
    });

    await screen.findByText("Widget A");
    await screen.findByText("Widget B");
    const [firstUnlink] = screen.getAllByRole("button", { name: "Unlink" });
    await user.click(firstUnlink);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    expect(onChange).toHaveBeenCalledWith([PRODUCT_2_URL]);
  });

  it("still shows a row (and keeps Unlink reachable) for a linked href whose item fetch fails", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const MISSING_URL = `${PRODUCT_COLLECTION_URL}/missing`;
    server.use(http.get(MISSING_URL, () => new HttpResponse(null, { status: 404 })));

    renderRelationField({
      field: makeProductsField(),
      value: [PRODUCT_1_URL, MISSING_URL],
      onChange,
    });

    await screen.findByText("Widget A");
    // `EntityItem.fetchByUrlQuery` bakes in `retry: 3` (packages/navigator-data/CLAUDE.md) —
    // the missing href only reaches `isError` after that backoff finishes.
    await screen.findByText("Unavailable", undefined, { timeout: 10_000 });
    const unlinkButtons = screen.getAllByRole("button", { name: "Unlink" });
    expect(unlinkButtons).toHaveLength(2);

    await user.click(unlinkButtons[1]);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    expect(onChange).toHaveBeenCalledWith([PRODUCT_1_URL]);
  }, 15_000);
});
