import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributePlain,
  type EntityItemToManyRelation,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useAddToManyRelation,
  useClearRelation,
  useDeleteRelationItem,
  useEntityItemCollection,
  useEntityItemToManyRelation,
  useUnlinkRelation,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { RelationToManySection } from "./relation-to-many-section";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useEntityItemToManyRelation: vi.fn(),
    useAddToManyRelation: vi.fn(),
    useClearRelation: vi.fn(),
    useUnlinkRelation: vi.fn(),
    useDeleteRelationItem: vi.fn(),
    useEntityItemCollection: vi.fn(),
  };
});

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const noopSupplier: AuthenticationTokenSupplier = async () => null;

const TARGET_PROFILE_JSON = {
  name: "invoice",
  title: "Invoices",
  _links: {
    self: { href: `${PROFILE_URL}/invoices` },
    describes: [
      { href: `${API_URL}/invoices`, name: "collection", title: "Invoices" },
      { href: `${API_URL}/invoices/{id}`, name: "item", title: "Invoices", templated: true },
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
        name: "id",
        title: "ID",
        type: "string",
        readOnly: true,
        _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
        _links: {},
      },
      {
        name: "amount",
        title: "Amount",
        type: "double",
        readOnly: false,
        _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    "create-form": {
      method: "POST",
      target: `${API_URL}/invoices`,
      contentType: "application/json",
      properties: [],
    },
  },
};
const TARGET_PROFILE = makeProfileEntity(TARGET_PROFILE_JSON, `${PROFILE_URL}/invoices`, "invoice");

function makeRelation(
  overrides: Partial<{
    name: string;
    title: string;
    canAdd: boolean;
    canClear: boolean;
    canUnlinkItem: boolean;
    targetProfile: ProfileEntity | undefined;
  }> = {},
): EntityItemToManyRelation {
  const targetProfile = "targetProfile" in overrides ? overrides.targetProfile : TARGET_PROFILE;
  return {
    name: overrides.name ?? "invoices",
    canAdd: overrides.canAdd ?? true,
    canClear: overrides.canClear ?? true,
    canUnlinkItem: overrides.canUnlinkItem ?? true,
    profileRelation: {
      title: overrides.title ?? "Invoices",
      getTargetProfile: () => targetProfile,
    },
  } as unknown as EntityItemToManyRelation;
}

function makeItem(id: string, amount: number, canDelete = false): EntityItem {
  const attributes: Record<string, { value: EntityItemAttributePlain }> = {
    id: { value: new EntityItemAttributePlain("id", id) },
    amount: { value: new EntityItemAttributePlain("amount", amount) },
  };
  return {
    id,
    canDelete,
    halItem: { data: { id, amount } },
    findAttribute: (name: string) => attributes[name],
    userDefinedAttributes: [],
    selfLink: { href: `${API_URL}/invoices/${id}` },
  } as unknown as EntityItem;
}

function makeCollectionData(
  items: EntityItem[],
  overrides: Partial<{
    hasNext: boolean;
    hasPrevious: boolean;
    nextHref: string;
    prevHref: string;
    totalItems: { count: number; isEstimated: boolean };
  }> = {},
) {
  return {
    isEmpty: items.length === 0,
    items,
    totalItems: overrides.totalItems,
    hasNext: overrides.hasNext ?? false,
    hasPrevious: overrides.hasPrevious ?? false,
    nextHref: overrides.nextHref,
    prevHref: overrides.prevHref,
    pageSize: items.length,
    findById: (id: string) => items.find((item) => item.id === id),
  };
}

function mockCollectionState(
  state: Partial<{
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error;
    data: ReturnType<typeof makeCollectionData>;
  }>,
) {
  vi.mocked(useEntityItemToManyRelation).mockReturnValue({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...state,
  } as unknown as ReturnType<typeof useEntityItemToManyRelation>);
}

/** Mocks `useEntityItemCollection` — the query the nested `RelationItemSearchDialog` (the
 * "Link" picker) uses for its own search results, distinct from the relation's own
 * `useEntityItemToManyRelation` mocked above. */
function mockSearchCollectionState(data: ReturnType<typeof makeCollectionData>) {
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    data,
  } as unknown as ReturnType<typeof useEntityItemCollection>);
}

const clearRelation = vi.fn();
const addRelation = vi.fn();
const unlinkItem = vi.fn();
const deleteItem = vi.fn();

