import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

const ID_ATTRIBUTE = {
  name: "id",
  title: "id",
  type: "string",
  description: "",
  readOnly: true,
  required: false,
  _embedded: {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": [],
  },
  _links: {},
};

export interface EntityFixture {
  readonly name: string;
  readonly plural: string;
  readonly title: string;
  readonly description?: string;
  readonly creatable: boolean;
}

/** MSW handlers for a profile root listing `entities`, plus each entity's profile. */
export function profileHandlers(entities: readonly EntityFixture[]) {
  return [
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          curies: [
            {
              name: "cg",
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              templated: true,
            },
          ],
          "cg:entity": entities.map((entity) => ({
            href: `${PROFILE_URL}/${entity.plural}`,
            name: entity.name,
            title: entity.title,
          })),
        },
      }),
    ),
    ...entities.map((entity) =>
      http.get(`${PROFILE_URL}/${entity.plural}`, () =>
        HttpResponse.json({
          name: entity.name,
          title: entity.title,
          description: entity.description ?? "",
          _links: {
            self: { href: `${PROFILE_URL}/${entity.plural}` },
            describes: [
              { href: `${API_URL}/${entity.plural}`, name: "collection" },
              { href: `${API_URL}/${entity.plural}/{id}`, name: "item", templated: true },
            ],
            curies: [
              {
                href: "https://contentgrid.cloud/rels/blueprint/{rel}",
                name: "blueprint",
                templated: true,
              },
            ],
          },
          _embedded: { "blueprint:attribute": [ID_ATTRIBUTE], "blueprint:relation": [] },
          _templates: entity.creatable
            ? {
                "create-form": {
                  method: "POST",
                  target: `${API_URL}/${entity.plural}`,
                  contentType: "application/json",
                  properties: [],
                },
              }
            : {},
        }),
      ),
    ),
  ];
}

export function renderWithNavigatorData(ui: ReactNode) {
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

  return render(ui, { wrapper: Wrapper });
}
