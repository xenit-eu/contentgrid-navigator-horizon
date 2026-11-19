import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributePlain,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useAddToManyRelation,
  useClearRelation,
  useDeleteRelationItem,
  useEntityItemCollection,
  useEntityItemToManyRelation,
  useEntityItemToManyRelationInfinite,
  useEntityItemToOneRelation,
  useSetToOneRelation,
  useUnlinkRelation,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { EntityItemRelations } from "./entity-item-relations";
import { relationLayoutForPane, useRelationLayout } from "./relation-layout";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useEntityItemToOneRelation: vi.fn(),
    useSetToOneRelation: vi.fn(),
    useEntityItemToManyRelation: vi.fn(),
    useEntityItemToManyRelationInfinite: vi.fn(),
    useAddToManyRelation: vi.fn(),
    useClearRelation: vi.fn(),
    useUnlinkRelation: vi.fn(),
    useDeleteRelationItem: vi.fn(),
    useEntityItemCollection: vi.fn(),
  };
});

vi.mock("./relation-layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./relation-layout")>();
  return { ...actual, useRelationLayout: vi.fn() };
});

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const noopSupplier: AuthenticationTokenSupplier = async () => null;

const TARGET_PROFILE = makeProfileEntity(
  {
    name: "customer",
    title: "Customers",
    _links: {
      self: { href: `${PROFILE_URL}/customers` },
      describes: [
        { href: `${API_URL}/customers`, name: "collection", title: "Customers" },
        { href: `${API_URL}/customers/{id}`, name: "item", title: "Customers", templated: true },
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
          name: "name",
          title: "Name",
          type: "string",
          readOnly: false,
          _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {},
  },
  `${PROFILE_URL}/customers`,
  "customer",
);

function makeLinkedItem(id: string, name: string): EntityItem {
  const attributes = [
    {
      value: new EntityItemAttributePlain("name", name),
      profileAttribute: TARGET_PROFILE.getAttribute("name"),
    },
  ];
  return {
    id,
    canDelete: true,
    profileEntity: TARGET_PROFILE,
    halItem: { data: { id, name } },
    userDefinedAttributes: attributes,
    findAttribute: (attrName: string) => attributes.find((attr) => attr.value.name === attrName),
    selfLink: { href: `${API_URL}/customers/${id}` },
  } as unknown as EntityItem;
}

const toOneRelation = {
  name: "owner",
  canSet: true,
  canClear: true,
  profileRelation: { title: "Owner", getTargetProfile: () => TARGET_PROFILE },
} as unknown as EntityItemToOneRelation;

const toManyRelation = {
  name: "customers",
  canAdd: true,
  canClear: true,
  canUnlinkItem: true,
  profileRelation: { title: "Customers", getTargetProfile: () => TARGET_PROFILE },
} as unknown as EntityItemToManyRelation;

function makeItem(
  relations: Partial<{ toOne: EntityItemToOneRelation[]; toMany: EntityItemToManyRelation[] }>,
) {
  return {
    toOneRelations: relations.toOne ?? [],
    toManyRelations: relations.toMany ?? [],
  } as unknown as EntityItem;
}

function mockQueries() {
  const mutation = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };
  vi.mocked(useClearRelation).mockReturnValue(mutation as never);
  vi.mocked(useSetToOneRelation).mockReturnValue(mutation as never);
  vi.mocked(useAddToManyRelation).mockReturnValue(mutation as never);
  vi.mocked(useUnlinkRelation).mockReturnValue(mutation as never);
  vi.mocked(useDeleteRelationItem).mockReturnValue(mutation as never);
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    data: { items: [] },
  } as never);
  vi.mocked(useEntityItemToOneRelation).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    data: makeLinkedItem("c-1", "Acme Corp"),
  } as never);
  vi.mocked(useEntityItemToManyRelation).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    error: null,
    data: {
      isEmpty: false,
      items: [makeLinkedItem("c-2", "Globex")],
      totalItems: undefined,
      hasNext: false,
      hasPrevious: false,
    },
  } as never);
  vi.mocked(useEntityItemToManyRelationInfinite).mockReturnValue({
    isPending: true,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
  } as never);
  vi.mocked(useRelationLayout).mockReturnValue(relationLayoutForPane(undefined));
}

function renderRelations(item: EntityItem, props: { allowEdit?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={createApiClient(noopSupplier)}
          contentFetch={createContentClient(noopSupplier)}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <EntityItemRelations item={item} profiles={[TARGET_PROFILE]} {...props} />,
    {
      wrapper: Wrapper,
    },
  );
  // The to-many section starts collapsed; open it so its actions are in the DOM.
  fireEvent.click(screen.getByRole("button", { name: /customers/i }));
  return result;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("EntityItemRelations", () => {
  it("renders nothing for an item without relations", () => {
    mockQueries();
    const { container } = render(
      <EntityItemRelations item={makeItem({})} profiles={[TARGET_PROFILE]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Relations heading and both kinds of section, with edit actions by default", () => {
    mockQueries();
    renderRelations(makeItem({ toOne: [toOneRelation], toMany: [toManyRelation] }));

    expect(screen.getByRole("heading", { name: "Relations" })).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    // The to-one section is linked, so it offers Unlink; the to-many one Link, Unlink all, Unlink
    // and Delete.
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink all" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Unlink" }).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("passes allowEdit={false} down to both section kinds", () => {
    mockQueries();
    renderRelations(makeItem({ toOne: [toOneRelation], toMany: [toManyRelation] }), {
      allowEdit: false,
    });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getAllByText("Globex").length).toBeGreaterThan(0);
    for (const name of ["Link", "Unlink", "Unlink all", "Delete"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
