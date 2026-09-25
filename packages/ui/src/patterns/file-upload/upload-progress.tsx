import { Progress } from "../../primitives/progress";

/** Upload progress bar with a percentage. */
export function UploadProgress({ progress }: Readonly<{ /** 0–100 */ progress: number }>) {
  // Held at 99% until the upload has fully completed.
  const percentage = Math.min(Math.round(progress), 99);

  return (
    <div className="flex w-full items-center gap-2">
      <Progress value={percentage} aria-label="Upload progress" className="h-1.5" />
      <span className="text-xs text-muted-foreground">{percentage}%</span>
    </div>
  );
}
