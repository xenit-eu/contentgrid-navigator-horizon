import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * A view's state, owned by the host (controlled: `onStateChange` is passed) or kept internally
 * (uncontrolled). Returns the state to render and a referentially stable `update`.
 *
 * `update` takes a function from the previous state to the next one:
 * - Two updates in the same tick build on each other, so the second does not drop the first. The
 *   value reported to a controlled host is remembered as the "previous" state until the host
 *   re-renders us (it has then applied, adjusted or rejected the change, and its props are the
 *   truth again) or, if it never re-renders, until the end of the current microtask checkpoint.
 * - A controlled host may ignore a change; updates then build on the state it last rendered us with.
 * - Known limit: a host that applies a change only in a later macrotask, and gets a second update
 *   from another tick before that, sees the second update built on its last rendered props.
 */
export function useControllableState<S>({
  state,
  onStateChange,
  defaultState,
}: Readonly<{
  state: S | undefined;
  onStateChange: ((state: S) => void) | undefined;
  defaultState: S;
}>): readonly [S, (update: (previous: S) => S) => void] {
  const [internal, setInternal] = useState(defaultState);
  const current = onStateChange ? (state ?? defaultState) : internal;

  const latest = useRef({ current, onStateChange });
  // Boxed, so a state that is itself `undefined` is not mistaken for "nothing pending".
  const pending = useRef<{ value: S } | undefined>(undefined);
  // Layout effect, so an update right after a commit sees that commit's props, not the previous
  // ones. A render means the host has dealt with whatever was reported, so nothing is pending.
  useLayoutEffect(() => {
    latest.current = { current, onStateChange };
    pending.current = undefined;
  });

  const update = useCallback((change: (previous: S) => S): void => {
    const { current: rendered, onStateChange: report } = latest.current;
    if (!report) {
      setInternal(change);
      return;
    }
    const next = change(pending.current ? pending.current.value : rendered);
    const entry = { value: next };
    pending.current = entry;
    queueMicrotask(() => {
      if (pending.current === entry) pending.current = undefined;
    });
    report(next);
  }, []);

  return [current, update];
}
