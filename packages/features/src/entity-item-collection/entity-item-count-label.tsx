export interface EntityItemCountLabelProps {
  readonly count: number;
  readonly noun?: string;
}

export function EntityItemCountLabel({ count, noun = "item" }: EntityItemCountLabelProps) {
  return (
    <>
      {count.toLocaleString()} {noun}
      {count === 1 ? "" : "s"}
    </>
  );
}
