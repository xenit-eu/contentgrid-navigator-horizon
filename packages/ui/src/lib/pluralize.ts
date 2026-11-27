/** The word for a count: the singular for exactly one ("1 item"), with an "s" otherwise ("0 items"). */
export function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
