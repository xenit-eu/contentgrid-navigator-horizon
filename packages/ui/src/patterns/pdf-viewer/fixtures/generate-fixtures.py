#!/usr/bin/env python3
"""Generate tiny, valid PDF fixtures for the PdfViewer pattern's stories and
tests (specs/002-pdf-viewer, T003).

Hand-built raw PDF syntax with a correct cross-reference table -- no external
PDF library, so the fixtures have no build-time dependency and every byte is
inspectable in a text editor.

Run: python3 generate-fixtures.py
Produces, next to this script:
  - minimal.pdf    1-page PDF containing the text "Hello".
  - js-in-pdf.pdf  1-page PDF whose /OpenAction runs `app.alert('x')` -- used
                   by the `JsInPdf` story to prove the PDFium/WASM engine
                   never executes embedded JavaScript (FR-026).
"""

from pathlib import Path


def build_pdf(catalog_extra: str, content_text: str) -> bytes:
    """Assemble a single-page PDF as five indirect objects (catalog, pages,
    page, content stream, font) and a matching xref table. `catalog_extra` is
    inserted verbatim into the /Catalog dictionary (e.g. an /OpenAction)."""
    objects = [
        f"<< /Type /Catalog /Pages 2 0 R{catalog_extra} >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
            "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
        ),
    ]
    stream = f"BT /F1 24 Tf 20 100 Td ({content_text}) Tj ET"
    objects.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = bytearray()
    out += b"%PDF-1.4\n"
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode("ascii")
        out += body.encode("ascii")
        out += b"\nendobj\n"

    xref_offset = len(out)
    count = len(objects) + 1  # +1 for the free-list head (object 0)
    out += f"xref\n0 {count}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {count} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF"
    ).encode("ascii")
    return bytes(out)


def main() -> None:
    fixtures_dir = Path(__file__).parent

    minimal = build_pdf(catalog_extra="", content_text="Hello")
    (fixtures_dir / "minimal.pdf").write_bytes(minimal)

    js_in_pdf = build_pdf(
        catalog_extra=" /OpenAction << /S /JavaScript /JS (app.alert('x')) >>",
        content_text="Hello",
    )
    (fixtures_dir / "js-in-pdf.pdf").write_bytes(js_in_pdf)

    print(f"Wrote {fixtures_dir / 'minimal.pdf'} ({len(minimal)} bytes)")
    print(f"Wrote {fixtures_dir / 'js-in-pdf.pdf'} ({len(js_in_pdf)} bytes)")


if __name__ == "__main__":
    main()
