import { queryOptions } from "@tanstack/react-query";

export type QueryOptionsOverride<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
> = Omit<
  Parameters<typeof queryOptions<TQueryFnData, TError, TData, TQueryKey>>[0],
  "queryKey" | "queryFn" | "select"
>;
