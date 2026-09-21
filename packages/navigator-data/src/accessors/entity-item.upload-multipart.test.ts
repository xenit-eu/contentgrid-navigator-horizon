// @vitest-environment node
//
// jsdom's Request/FormData round-trip doesn't reliably preserve the per-part filename (see the
// jsdom-limitation comment in entity-item.test.ts's "uploadContentRequest" describe block, which
// spies on FormData construction instead of decoding the body for that reason). This file runs
// under Node's native (undici-backed) Request/FormData implementation instead, so it can decode
// the real multipart body `uploadContentRequest` builds and confirm special-character filenames
// survive an actual encode/decode round-trip — not just that `FormData.append` was called right.
import { describe, expect, it } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { EntityItem } from "./entity-item";
import ProfileEntity from "./entity-profile";

const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";
const CONTENT_URL = "https://api.example.com/invoices/inv-001/document";

function makeProfileEntity(): ProfileEntity {
  const json = {
    name: "invoice",
    description: "",
    _links: {
      self: { href: "/profile/invoices" },
      describes: [
        { href: "/invoices", name: "collection" },
        { href: "/invoices/{id}", name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject<ProfileEntityShape>(
    json as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity({ href: "/profile/invoices", name: "invoice" } as unknown as Link, hal);
}

function makeEntityItemWithContentLink(): EntityItem {
  const json = {
    id: "inv-001",
    document: { filename: "file.pdf", mimetype: "application/pdf", length: 1024 },
    _links: {
      self: { href: "/invoices/inv-001" },
      [CG_CONTENT_REL]: [{ href: CONTENT_URL, name: "document" }],
    },
  };
  const hal = new HalObject<EntityItemShape>(json as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, makeProfileEntity(), '"v1"');
}

describe("EntityItem — uploadContentRequest multipart round-trip (real undici, not jsdom)", () => {
  it("preserves a filename with an embedded quote through actual multipart encode/decode", async () => {
    const item = makeEntityItemWithContentLink();
    const specialName = 'say "hello".txt';
    const file = new File(["hello"], specialName, { type: "text/plain" });

    const req = item.uploadContentRequest("document", file);
    const decoded = await req.formData();
    const part = decoded.get("file") as File;

    expect(part.name).toBe(specialName);
    expect(await part.text()).toBe("hello");
  });

  it("preserves a UTF-8 filename through actual multipart encode/decode", async () => {
    const item = makeEntityItemWithContentLink();
    const utf8Name = "café-résumé-日本語.pdf";
    const file = new File(["%PDF-1.4"], utf8Name, { type: "application/pdf" });

    const req = item.uploadContentRequest("document", file);
    const decoded = await req.formData();
    const part = decoded.get("file") as File;

    expect(part.name).toBe(utf8Name);
  });
});
