import { ContentGridProblemType, isProblemOfType } from "@contentgrid/navigator-data";
import { toast } from "@contentgrid/ui";

const RECORD_CHANGED_MESSAGE =
  "This item was changed by someone else. Reload to see the latest version.";

/**
 * 412 (unsatisfied-version) means the item was modified concurrently — the
 * platform's documented recovery is re-fetch, re-apply, retry. Surface that
 * as a toast with a one-click reload instead of relying on the inline alert
 * alone.
 */
export function notifyReloadOnUnsatisfiedVersion(error: unknown, reload: () => void) {
  if (isProblemOfType(error, ContentGridProblemType.UNSATISFIED_VERSION)) {
    toast.error(RECORD_CHANGED_MESSAGE, { action: { label: "Reload", onClick: reload } });
  }
}
