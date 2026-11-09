import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributePlain,
  type EntityItemToOneRelation,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useClearRelation,
  useEntityItemToOneRelation,
  useSetToOneRelation,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { relationLayoutForPane, useRelationLayout } from "./relation-layout";
import { RelationToOneSection } from "./relation-to-one-section";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useEntityItemToOneRelation: vi.fn(),
    useClearRelation: vi.fn(),
    useSetToOneRelation: vi.fn(),
  };
});

vi.mock("./relation-layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./relation-layout")>();
  return { ...actual, useRelationLayout: vi.fn() };
});

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const noopSupplier: AuthenticationTokenSupplier = async () => null;

function stringAttribute(name: string, title: string) {
  return {
    name,
    title,
    type: "string",
    readOnly: false,
    _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
    _links: {},
  };
}

/** Customers: `name` becomes the reference title (the first string attribute, by default). */
const CUSTOMER_PROFILE = makeProfileEntity(
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
        stringAttribute("name", "Name"),
        stringAttribute("email", "Email"),
        stringAttribute("city", "City"),
      ],
      "blueprint:relation": [],
    },
    _templates: {},
  },
  `${PROFILE_URL}/customers`,
  "customer",
);

function makeCustomer(): EntityItem {
  const values = { name: "Acme Corp", email: "info@acme.test", city: "Ghent" };
  const attributes = Object.entries(values).map(([name, value]) => ({
    value: new EntityItemAttributePlain(name, value),
    profileAttribute: CUSTOMER_PROFILE.getAttribute(name),
  }));
  return {
    id: "c-1",
    profileEntity: CUSTOMER_PROFILE,
    userDefinedAttributes: attributes,
    findAttribute: (name: string) => attributes.find((attr) => attr.value.name === name),
  } as unknown as EntityItem;
}

function makeRelation(): EntityItemToOneRelation {
  return {
    name: "customer",
    canSet: true,
    canClear: true,
    profileRelation: { title: "Customer", getTargetProfile: () => CUSTOMER_PROFILE },
  } as unknown as EntityItemToOneRelation;
}

function mockLinkedItem(item: EntityItem | null) {
  vi.mocked(useEntityItemToOneRelation).mockReturnValue({
    isPending: false,
    isSuccess: true,
    isError: false,
    data: item,
  } as unknown as ReturnType<typeof useEntityItemToOneRelation>);
  vi.mocked(useClearRelation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useClearRelation>);
  vi.mocked(useSetToOneRelation).mockReturnValue({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useSetToOneRelation>);
}

function renderSection(
  paneWidth: number | undefined,
  props: Partial<Parameters<typeof RelationToOneSection>[0]> = {},
) {
  vi.mocked(useRelationLayout).mockReturnValue(
    relationLayoutForPane(
      paneWidth === undefined ? undefined : { side: "right", width: paneWidth },
    ),
  );
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

  // Unlike the to-many section, a to-one section starts expanded — no click needed.
  return render(
    <RelationToOneSection relation={makeRelation()} profiles={[CUSTOMER_PROFILE]} {...props} />,
    { wrapper: Wrapper },
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RelationToOneSection", () => {
  it("in a narrow pane, shows only the linked item's reference", () => {
    mockLinkedItem(makeCustomer());
    renderSection(320);

    expect(screen.getByRole("button", { name: /acme corp/i })).toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Ghent")).not.toBeInTheDocument();
  });

  it("with more width, adds further attributes but not the one the reference already shows", () => {
    mockLinkedItem(makeCustomer());
    renderSection(700);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("info@acme.test")).toBeInTheDocument();
    expect(screen.getByText("Ghent")).toBeInTheDocument();
    // "Name" is the reference's title, so it isn't repeated as an attribute label.
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
  });

  it("outside a resizable pane, shows the attributes too", () => {
    mockLinkedItem(makeCustomer());
    renderSection(undefined);

    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("calls onItemClick when the reference is clicked", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    mockLinkedItem(makeCustomer());
    renderSection(320, { onItemClick });

    await user.click(screen.getByRole("button", { name: /acme corp/i }));

    expect(onItemClick).toHaveBeenCalledWith("customer", "c-1");
  });

  it("shows the empty state when nothing is linked", () => {
    mockLinkedItem(null);
    renderSection(320);

    expect(screen.getByText("No item linked")).toBeInTheDocument();
  });
});
