/**
 * Uppercases the first character of `value`, leaving the rest untouched. Mirrors legacy
 * Navigator's `CreateInstancePage.tsx` `capitalizeFirstLetter` — used to build the create-success
 * toast wording that an e2e spec asserts against verbatim.
 */
export function capitalizeFirstLetter(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
