import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

export interface UseUnsavedChangesGuardResult {
  /** True while a navigation attempt is blocked, waiting on the user's decision. */
  readonly isBlocked: boolean;
  /** Resumes the blocked navigation. */
  readonly confirmNavigation: () => void;
  /** Cancels the blocked navigation — the user stays on the current page. */
  readonly cancelNavigation: () => void;
  /**
   * Runs `action` with blocking turned off for its duration — for a navigation the
   * caller already knows is safe (e.g. redirecting to the newly created item right
   * after a successful save, before `isDirty` has had a chance to turn false).
   *
   * Why not just wait for `isDirty` to update? `action` usually runs inside the same
   * synchronous callback that just learned the save succeeded — before React has
   * re-rendered this hook with the new `isDirty` value. Turning blocking off only for
   * the duration of this one call (not indefinitely) also means a no-op `action` can't
   * accidentally leave blocking off for whatever navigation happens next.
   */
  readonly withoutBlocking: <T>(action: () => T) => T;
}

/**
 * Blocks in-app navigation while `isDirty` is true, until the user confirms leaving.
 * Also arms the browser's native `beforeunload` prompt for tab close / refresh, but only
 * while dirty — `useBlocker`'s `enableBeforeUnload` defaults to `true` unconditionally, which
 * would show the native prompt even on a pristine form, so it's explicitly gated here.
 *
 * `isDirty` is a plain boolean rather than a specific form library's dirty flag — this
 * repo doesn't use react-hook-form (see ADR-004); pass `useFormFields(...).isDirty`
 * from `@contentgrid/navigator-data`, or any other boolean dirty signal.
 */
export function useUnsavedChangesGuard(isDirty: boolean): UseUnsavedChangesGuardResult {
  const blockingSuspendedRef = useRef(false);

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !blockingSuspendedRef.current,
    enableBeforeUnload: () => isDirty && !blockingSuspendedRef.current,
    withResolver: true,
  });

  function withoutBlocking<T>(action: () => T): T {
    blockingSuspendedRef.current = true;
    try {
      return action();
    } finally {
      blockingSuspendedRef.current = false;
    }
  }

  return {
    isBlocked: blocker.status === "blocked",
    confirmNavigation: () => blocker.proceed?.(),
    cancelNavigation: () => blocker.reset?.(),
    withoutBlocking,
  };
}
