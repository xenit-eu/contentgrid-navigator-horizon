import {
  API,
  PROFILE_URL,
  createFixtureFetch,
  customerProfileBody,
  profileRootBody,
} from "./item-detail";

/**
 * A second entity for the preview view's content case: `document`, with a `title` and one content
 * attribute `file`. `doc-001` holds a PNG, `doc-002` holds no file (it falls back to attributes).
 * Every request answers from the base item-detail fixture's shapes; the file itself is served at
 * the item's `cg:content` link.
 */
export const DOCUMENT_PROFILE_URL = `${API}/profile/documents`;
export const DOCUMENT_COLLECTION_URL = `${API}/documents`;
export const DOCUMENT_ITEM_URL = `${DOCUMENT_COLLECTION_URL}/doc-001`;
export const DOCUMENT_ITEM_2_URL = `${DOCUMENT_COLLECTION_URL}/doc-002`;
export const DOCUMENT_FILE_URL = `${DOCUMENT_ITEM_URL}/file`;

/** The bytes of a 64x48 PNG (blue field, yellow disc, red block), so the browser (stories) can really draw the preview. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAoUlEQVR42u3YUQ2AMAxF0SrhGxHThDBEoAQlfIGCQdpH2mU3eQLuSfaz2rLtQ88AAAAAAAAAAJ1dxzoY4Cnury7gNf0PhqXUCw2WVa8yWGK9xGC59XGDpdcHDRMDhPURAwAAAGrUuw08IQAApgVoDWdrvs0NUBnc9QKA5EeWDIj/ifMBwatECUDkLlQF4L7M1QI4bqOlAV8GAAAAAAAAeHcDXOJJ911+SSAAAAAASUVORK5CYII=";

const subAttribute = (name: string, title: string, type: string) => ({
  name,
  title,
  type,
  description: null,
  readOnly: false,
  required: false,
  _embedded: {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": [],
  },
  _links: {},
});

const attributeFixtures = customerProfileBody._embedded["blueprint:attribute"];

export const documentProfileBody = {
  ...customerProfileBody,
  name: "document",
  title: "Document",
  _embedded: {
    ...customerProfileBody._embedded,
    "blueprint:attribute": [
      attributeFixtures[0],
      { ...attributeFixtures[1], name: "title", title: "Title" },
      {
        ...subAttribute("file", "File", "object"),
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [
            subAttribute("filename", "Filename", "string"),
            subAttribute("mimetype", "Mimetype", "string"),
            subAttribute("length", "Length", "long"),
          ],
        },
      },
    ],
  },
  _links: {
    ...customerProfileBody._links,
    self: { href: DOCUMENT_PROFILE_URL, title: "Document" },
    describes: [
      { href: DOCUMENT_COLLECTION_URL, title: "Documents", name: "collection" },
      { href: `${DOCUMENT_COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
  },
};

const rootBodyWithDocument = {
  ...profileRootBody,
  _links: {
    ...profileRootBody._links,
    "cg:entity": [
      ...profileRootBody._links["cg:entity"],
      { href: DOCUMENT_PROFILE_URL, name: "document", title: "Document" },
    ],
  },
};

const contentCuries = [
  { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
];

export const documentItemBody = {
  id: "doc-001",
  title: "Quarterly report",
  file: { filename: "report.png", mimetype: "image/png", length: 218 },
  _links: {
    self: { href: DOCUMENT_ITEM_URL },
    "cg:content": [{ href: DOCUMENT_FILE_URL, name: "file" }],
    curies: contentCuries,
  },
};

export const documentItem2Body = {
  id: "doc-002",
  title: "Empty draft",
  file: null,
  _links: {
    self: { href: DOCUMENT_ITEM_2_URL },
    "cg:content": [{ href: `${DOCUMENT_ITEM_2_URL}/file`, name: "file" }],
    curies: contentCuries,
  },
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/hal+json" } });

/** A fetch that answers the `document` entity (and the base fixture's `customer`) and serves the file. */
export function createContentFixtureFetch() {
  const base = createFixtureFetch();
  const requests: string[] = [];
  const fetchFn = async (input: Request | string | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
    if (url === PROFILE_URL) return json(rootBodyWithDocument);
    if (url === DOCUMENT_PROFILE_URL) return json(documentProfileBody);
    if (url === DOCUMENT_ITEM_URL) return json(documentItemBody);
    if (url === DOCUMENT_ITEM_2_URL) return json(documentItem2Body);
    if (url === DOCUMENT_FILE_URL) {
      const bytes = Uint8Array.from(atob(PNG_BASE64), (char) => char.codePointAt(0) ?? 0);
      return new Response(bytes, {
        headers: {
          "Content-Type": "image/png",
          "Content-Length": String(bytes.length),
          ETag: '"file-1"',
        },
      });
    }
    return base.fetch(input);
  };
  return { fetch: fetchFn, requests };
}
