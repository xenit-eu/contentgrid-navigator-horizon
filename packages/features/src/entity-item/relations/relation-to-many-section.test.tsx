import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  type EntityItemToManyRelation,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  createContentUploadClient,
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

const TARGET_PROFILE = makeProfileEntity(
  {
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
    _templates: {},
  },
  `${PROFILE_URL}/invoices`,
  "invoice",
);

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
  return {
    id,
    canDelete,
    halItem: { data: { id, amount } },
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

function renderSection(props: Partial<Parameters<typeof RelationToManySection>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);
  const createContentUploadFetch = (onProgress?: (percentage: number) => void) =>
    createContentUploadClient(noopSupplier, onProgress);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          createContentUploadFetch={createContentUploadFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return render(
    <RelationToManySection relation={makeRelation()} profiles={[TARGET_PROFILE]} {...props} />,
    { wrapper: Wrapper },
  );
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

  it("shows an empty state and no Unlink all button when there are no items", () => {
    mockCollectionState({ isSuccess: true, data: makeCollectionData([]) });
    renderSection({ relation: makeRelation({ canClear: true }) });
    expect(screen.getByText("No items linked")).toBeInTheDocument();
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

  it("does not call onItemClick when the target profile is unresolved", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    mockCollectionState({ isSuccess: true, data: makeCollectionData([makeItem("42", 10)]) });
    renderSection({ relation: makeRelation({ targetProfile: undefined }), onItemClick });

    await user.click(screen.getByText("42"));
    expect(onItemClick).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();
  });

  it("calls deleteItem with the resolved item when a deletable row's delete is confirmed", async () => {
    const user = userEvent.setup();
    const deletable = makeItem("2", 20, true);
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10, false), deletable]),
    });
    renderSection({ relation: makeRelation() });

    const [, secondMenu] = screen.getAllByRole("button", { name: /open menu/i });
    await user.click(secondMenu);
    await user.click(screen.getByText("Delete"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

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

  it("requests the next page's href when Next is clicked", async () => {
    const user = userEvent.setup();
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10)], {
        hasNext: true,
        nextHref: `${API_URL}/invoices?page=2`,
      }),
    });
    renderSection({ relation: makeRelation() });

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      const lastCall = vi.mocked(useEntityItemToManyRelation).mock.calls.at(-1);
      expect(lastCall?.[1]).toEqual({ url: `${API_URL}/invoices?page=2` });
    });
  });

  it("does not render pagination controls when there is only one page", () => {
    mockCollectionState({
      isSuccess: true,
      data: makeCollectionData([makeItem("1", 10)], { hasNext: false, hasPrevious: false }),
    });
    renderSection({ relation: makeRelation() });
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
  });
});
