/**
 * Tests for `EntityItemContentFocusView`'s own orchestration logic: the FR-001 layout branch,
 * default content-attribute selection, attribute-selector switching, and the default breadcrumb
 * trail's app-owned routing (Principle VIII: the view derives crumb LABELS from data it
 * resolved, but knows no routes of its own — clicking a crumb fires a plain callback the host
 * supplies; an omitted callback renders that crumb as plain text). `useProfileEntity`/
 * `useEntityItem` are mocked directly — the real HAL round trip they perform is already covered
 * by navigator-data's own hook tests (ADR-014); this view's job is choosing what to render from
 * their results, not re-proving the fetch itself. `ContentPreviewPanel` and
 * `ContentAttributeSelector` are mocked too, for the same reason (T027's own test already covers
 * the panel's real `useContentPreview` integration) and to avoid driving a Radix `Select`
 * popup through jsdom, which this repo has no established pattern for
 * (`packages/ui/src/primitives/select.test.tsx` never opens the popup either).
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributeContent,
  NavigatorDataProvider,
  type ProfileAttribute,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useEntityItem,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { EntityItemContentFocusView } from "./entity-item-content-focus-view";

const PROFILE_URL = "https://api.example.com/profile/order";
const noopSupplier: AuthenticationTokenSupplier = async () => null;

/**
 * Wraps in a real `NavigatorDataProvider` (no MSW/network involved — `useProfileEntity`/
 * `useEntityItem` are mocked below): `EntityItemView`'s `EntityItemReference` header (stable
 * `entity-item` feature) calls `useEntityDisplayPreferences`, which reads `useNavigatorData()`
 * directly, so any render of the FR-001 fallback body needs a provider in scope even though no
 * real fetch ever happens — same pattern as `entity-item/variations/entity-item-reference.test.tsx`.
 * No router context is needed here (unlike an earlier version of this test) — the view no
 * longer renders a `Link`; its default breadcrumbs are plain buttons/text driven by props.
 */
function renderView(children: ReactNode) {
  return render(
    <NavigatorDataProvider
      apiFetch={createApiClient(noopSupplier)}
      contentFetch={createContentClient(noopSupplier)}
      profileUrl={PROFILE_URL}
    >
      {children}
    </NavigatorDataProvider>,
  );
}

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useProfileEntity: vi.fn(),
    useEntityItem: vi.fn(),
    useLoadedProfileEntities: vi.fn(() => ({ profiles: [] })),
  };
});

vi.mock("../components/content-preview-panel", () => ({
  ContentPreviewPanel: (props: { attributeName: string; toolbarStart?: ReactNode }) => (
    <div>
      <div>content-preview-panel:{props.attributeName}</div>
      {props.toolbarStart}
    </div>
  ),
}));

vi.mock("../components/content-attribute-selector", () => ({
  ContentAttributeSelector: (props: { value: string; onChange: (name: string) => void }) => (
    <button type="button" onClick={() => props.onChange("receipt")}>
      switch to receipt (currently {props.value})
    </button>
  ),
}));

function makeProfileAttribute(name: string): ProfileAttribute {
  return { name, title: null, isContent: true } as unknown as ProfileAttribute;
}

function makeProfile(options: {
  hasContentAttributes: boolean;
  contentAttributeNames?: readonly string[];
}): ProfileEntity {
  const { hasContentAttributes, contentAttributeNames = [] } = options;
  const attributes = contentAttributeNames.map((name) => makeProfileAttribute(name));
  return {
    name: "order",
    pluralName: "Orders",
    hasContentAttributes,
    attributes,
    userDefinedAttributes: attributes,
    // `EntityItemView`'s `EntityItemReference` header (stable `entity-item` feature) calls
    // `useEntityDisplayPreferences`, which unconditionally calls `getDefaultPreferences()` on
    // whatever profile it's handed — this fake profile has no real heuristic to run, so it
    // stubs the method with an empty (all-optional) result rather than reimplementing
    // `ProfileEntity.getDefaultPreferences()`'s real name/icon-inference logic here.
    getDefaultPreferences: () => ({}),
  } as unknown as ProfileEntity;
}

function makeContentAttribute(name: string, hasFile: boolean) {
  return {
    value: new EntityItemAttributeContent(
      name,
      hasFile ? { filename: `${name}.pdf`, length: 1, mimetype: "application/pdf" } : null,
      { href: `https://api.example.com/orders/1/${name}` } as never,
    ),
    profileAttribute: makeProfileAttribute(name),
  };
}

