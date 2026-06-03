import { useState } from "react";

const DISMISS_KEY = "navigator-exp-banner-dismissed";

/**
 * Experimental-app warning banner. Dismissible per browser session
 * (sessionStorage) — it reappears in a new session, so it is never
 * permanently hidden. See ACC-2858 / HZN-1.11.
 */
export function ExperimentalBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "true",
  );

  if (dismissed) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-[var(--amber)] px-4 py-2 text-center text-sm font-medium text-white"
    >
      <span>Experimental — not for production use</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss experimental warning"
        className="ml-2 rounded px-1.5 leading-none text-white/80 hover:bg-white/15 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
