import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { Alert, AlertDescription, AlertTitle, Button } from "@contentgrid/ui";
import { ProblemAlert } from "../problem-details";

export interface ErrorPageProps {
  /**
   * Optional RFC 9457 problem detail describing what failed. Build with
   * `toProblemDisplayModel(error)` from `@contentgrid/navigator-data`. When
   * omitted, a generic error message is shown.
   */
  readonly model?: ProblemDisplayModel;
  /**
   * When provided, renders a retry button that fires this callback —
   * e.g. to re-run the failed query.
   */
  readonly onRetry?: () => void;
  /** Label for the retry button. Defaults to "Try again". */
  readonly retryLabel?: string;
}

/** Full-page error state — rendered when a route or data load fails. */
export function ErrorPage({ model, onRetry, retryLabel = "Try again" }: Readonly<ErrorPageProps>) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-3">
        {model ? (
          <ProblemAlert model={model} />
        ) : (
          <Alert tone="error">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>An unexpected error occurred. Please try again.</AlertDescription>
          </Alert>
        )}
        {onRetry && (
          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
