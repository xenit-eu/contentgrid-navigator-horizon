import { WarningIcon as Warning } from "@phosphor-icons/react";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";

export interface EntityItemCollectionLoadErrorProps {
  /** The entity's plural name, e.g. "Invoices"; shown in lower case in the sentence. */
  readonly pluralName: string;
  /** What the request failed with: an HTTP problem shows its text, anything else the connection hint. */
  readonly error: unknown;
  /** Fetches the collection again. */
  readonly onRetry: () => void;
}

/**
 * The collection page's "couldn't be loaded" alert, shown under the title in place of the table.
 * Under the title it says what the server answered (its problem's detail, else its title), or,
 * when nothing answered, to check the connection; Try again is the way out.
 */
export function EntityItemCollectionLoadError({
  pluralName,
  error,
  onRetry,
}: Readonly<EntityItemCollectionLoadErrorProps>) {
  // A model with a status came from an HTTP problem response; without one nothing answered.
  const problem = toProblemDisplayModel(error);
  const description =
    (problem.status !== undefined ? problem.detail || problem.title : undefined) ||
    "Check your connection and try again.";

  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-[10px] border border-[rgb(240,185,180)] bg-(--danger-tint) px-3.5 py-3 text-[13.5px] text-(--text-dim) dark:border-destructive/40 dark:bg-destructive/10 dark:text-muted-foreground"
    >
      <Warning className="size-5 shrink-0 text-destructive" aria-hidden />
      <div className="grow">
        <b className="block font-bold text-destructive">
          The {pluralName.toLowerCase()} couldn't be loaded
        </b>
        {description}
        <div className="mt-2">
          <Button
            variant="outline"
            className="h-[30px] gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-foreground shadow-none"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
