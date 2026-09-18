import { describe, expect, it } from "vitest";
import { type LayoutRow, applyLayoutDrop } from "./apply-layout-drop";

function row(id: string, ...fieldNames: string[]): LayoutRow {
  return { id, fieldNames };
}

describe("applyLayoutDrop", () => {
  it("merges a field onto another single-field row, appending it after the existing field", () => {
    const rows = [row("r1", "name"), row("r2", "email"), row("r3", "phone")];
    const next = applyLayoutDrop(rows, "field:phone", "row:r2");
    expect(next).toEqual([row("r1", "name"), row("r2", "email", "phone")]);
  });

  it("returns the same reference when dropping onto an already-full row", () => {
    const rows = [row("r1", "name", "email"), row("r2", "phone")];
    const next = applyLayoutDrop(rows, "field:phone", "row:r1");
    expect(next).toBe(rows);
  });

  it("returns the same reference when dropping onto the field's own row", () => {
    const rows = [row("r1", "name"), row("r2", "email", "phone")];
    const next = applyLayoutDrop(rows, "field:phone", "row:r2");
    expect(next).toBe(rows);
  });

  it("returns the same reference for an unrecognized active id", () => {
    const rows = [row("r1", "name")];
    const next = applyLayoutDrop(rows, "row:r1", "row:r1");
    expect(next).toBe(rows);
  });

  it("returns the same reference for an unrecognized over id", () => {
    const rows = [row("r1", "name"), row("r2", "email")];
    const next = applyLayoutDrop(rows, "field:name", "sidebar:trash");
    expect(next).toBe(rows);
  });

  it("splits a two-up row apart when one field is dropped onto a gap", () => {
    const rows = [row("r1", "name", "email"), row("r2", "phone")];
    const next = applyLayoutDrop(rows, "field:email", "gap:2");
    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(row("r1", "name"));
    expect(next[1]).toEqual(row("r2", "phone"));
    expect(next[2].fieldNames).toEqual(["email"]);
    expect(next[2].id).not.toBe("r1");
  });

  it("reorders a full-width row via a gap drop, adjusting for the row it removed", () => {
    const rows = [row("r1", "name"), row("r2", "email"), row("r3", "phone")];
    // Drop "name" onto the gap after "phone" (index 3, before removal) — since row r1 (holding
    // "name") sits before that gap, the effective insertion point shifts down by one once r1 is
    // removed, landing it at the very end.
    const next = applyLayoutDrop(rows, "field:name", "gap:3");
    expect(next.map((r) => r.fieldNames)).toEqual([["email"], ["phone"], ["name"]]);
  });

  it("inserts at the front when dropped onto the leading gap", () => {
    const rows = [row("r1", "name"), row("r2", "email"), row("r3", "phone")];
    const next = applyLayoutDrop(rows, "field:phone", "gap:0");
    expect(next.map((r) => r.fieldNames)).toEqual([["phone"], ["name"], ["email"]]);
  });
});
