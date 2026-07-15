import { Button } from "../primitives/button";

export interface ErrorPageProps {
  message: string;
  /** Called when the user clicks the retry action. Omit to hide the button. */
  onRetry?: () => void;
  /** Label for the retry button. Defaults to "Retry". */
  retryLabel?: string;
}

export function ErrorPage({ message, onRetry, retryLabel = "Retry" }: Readonly<ErrorPageProps>) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
