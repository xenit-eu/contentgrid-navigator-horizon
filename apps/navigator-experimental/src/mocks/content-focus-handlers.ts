import { HttpResponse, http } from "msw";
import {
  createContentDownloadHandler,
  createEntityHandler,
  createProfileHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";

/**
 * The real `minimal.pdf` fixture (`packages/ui/src/patterns/pdf-viewer/fixtures/minimal.pdf`,
 * one page, "Hello") base64-encoded — embedded directly rather than imported via a `?url`/`?raw`
 * Vite suffix so this dev-only handler needs no ambient module declaration in this app's
 * `vite-env.d.ts` for a one-off binary fixture. A genuinely valid PDF (not a placeholder byte
 * sequence) so the real `PdfViewer` engine renders it correctly when someone opens this item in
 * the dev server.
 */
const MINIMAL_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNiA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDIwIDEwMCBUZCAoSGVsbG8pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzI3IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMzk3CiUlRU9G";

/**
 * The real `apps/navigator/tests/e2e/fixtures/twenty-pages.pdf` fixture (20 pages, committed
 * for the original navigator's e2e suite) base64-encoded — a second demo item alongside
 * `doc-1`'s single-page fixture, specifically so `content-focus.spec.ts` can exercise genuine
 * multi-page navigation (next page, page count) and zoom against a real multi-page document
 * instead of a synthetic one-pager.
 */
const TWENTY_PAGES_PDF_BASE64 =
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFs0IDAgUiA2IDAgUiA4IDAgUiAxMCAwIFIgMTIgMCBSIDE0IDAgUiAxNiAwIFIgMTggMCBSIDIwIDAgUiAyMiAwIFIgMjQgMCBSIDI2IDAgUiAyOCAwIFIgMzAgMCBSIDMyIDAgUiAzNCAwIFIgMzYgMCBSIDM4IDAgUiA0MCAwIFIgNDIgMCBSXSAvQ291bnQgMjAgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago0IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDUgMCBSID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago2IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDcgMCBSID4+CmVuZG9iago3IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDkgMCBSID4+CmVuZG9iago5IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxMCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMSAwIFIgPj4KZW5kb2JqCjExIDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgNCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxMiAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxMyAwIFIgPj4KZW5kb2JqCjEzIDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgNSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxNCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNSAwIFIgPj4KZW5kb2JqCjE1IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgNikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxNiAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxNyAwIFIgPj4KZW5kb2JqCjE3IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgNykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxOCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAxOSAwIFIgPj4KZW5kb2JqCjE5IDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgOCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoyMCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAyMSAwIFIgPj4KZW5kb2JqCjIxIDAgb2JqCjw8IC9MZW5ndGggMzggPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgOSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoyMiAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAyMyAwIFIgPj4KZW5kb2JqCjIzIDAgb2JqCjw8IC9MZW5ndGggMzkgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMTApIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMjUgMCBSID4+CmVuZG9iagoyNSAwIG9iago8PCAvTGVuZ3RoIDM5ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzAwIFRkIChQYWdlIDExKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjI2IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDI3IDAgUiA+PgplbmRvYmoKMjcgMCBvYmoKPDwgL0xlbmd0aCAzOSA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDcwMCBUZCAoUGFnZSAxMikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoyOCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAyOSAwIFIgPj4KZW5kb2JqCjI5IDAgb2JqCjw8IC9MZW5ndGggMzkgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMTMpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMzAgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMzEgMCBSID4+CmVuZG9iagozMSAwIG9iago8PCAvTGVuZ3RoIDM5ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzAwIFRkIChQYWdlIDE0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjMyIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDMzIDAgUiA+PgplbmRvYmoKMzMgMCBvYmoKPDwgL0xlbmd0aCAzOSA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDcwMCBUZCAoUGFnZSAxNSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagozNCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyAzNSAwIFIgPj4KZW5kb2JqCjM1IDAgb2JqCjw8IC9MZW5ndGggMzkgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMTYpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMzYgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgMzcgMCBSID4+CmVuZG9iagozNyAwIG9iago8PCAvTGVuZ3RoIDM5ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzAwIFRkIChQYWdlIDE3KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjM4IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMyAwIFIgPj4gPj4gL0NvbnRlbnRzIDM5IDAgUiA+PgplbmRvYmoKMzkgMCBvYmoKPDwgL0xlbmd0aCAzOSA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDcwMCBUZCAoUGFnZSAxOCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago0MCAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDMgMCBSID4+ID4+IC9Db250ZW50cyA0MSAwIFIgPj4KZW5kb2JqCjQxIDAgb2JqCjw8IC9MZW5ndGggMzkgPj4Kc3RyZWFtCkJUCi9GMSAyNCBUZgo3MiA3MDAgVGQgKFBhZ2UgMTkpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNDIgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAzIDAgUiA+PiA+PiAvQ29udGVudHMgNDMgMCBSID4+CmVuZG9iago0MyAwIG9iago8PCAvTGVuZ3RoIDM5ID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzAwIFRkIChQYWdlIDIwKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA0NAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NCAwMDAwMCBuIAowMDAwMDAwMjUzIDAwMDAwIG4gCjAwMDAwMDAzMjMgMDAwMDAgbiAKMDAwMDAwMDQ0OSAwMDAwMCBuIAowMDAwMDAwNTM2IDAwMDAwIG4gCjAwMDAwMDA2NjIgMDAwMDAgbiAKMDAwMDAwMDc0OSAwMDAwMCBuIAowMDAwMDAwODc1IDAwMDAwIG4gCjAwMDAwMDA5NjIgMDAwMDAgbiAKMDAwMDAwMTA5MCAwMDAwMCBuIAowMDAwMDAxMTc4IDAwMDAwIG4gCjAwMDAwMDEzMDYgMDAwMDAgbiAKMDAwMDAwMTM5NCAwMDAwMCBuIAowMDAwMDAxNTIyIDAwMDAwIG4gCjAwMDAwMDE2MTAgMDAwMDAgbiAKMDAwMDAwMTczOCAwMDAwMCBuIAowMDAwMDAxODI2IDAwMDAwIG4gCjAwMDAwMDE5NTQgMDAwMDAgbiAKMDAwMDAwMjA0MiAwMDAwMCBuIAowMDAwMDAyMTcwIDAwMDAwIG4gCjAwMDAwMDIyNTggMDAwMDAgbiAKMDAwMDAwMjM4NiAwMDAwMCBuIAowMDAwMDAyNDc1IDAwMDAwIG4gCjAwMDAwMDI2MDMgMDAwMDAgbiAKMDAwMDAwMjY5MiAwMDAwMCBuIAowMDAwMDAyODIwIDAwMDAwIG4gCjAwMDAwMDI5MDkgMDAwMDAgbiAKMDAwMDAwMzAzNyAwMDAwMCBuIAowMDAwMDAzMTI2IDAwMDAwIG4gCjAwMDAwMDMyNTQgMDAwMDAgbiAKMDAwMDAwMzM0MyAwMDAwMCBuIAowMDAwMDAzNDcxIDAwMDAwIG4gCjAwMDAwMDM1NjAgMDAwMDAgbiAKMDAwMDAwMzY4OCAwMDAwMCBuIAowMDAwMDAzNzc3IDAwMDAwIG4gCjAwMDAwMDM5MDUgMDAwMDAgbiAKMDAwMDAwMzk5NCAwMDAwMCBuIAowMDAwMDA0MTIyIDAwMDAwIG4gCjAwMDAwMDQyMTEgMDAwMDAgbiAKMDAwMDAwNDMzOSAwMDAwMCBuIAowMDAwMDA0NDI4IDAwMDAwIG4gCjAwMDAwMDQ1NTYgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA0NCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDY0NQolJUVPRgo=";

function decodeBase64Pdf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function requireBearer(url: string) {
  return http.get(url, ({ request }) => {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return HttpResponse.json(
        { type: "https://contentgrid.cloud/problems/unauthorized", status: 401 },
        { status: 401, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    return undefined; // authorized — fall through to the resource handler below
  });
}

/**
 * Dev-only demo data for the content-focus feature (spec `002-pdf-viewer`): one "document"
 * entity with a single content attribute (`file`) and one item that already holds a PDF, so
 * `EntityItemContentFocusView` has something to render in this app's dev server without a real
 * backend.
 *
 * Registered BEFORE `createDemoHandlers()` in `browser.ts` — this module's own `/profile` root
 * response lists both `cg:entity` links (`invoice`, from the shared fixture, and `document`, from
 * here), so it must win the match over the shared fixture's invoice-only one. The shared
 * `packages/navigator-data/test-fixtures/msw/demo-handlers.ts` (used by both apps) is not
 * modified — this file only adds to it, never replaces the invoice handlers apps/navigator's own
 * boot smoke test and this app's cursor-pagination e2e test depend on.
 */
export function createContentFocusDemoHandlers(baseUrl = "") {
  const profileUrl = `${baseUrl}/profile/documents`;
  const collectionUrl = `${baseUrl}/documents`;
  const itemUrl = `${collectionUrl}/doc-1`;
  const contentUrl = `${itemUrl}/file`;
  const pdfBytes = decodeBase64Pdf(MINIMAL_PDF_BASE64);
  // `doc-3`: the real twenty-pages.pdf fixture — see `content-focus.spec.ts` (T030), which needs
  // an actual multi-page document for its page-navigation and zoom assertions.
  const twentyPagesItemUrl = `${collectionUrl}/doc-3`;
  const twentyPagesContentUrl = `${twentyPagesItemUrl}/file`;
  const twentyPagesBytes = decodeBase64Pdf(TWENTY_PAGES_PDF_BASE64);

  const noConstraints = {
    "blueprint:constraint": [],
    "blueprint:search-param": [],
    "blueprint:attribute": [],
  };

  // A content attribute's `blueprint:attribute` shape (root CLAUDE.md: `type: "object"` with
  // embedded filename/mimetype/length children) — shared by both content attributes below
  // ("file" and "receipt") so `doc-3` can exercise `ContentAttributeSelector`, which only renders
  // once an item has more than one populated content attribute (`content-attribute-selector.tsx`).
  function contentAttributeSchema(name: string, title: string) {
    return {
      name,
      title,
      type: "object",
      description: null,
      readOnly: false,
      required: false,
      _embedded: {
        "blueprint:constraint": [],
        "blueprint:search-param": [],
        "blueprint:attribute": [
          {
            name: "filename",
            title: "Filename",
            type: "string",
            description: null,
            readOnly: false,
            required: false,
            _embedded: noConstraints,
            _links: {},
          },
          {
            name: "mimetype",
            title: "Mimetype",
            type: "string",
            description: null,
            readOnly: false,
            required: false,
            _embedded: noConstraints,
            _links: {},
          },
          {
            name: "length",
            title: "Length",
            type: "long",
            description: null,
            readOnly: false,
            required: false,
            _embedded: noConstraints,
            _links: {},
          },
        ],
      },
      _links: {},
    };
  }

  const profileBody = {
    name: "document",
    title: "Document",
    description: "A demo entity for the content-focus PDF viewer feature.",
    _embedded: {
      "blueprint:attribute": [
        contentAttributeSchema("file", "File"),
        contentAttributeSchema("receipt", "Receipt"),
      ],
      "blueprint:relation": [],
    },
    _links: {
      self: { href: profileUrl },
      describes: [
        { href: collectionUrl, name: "collection", title: "Documents" },
        { href: `${collectionUrl}/{id}`, name: "item", templated: true },
      ],
      curies: [
        {
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          name: "blueprint",
          templated: true,
        },
      ],
    },
  };

  const itemBody = {
    id: "doc-1",
    file: { filename: "minimal.pdf", mimetype: "application/pdf", length: pdfBytes.length },
    _links: {
      self: { href: itemUrl },
      "cg:content": [{ href: contentUrl, name: "file", title: "File" }],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
  };

  // `doc-3` also populates "receipt" (reusing doc-1's minimal.pdf bytes) alongside "file", so it
  // has two populated content attributes — the minimum `ContentAttributeSelector` needs to
  // render at all (`content-attribute-selector.tsx`: "renders nothing when at most one such
  // attribute exists").
  const receiptContentUrl = `${twentyPagesItemUrl}/receipt`;
  const twentyPagesItemBody = {
    id: "doc-3",
    file: {
      filename: "twenty-pages.pdf",
      mimetype: "application/pdf",
      length: twentyPagesBytes.length,
    },
    receipt: { filename: "minimal.pdf", mimetype: "application/pdf", length: pdfBytes.length },
    _links: {
      self: { href: twentyPagesItemUrl },
      "cg:content": [
        { href: twentyPagesContentUrl, name: "file", title: "File" },
        { href: receiptContentUrl, name: "receipt", title: "Receipt" },
      ],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
  };

  return [
    requireBearer(`${baseUrl}/profile`),
    http.get(`${baseUrl}/profile`, () =>
      HttpResponse.json({
        _links: {
          self: { href: `${baseUrl}/profile` },
          curies: [
            {
              name: "cg",
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              templated: true,
            },
          ],
          "cg:entity": [
            { href: `${baseUrl}/profile/invoices`, name: "invoice", title: "Invoice" },
            { href: profileUrl, name: "document", title: "Document" },
          ],
        },
      }),
    ),
    createProfileHandler({ url: profileUrl, body: profileBody, templates: {} }),
    createEntityHandler({ url: itemUrl, body: itemBody }),
    createContentDownloadHandler({
      url: contentUrl,
      body: pdfBytes,
      contentType: "application/pdf",
      filename: "minimal.pdf",
    }),
    createEntityHandler({ url: twentyPagesItemUrl, body: twentyPagesItemBody }),
    createContentDownloadHandler({
      url: twentyPagesContentUrl,
      body: twentyPagesBytes,
      contentType: "application/pdf",
      filename: "twenty-pages.pdf",
    }),
    createContentDownloadHandler({
      url: receiptContentUrl,
      body: pdfBytes,
      contentType: "application/pdf",
      filename: "minimal.pdf",
    }),
  ];
}
