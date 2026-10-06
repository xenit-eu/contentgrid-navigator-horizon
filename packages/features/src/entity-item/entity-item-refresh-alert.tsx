import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from "@contentgrid/ui";

/**
 * Shown above a loaded item whose latest refetch failed: the page keeps the version it has, and
 * Retry fetches the item again.
 */
export function EntityItemRefreshAlert({
  onRetry,
  isRetrying,
}: Readonly<{ onRetry: () => void; isRetrying: boolean }>) {
  return (
    <Alert tone="warning">
      <AlertTitle>This item could not be refreshed</AlertTitle>
      <AlertDescription>The values shown may be out of date.</AlertDescription>
      <AlertActionSection>
        <AlertButton type="button" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Retrying…" : "Retry"}
        </AlertButton>
      </AlertActionSection>
    </Alert>
  );
}
