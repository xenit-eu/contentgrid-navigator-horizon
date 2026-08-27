export function getRecordTableGridTemplate(
  columnCount: number,
  options?: { hasActions?: boolean },
): string {
  if (columnCount < 1) return "";
  const rest = columnCount - 1;
  const tracks = ["minmax(200px, 1.6fr)", ...Array(rest).fill("minmax(0, 1fr)")];
  if (options?.hasActions) tracks.push("min-content");
  return tracks.join(" ");
}
