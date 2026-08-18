import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";

export interface LoadingPageProps {
  /** Optional message shown beneath the spinner. */
  readonly message?: string;
}

/** Full-viewport centered loading spinner — rendered while a route or the app shell boots. */
export function LoadingPage({ message }: Readonly<LoadingPageProps>) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-6"
    >
      <CircleNotch className="size-8 animate-spin text-muted-foreground" aria-hidden />
      <span className={message ? "text-sm text-muted-foreground" : "sr-only"}>
        {message ?? "Loading…"}
      </span>
    </div>
  );
}
