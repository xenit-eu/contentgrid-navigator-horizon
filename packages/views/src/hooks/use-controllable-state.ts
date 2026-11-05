import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A view's state, owned by the host (controlled: `onStateChange` is passed) or kept internally
 * (uncontrolled). Returns the state to render and a referentially stable `update`.
 *
 * `update` takes a function from the previous state to the next one:
 * - Two updates in the same tick build on each other, so the second does not drop the first.
 * - A controlled host may ignore a change. The value reported to it is only remembered until the
 *   end of the current tick; after that, updates build on the state the host last rendered us with.
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
  useEffect(() => {
    latest.current = { current, onStateChange };
  });
  // Boxed, so a state that is itself `undefined` is not mistaken for "nothing pending".
  const pending = useRef<{ value: S } | undefined>(undefined);

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