function makeEntityItem(options: {
  profileEntity: ProfileEntity;
  contentAttrs?: readonly ReturnType<typeof makeContentAttribute>[];
}): EntityItem {
  const { profileEntity, contentAttrs = [] } = options;
  return {
    id: "1",
    etag: null,
    attributes: contentAttrs,
    userDefinedAttributes: contentAttrs,
    toOneRelations: [],
    toManyRelations: [],
    createdDate: undefined,
    modifiedDate: undefined,
    createdBy: undefined,
    modifiedBy: undefined,
    profileEntity,
  } as unknown as EntityItem;
}

function mockHooks(profileEntity: ProfileEntity, item: EntityItem) {
  vi.mocked(useProfileEntity).mockReturnValue({ data: profileEntity } as never);
  vi.mocked(useEntityItem).mockReturnValue({
    data: item,
    isPending: false,
    isError: false,
    isSuccess: true,
  } as never);
}

describe("EntityItemContentFocusView", () => {
  it("renders the existing EntityItemView body when the entity has no content attributes (FR-001)", () => {
    const profile = makeProfile({ hasContentAttributes: false });
    const item = makeEntityItem({ profileEntity: profile });
    mockHooks(profile, item);

    const { container } = renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    // EntityItemView's own item-reference header (`data-slot="item-reference"`), rendered by its
    // "toolbar={false}" body.
    expect(container.querySelector('[data-slot="item-reference"]')).not.toBeNull();
    expect(screen.queryByText(/content-preview-panel:/)).not.toBeInTheDocument();
  });

  it("renders the content-focus layout, defaulting to the first content attribute that holds a file", async () => {
    const profile = makeProfile({
      hasContentAttributes: true,
      contentAttributeNames: ["document", "receipt"],
    });
    const item = makeEntityItem({
      profileEntity: profile,
      contentAttrs: [
        makeContentAttribute("document", false),
        makeContentAttribute("receipt", true),
      ],
    });
    mockHooks(profile, item);

    renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    expect(await screen.findByText("content-preview-panel:receipt")).toBeInTheDocument();
    expect(screen.queryByText("Entity Detail")).not.toBeInTheDocument();
  });

  it("prefers the earlier content attribute in profile order when both hold a file", async () => {
    const profile = makeProfile({
      hasContentAttributes: true,
      contentAttributeNames: ["document", "receipt"],
    });
    const item = makeEntityItem({
      profileEntity: profile,
      contentAttrs: [makeContentAttribute("document", true), makeContentAttribute("receipt", true)],
    });
    mockHooks(profile, item);

    renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    expect(await screen.findByText("content-preview-panel:document")).toBeInTheDocument();
  });

  it("switches the previewed attribute when the selector fires onChange, resetting the panel", async () => {
    const profile = makeProfile({
      hasContentAttributes: true,
      contentAttributeNames: ["document", "receipt"],
    });
    const item = makeEntityItem({
      profileEntity: profile,
      contentAttrs: [makeContentAttribute("document", true), makeContentAttribute("receipt", true)],
    });
    mockHooks(profile, item);

    renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    expect(await screen.findByText("content-preview-panel:document")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /switch to receipt/ }));

    expect(await screen.findByText("content-preview-panel:receipt")).toBeInTheDocument();
    expect(screen.queryByText("content-preview-panel:document")).not.toBeInTheDocument();
  });

  it("builds default breadcrumb LABELS from the profile (Home / plural name / item id) when the host supplies none", () => {
    const profile = makeProfile({ hasContentAttributes: false });
    const item = makeEntityItem({ profileEntity: profile });
    mockHooks(profile, item);

    renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    // The plural display title from the profile, not the raw entityName ("order").
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    // `BreadcrumbPage` renders the current page as `role="link"` too (ui-library convention) —
    // scoped by that role, not `getByText`, since the item id ("1") also appears in
    // `EntityItemView`'s own `<h1>` heading below.
    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
  });

  it("renders Home/collection crumbs as plain, non-interactive text when no click callbacks are supplied (Principle VIII: the view has no route knowledge of its own)", () => {
    const profile = makeProfile({ hasContentAttributes: false });
    const item = makeEntityItem({ profileEntity: profile });
    mockHooks(profile, item);

    renderView(<EntityItemContentFocusView entityName="order" itemId="1" />);

    expect(screen.queryByRole("button", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
  });

  it("renders Home/collection crumbs as interactive buttons and fires onHomeClick/onCollectionClick when supplied by the host", () => {
    const profile = makeProfile({ hasContentAttributes: false });
    const item = makeEntityItem({ profileEntity: profile });
    mockHooks(profile, item);

    const onHomeClick = vi.fn();
    const onCollectionClick = vi.fn();

    renderView(
      <EntityItemContentFocusView
        entityName="order"
        itemId="1"
        onHomeClick={onHomeClick}
        onCollectionClick={onCollectionClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHomeClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    // Called with the profile's `name` (routing identifier), not the displayed `pluralName`.
    expect(onCollectionClick).toHaveBeenCalledWith("order");
  });
});
