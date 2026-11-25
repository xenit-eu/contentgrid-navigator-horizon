/*
 * Applies the stored theme before the first paint, mirroring what next-themes does on mount
 * (attribute="class", storage key "theme", defaultTheme "system", color-scheme handling), so React's
 * mount changes nothing. Loaded as a classic blocking script from <head>; a file rather than an inline
 * script so it works under a CSP that forbids inline scripts.
 * Keep identical in apps/navigator/public and apps/navigator-experimental/public (enforced by a test).
 */
/* global localStorage, window, document */
(function () {
  try {
    var stored = localStorage.getItem("theme") || "system";
    var resolved =
      stored === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : stored;
    if (resolved !== "dark" && resolved !== "light") return;
    var root = document.documentElement;
    root.classList.remove(resolved === "dark" ? "light" : "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch {
    // storage or matchMedia unavailable: leave the document untouched
  }
})();
