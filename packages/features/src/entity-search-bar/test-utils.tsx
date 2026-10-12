import { type ReactNode, useState } from "react";

/** Holds a quick filter's controlled `open` state, as the search bar does. */
export function WithOpenState({
  children,
}: {
  readonly children: (props: { open: boolean; onOpenChange: (open: boolean) => void }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <>{children({ open, onOpenChange: setOpen })}</>;
}