function resetMutationMocks() {
  clearRelation.mockReset();
  addRelation.mockReset();
  unlinkItem.mockReset();
  deleteItem.mockReset();

  vi.mocked(useClearRelation).mockReturnValue({
    mutate: clearRelation,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useClearRelation>);
  vi.mocked(useAddToManyRelation).mockReturnValue({
    mutate: addRelation,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useAddToManyRelation>);
  vi.mocked(useUnlinkRelation).mockReturnValue({
    mutate: unlinkItem,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useUnlinkRelation>);
  vi.mocked(useDeleteRelationItem).mockReturnValue({
    mutate: deleteItem,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useDeleteRelationItem>);
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    data: { items: [] },
  } as unknown as ReturnType<typeof useEntityItemCollection>);
}

function renderSection(
  props: Partial<Parameters<typeof RelationToManySection>[0]> = {},
  { expanded = true } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <RelationToManySection relation={makeRelation()} profiles={[TARGET_PROFILE]} {...props} />,
    { wrapper: Wrapper },
  );
  // The section starts collapsed, as in legacy.
  if (expanded) fireEvent.click(screen.getByRole("button", { name: /invoices/i }));
  return result;
}

afterEach(() => {
  resetMutationMocks();
});
resetMutationMocks();

describe("RelationToManySection", () => {
  it("shows a loading skeleton while the relation collection is pending", () => {
    mockCollectionState({ isPending: true });
    const { container } = renderSection();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("shows a problem alert when the relation collection fails to load", () => {
    mockCollectionState({ isError: true, error: new Error("network down") });
    renderSection();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("starts collapsed and shows an empty state once expanded, with no Unlink all button", async () => {
    const user = userEvent.setup();
    mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
    renderSection({ relation: makeRelation({ canClear: true }) }, { expanded: false });
    expect(screen.queryByText("No items linked")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /invoices/i }));
    expect(await screen.findByText("No items linked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unlink all/i })).not.toBeInTheDocument();
  });

  it("shows the Unlink all button once items are linked and canClear is true", () => {
    mockCollectionState({ isSuccess: true, data: makeCollectionData([makeItem("1", 10)]) });
    renderSection({ relation: makeRelation({ canClear: true }) });
    expect(screen.getByRole("button", { name: /unlink all/i })).toBeInTheDocument();
  });

  it("hides the Unlink all button when canClear is false, even with items", () => {
    mockCollectionState({ isSuccess: true, data: makeCollectionData([makeItem("1", 10)]) });
    renderSection({ relation: makeRelation({ canClear: false }) });
    expect(screen.queryByRole("button", { name: /unlink all/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation before clearing, and does not call clearRelation on cancel", async () => {
    const user = userEvent.setup();
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10), makeItem("2", 20)], {
        totalItems: { count: 2, isEstimated: false },
      }),
    });
    renderSection({ relation: makeRelation({ canClear: true, title: "Invoices" }) });

    await user.click(screen.getByRole("button", { name: /unlink all/i }));
    expect(screen.getByText(/unlink all invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/remove 2 linked items/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(clearRelation).not.toHaveBeenCalled();
  });

  it("calls clearRelation when the unlink-all dialog is confirmed", async () => {
    const user = userEvent.setup();
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10)]),
    });
    renderSection({ relation: makeRelation({ canClear: true }) });

    await user.click(screen.getByRole("button", { name: /unlink all/i }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink all" }));

    expect(clearRelation).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("hides the Link button when canAdd is false", () => {
    mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
    renderSection({ relation: makeRelation({ canAdd: false }) });
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("opens the link dialog when the Link button is clicked", async () => {
    const user = userEvent.setup();
    mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
    renderSection({ relation: makeRelation({ canAdd: true }) });

    await user.click(screen.getByRole("button", { name: "Link" }));
    expect(await screen.findByText(/link invoices/i)).toBeInTheDocument();
  });

  it("calls onItemClick with the target profile name and item id when a row is clicked", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    mockCollectionState({ isSuccess: true, data: makeCollectionData([makeItem("42", 10)]) });
    renderSection({ relation: makeRelation(), onItemClick });

    await user.click(screen.getByText("10"));
    expect(onItemClick).toHaveBeenCalledWith("invoice", "42");
  });

  it("explains why linked items can't be shown when the target profile is unresolved", () => {
    mockCollectionState({ isSuccess: true, data: makeCollectionData([makeItem("42", 10)]) });
    renderSection({ relation: makeRelation({ targetProfile: undefined }) });

    expect(screen.getByText(/can't be shown/)).toBeInTheDocument();
  });

  it("calls unlinkItem with the resolved item when a row's unlink is confirmed", async () => {
    const user = userEvent.setup();
    const item = makeItem("1", 10);
    mockCollectionState({ isSuccess: true, data: makeCollectionData([item]) });
    renderSection({ relation: makeRelation({ canUnlinkItem: true }) });

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    expect(unlinkItem).toHaveBeenCalledWith(item);
  });

  it("does not offer per-row delete when no item is deletable", () => {
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10, false), makeItem("2", 20, false)]),
    });
    renderSection({ relation: makeRelation() });
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("calls deleteItem with the resolved item when a deletable row's delete is confirmed", async () => {
    const user = userEvent.setup();
    const deletable = makeItem("2", 20, true);
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10, false), deletable]),
    });
    renderSection({ relation: makeRelation() });

    // Only the deletable row gets a Delete action.
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteItem).toHaveBeenCalledWith(deletable);
  });

  it("disables Previous when there is no previous page and enables Next when there is a next page", () => {
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10)], { hasNext: true, hasPrevious: false }),
    });
    renderSection({ relation: makeRelation() });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  describe("link dialog (RelationItemSearchDialog)", () => {
    it("does not show a Create new affordance when onCreateNew is not provided", async () => {
      const user = userEvent.setup();
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      mockSearchCollectionState(makeCollectionData([]));
      renderSection({ relation: makeRelation({ canAdd: true }) });

      await user.click(screen.getByRole("button", { name: "Link" }));
      await screen.findByRole("dialog");
      expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    });

    it("hides Create when the target profile has no create-form template (create not permitted)", async () => {
      const user = userEvent.setup();
      const noCreateProfile = makeProfileEntity(
        { ...TARGET_PROFILE_JSON, _templates: {} },
        `${PROFILE_URL}/invoices`,
        "invoice",
      );
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      mockSearchCollectionState(makeCollectionData([]));
      renderSection({
        relation: makeRelation({ canAdd: true, targetProfile: noCreateProfile }),
        onCreateNew: vi.fn(),
      });

      await user.click(screen.getByRole("button", { name: "Link" }));
      await screen.findByRole("dialog");
      expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    });

    it("keeps a selection made on one page after paging to another", async () => {
      const user = userEvent.setup();
      const page2 = `${API_URL}/invoices?page=2`;
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      vi.mocked(useEntityItemCollection).mockImplementation(
        (params) =>
          ({
            isPending: false,
            isSuccess: true,
            isError: false,
            data:
              params && "url" in params && params.url === page2
                ? makeCollectionData([makeItem("3", 30)], { hasPrevious: true })
                : makeCollectionData([makeItem("1", 10)], { hasNext: true, nextHref: page2 }),
          }) as unknown as ReturnType<typeof useEntityItemCollection>,
      );
      renderSection({ relation: makeRelation({ canAdd: true }) });

      await user.click(screen.getByRole("button", { name: "Link" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getAllByRole("checkbox")[1]!);
      await user.click(within(dialog).getByRole("button", { name: "Next" }));
      await user.click((await within(dialog).findAllByRole("checkbox"))[1]!);
      await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

      expect(addRelation).toHaveBeenCalledWith(
        [`${API_URL}/invoices/1`, `${API_URL}/invoices/3`],
        expect.anything(),
      );
    });

    it("keeps the dialog open while linking and closes it once linking succeeds", async () => {
      const user = userEvent.setup();
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      mockSearchCollectionState(makeCollectionData([makeItem("1", 10)]));
      renderSection({ relation: makeRelation({ canAdd: true }) });

      await user.click(screen.getByRole("button", { name: "Link" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getAllByRole("checkbox")[1]!);
      await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const [, options] = addRelation.mock.calls[0]!;
      act(() => options.onSuccess());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("shows a checkbox per candidate row and counts the checked ones", async () => {
      const user = userEvent.setup();
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      mockSearchCollectionState(makeCollectionData([makeItem("1", 10), makeItem("2", 20)]));
      renderSection({ relation: makeRelation({ canAdd: true }) });

      await user.click(screen.getByRole("button", { name: "Link" }));
      // First is the header "select all" checkbox; the two candidate rows follow.
      const checkboxes = await screen.findAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);

      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      expect(screen.getByText("2 items selected")).toBeInTheDocument();
    });

    it("calls addRelation with every checked item's href at once when Link entity items is confirmed", async () => {
      const user = userEvent.setup();
      mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
      mockSearchCollectionState(makeCollectionData([makeItem("1", 10), makeItem("2", 20)]));
      renderSection({ relation: makeRelation({ canAdd: true }) });

      await user.click(screen.getByRole("button", { name: "Link" }));
      const checkboxes = await screen.findAllByRole("checkbox");
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);
      await user.click(screen.getByRole("button", { name: "Link entity items" }));

      expect(addRelation).toHaveBeenCalledWith(
        [`${API_URL}/invoices/1`, `${API_URL}/invoices/2`],
        expect.anything(),
      );
    });
  });
});
