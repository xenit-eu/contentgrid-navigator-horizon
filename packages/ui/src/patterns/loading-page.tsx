import { Skeleton } from "../primitives/skeleton";

export interface LoadingPageProps {
  /** Number of skeleton rows shown below the header bar. Defaults to 5. */
  rows?: number;
}

export function LoadingPage({ rows = 5 }: Readonly<LoadingPageProps>) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}
