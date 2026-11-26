import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const appsDir = resolve(import.meta.dirname, "../..");
const source = readFileSync(resolve(appsDir, "navigator/public/theme-init.js"), "utf8");

function runScript() {
  // Indirect eval: runs in global scope like a classic <script>.
  (0, eval)(source);
}

function mockDarkSystem(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
  }));
}

const root = document.documentElement;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  root.className = "";
  root.style.colorScheme = "";
});

describe("theme-init.js", () => {
  it.each([
    ["dark", "dark", "light"],
    ["light", "light", "dark"],
  ])("applies a stored %s theme", (stored, applied, removed) => {
    localStorage.setItem("theme", stored);
    root.classList.add(removed);
    mockDarkSystem(removed === "dark");
    runScript();
    expect(root.classList.contains(applied)).toBe(true);
    expect(root.classList.contains(removed)).toBe(false);
    expect(root.style.colorScheme).toBe(applied);
  });

  it.each([
    [true, "dark"],
    [false, "light"],
  ])("resolves a stored system theme with dark=%s to %s", (dark, expected) => {
    localStorage.setItem("theme", "system");
    mockDarkSystem(dark);
    runScript();
    expect(root.classList.contains(expected)).toBe(true);
    expect(root.style.colorScheme).toBe(expected);
  });

  it.each([
    [true, "dark"],
    [false, "light"],
  ])("falls back to the system theme when nothing is stored (dark=%s)", (dark, expected) => {
    mockDarkSystem(dark);
    runScript();
    expect(root.className).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
  });

  it("does nothing when storage throws", () => {
    mockDarkSystem(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(runScript).not.toThrow();
    expect(root.className).toBe("");
    expect(root.style.colorScheme).toBe("");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem("theme", "sepia");
    mockDarkSystem(true);
    runScript();
    expect(root.className).toBe("");
  });

  it("is identical in both apps", () => {
    const experimental = readFileSync(
      resolve(appsDir, "navigator-experimental/public/theme-init.js"),
      "utf8",
    );
    expect(experimental).toBe(source);
  });
});
