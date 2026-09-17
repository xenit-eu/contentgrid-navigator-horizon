#!/usr/bin/env python3
"""Generates the committed PDF fixtures for spec 002-pdf-viewer (T003), by hand,
with no third-party PDF library — plain PDF 1.4 object syntax and a correctly
computed cross-reference (xref) table, built with only the Python 3 standard
library.

Regenerate with:

    python3 packages/navigator-data/test-fixtures/pdf/generate-fixtures.py

Writes:
    packages/navigator-data/test-fixtures/pdf/minimal.pdf
        1 page, the text "Hello" — the baseline "valid PDF, no scripting" fixture
        (`content-mimetype`/`use-content-preview` tests, and the `@contentgrid/ui`
        pdf-viewer stories per contracts/pdf-viewer-pattern.md).
    packages/navigator-data/test-fixtures/pdf/js-in-pdf.pdf
        1 page, the same visible text, but the document Catalog carries an
        `/OpenAction` that runs `app.alert('x')` via `/S /JavaScript` — proves the
        FR-026/SC-005 "document scripting disabled in the engine" posture: the
        viewer must render this without ever showing that dialog.
    apps/navigator/tests/e2e/fixtures/twenty-pages.pdf
        20 pages, each showing "Page N" (1-indexed) — for the e2e page-navigation
        scenario (SC-001) and to stand alongside the existing `fixtures/Bob.pdf`.

Every generated file starts with `%PDF-1.4` and ends with `%%EOF`; the xref
table's byte offsets are computed from the actual bytes written, not guessed.
"""

from __future__ import annotations

import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]


def _content_stream(text: str) -> bytes:
    """A page content stream: one `Tj` text-show operation displaying `text`."""
    escaped = text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    ops = ["BT", "/F1 24 Tf", f"72 700 Td ({escaped}) Tj", "ET"]
    return ("\n".join(ops) + "\n").encode("latin-1")


def build_pdf(page_texts: list[str], *, open_action_js: str | None = None) -> bytes:
    """
    Builds a complete, valid PDF with one page per entry in `page_texts`.

    Object layout (classic, non-compressed, one indirect object per line):
      1: Catalog (+ /OpenAction when `open_action_js` is given)
      2: Pages (kids = one Page object per page, in order)
      3: Font (Helvetica, shared by every page)
      4..4+2N-1: for each page, a Page object followed by its content-stream object

    Returns the full PDF file as bytes, including header, body, xref, and trailer.
    """
    n_pages = len(page_texts)
    font_obj_num = 3
    first_page_obj_num = 4
    # Each page contributes two objects (Page, then its Contents stream), interleaved.
    page_obj_nums = [first_page_obj_num + 2 * i for i in range(n_pages)]
    content_obj_nums = [num + 1 for num in page_obj_nums]
    total_objects = 3 + 2 * n_pages  # Catalog, Pages, Font, then page+content pairs

    kids = " ".join(f"{num} 0 R" for num in page_obj_nums)

    catalog_extra = ""
    if open_action_js is not None:
        escaped_js = open_action_js.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        catalog_extra = f" /OpenAction << /S /JavaScript /JS ({escaped_js}) >>"

    objects: dict[int, bytes] = {}
    objects[1] = f"<< /Type /Catalog /Pages 2 0 R{catalog_extra} >>".encode("latin-1")
    objects[2] = f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode("latin-1")
    objects[font_obj_num] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    for page_obj_num, content_obj_num, text in zip(page_obj_nums, content_obj_nums, page_texts):
        stream = _content_stream(text)
        objects[page_obj_num] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> "
            f"/Contents {content_obj_num} 0 R >>"
        ).encode("latin-1")
        objects[content_obj_num] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"endstream"
        )

    assert set(objects.keys()) == set(range(1, total_objects + 1)), "object numbering gap"

    # --- Assemble the file, recording each object's byte offset as we go. ---
    buf = bytearray()
    buf += b"%PDF-1.4\n"
    # A binary-marker comment (4+ bytes >= 0x80) is conventional so tools treat the file
    # as binary; harmless for our hand-rolled parser/xref below.
    buf += b"%\xe2\xe3\xcf\xd3\n"

    offsets: dict[int, int] = {}
    for obj_num in range(1, total_objects + 1):
        offsets[obj_num] = len(buf)
        buf += f"{obj_num} 0 obj\n".encode("latin-1")
        buf += objects[obj_num]
        buf += b"\nendobj\n"

    xref_offset = len(buf)
    buf += f"xref\n0 {total_objects + 1}\n".encode("latin-1")
    buf += b"0000000000 65535 f \n"
    for obj_num in range(1, total_objects + 1):
        buf += f"{offsets[obj_num]:010d} 00000 n \n".encode("latin-1")

    buf += (
        f"trailer\n<< /Size {total_objects + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    ).encode("latin-1")

    return bytes(buf)


def verify(path: pathlib.Path) -> None:
    """Minimal, dependency-free structural sanity check (not a substitute for a real
    PDF parser, but enough to catch an offset/object-count mistake before committing)."""
    data = path.read_bytes()
    assert data.startswith(b"%PDF-1."), f"{path}: missing %PDF header"
    assert data.rstrip(b"\n").endswith(b"%%EOF"), f"{path}: missing %%EOF trailer"

    xref_pos = data.rindex(b"startxref")
    xref_offset = int(data[xref_pos:].split(b"\n")[1])
    assert data[xref_offset : xref_offset + 4] == b"xref", (
        f"{path}: startxref does not point at the xref table (offset {xref_offset})"
    )

    # Confirm every "N 0 obj" entry's recorded offset in the xref table lands exactly on
    # that object's own "N 0 obj" line.
    xref_block = data[xref_offset:].split(b"trailer")[0]
    xref_lines = xref_block.strip().split(b"\n")[2:]  # skip "xref" and the "0 N" subsection header
    for i, line in enumerate(xref_lines[1:], start=1):  # entry 0 is the free-list head
        offset = int(line[:10])
        if line.strip().endswith(b"f"):
            continue  # free entries (only object 0 here) have no object body to check
        expected_prefix = f"{i} 0 obj".encode("latin-1")
        actual = data[offset : offset + len(expected_prefix)]
        assert actual == expected_prefix, (
            f"{path}: xref offset for object {i} is wrong "
            f"(points at {actual!r}, expected {expected_prefix!r})"
        )
    print(f"OK  {path.relative_to(REPO_ROOT)}  ({len(data):,} bytes)")


def main() -> None:
    fixtures_dir = REPO_ROOT / "packages/navigator-data/test-fixtures/pdf"
    e2e_fixtures_dir = REPO_ROOT / "apps/navigator/tests/e2e/fixtures"

    minimal = fixtures_dir / "minimal.pdf"
    minimal.write_bytes(build_pdf(["Hello"]))
    verify(minimal)

    js_in_pdf = fixtures_dir / "js-in-pdf.pdf"
    js_in_pdf.write_bytes(build_pdf(["Hello"], open_action_js="app.alert('x')"))
    verify(js_in_pdf)

    twenty_pages = e2e_fixtures_dir / "twenty-pages.pdf"
    twenty_pages.write_bytes(build_pdf([f"Page {n}" for n in range(1, 21)]))
    verify(twenty_pages)


if __name__ == "__main__":
    main()
